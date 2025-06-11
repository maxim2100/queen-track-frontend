#!/bin/bash

# Fix Nginx redirect loop for Queen Track Frontend
# This script corrects the nginx configuration to prevent redirect loops

set -e

SERVER_HOST="162.55.53.52"
SERVER_USER="root"

echo "🔧 Fixing Nginx redirect loop issue..."

# Check if SERVER_PASSWORD is set
if [ -z "$SERVER_PASSWORD" ]; then
    echo "❌ SERVER_PASSWORD environment variable is required"
    echo "Usage: SERVER_PASSWORD='your-password' ./scripts/fix-nginx-redirect-loop.sh"
    exit 1
fi

echo "📝 The issue: Nginx try_files directive is causing redirect loops"
echo "📝 Solution: Fix the try_files configuration for React Router"
echo ""

# Create the corrected nginx configs
cat > nginx-production.conf << 'NGINX_PROD'
server {
    listen 3001;
    server_name 162.55.53.52;
    root /var/www/queen-track;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Health check endpoint (works correctly)
    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static assets - serve directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React Router - catch all other requests
    location / {
        try_files $uri $uri/ @fallback;
    }

    # Fallback for React Router
    location @fallback {
        rewrite ^.*$ /index.html last;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX_PROD

cat > nginx-staging.conf << 'NGINX_STAGING'
server {
    listen 3002;
    server_name 162.55.53.52;
    root /var/www/queen-track-staging;
    index index.html;

    # Health check endpoint (works correctly)
    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static assets - serve directly
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React Router - catch all other requests
    location / {
        try_files $uri $uri/ @fallback;
    }

    # Fallback for React Router
    location @fallback {
        rewrite ^.*$ /index.html last;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX_STAGING

echo "🚀 Deploying fixed nginx configuration..."

# Upload corrected configs
sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no nginx-production.conf "$SERVER_USER@$SERVER_HOST:/tmp/"
sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no nginx-staging.conf "$SERVER_USER@$SERVER_HOST:/tmp/"

# Apply the fixes on the server
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << 'EOF'
set -e

echo "🔧 Applying nginx configuration fixes..."

# Backup current configs
cp /etc/nginx/sites-available/queen-track-production /etc/nginx/sites-available/queen-track-production.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No production config to backup"
cp /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-available/queen-track-staging.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No staging config to backup"

# Install new configs
cp /tmp/nginx-production.conf /etc/nginx/sites-available/queen-track-production
cp /tmp/nginx-staging.conf /etc/nginx/sites-available/queen-track-staging

# Ensure sites are enabled
ln -sf /etc/nginx/sites-available/queen-track-production /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-enabled/

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration test passed"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx || service nginx reload
    
    echo "✅ Nginx reloaded successfully"
    
    # Test the applications
    echo "🧪 Testing applications after fix..."
    sleep 3
    
    # Test health endpoints
    curl -f http://localhost:3001/health && echo "✅ Production health OK"
    curl -f http://localhost:3002/health && echo "✅ Staging health OK"
    
    # Test main pages (should not redirect loop now)
    curl -I -L --max-redirects 3 http://localhost:3001/ | head -5
    curl -I -L --max-redirects 3 http://localhost:3002/ | head -5
    
else
    echo "❌ Nginx configuration test failed!"
    echo "Restoring backup configurations..."
    
    # Restore backups if they exist
    if [ -f "/etc/nginx/sites-available/queen-track-production.backup.*" ]; then
        cp /etc/nginx/sites-available/queen-track-production.backup.* /etc/nginx/sites-available/queen-track-production
    fi
    if [ -f "/etc/nginx/sites-available/queen-track-staging.backup.*" ]; then
        cp /etc/nginx/sites-available/queen-track-staging.backup.* /etc/nginx/sites-available/queen-track-staging
    fi
    
    systemctl reload nginx || service nginx reload
    exit 1
fi

# Cleanup temp files
rm -f /tmp/nginx-production.conf /tmp/nginx-staging.conf

echo "🎉 Nginx configuration fix completed!"
EOF

# Cleanup local files
rm -f nginx-production.conf nginx-staging.conf

echo ""
echo "✅ Fix applied successfully!"
echo "🧪 Testing the applications..."

# Wait a moment for nginx to fully reload
sleep 5

# Test the fixed applications
echo "🌐 Testing Production: http://162.55.53.52:3001/"
curl -I -L --max-redirects 3 --connect-timeout 10 "http://162.55.53.52:3001/" 2>/dev/null | head -3 || echo "Connection test completed"

echo ""
echo "🌐 Testing Staging: http://162.55.53.52:3002/"
curl -I -L --max-redirects 3 --connect-timeout 10 "http://162.55.53.52:3002/" 2>/dev/null | head -3 || echo "Connection test completed"

echo ""
echo "🎉 Fix completed! Your applications should now work correctly:"
echo "🌐 Production: http://162.55.53.52:3001/"
echo "🌐 Staging: http://162.55.53.52:3002/"
echo ""
echo "🔍 The issue was: Nginx try_files directive causing redirect loops"
echo "✅ The fix: Using @fallback location with proper rewrite for React Router" 