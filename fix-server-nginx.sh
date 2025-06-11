#!/bin/bash

# Fix server nginx configuration
# This script cleans up problematic nginx configs and applies the correct ones

echo "🔧 Fixing nginx configuration on server..."

# Remove problematic production config temporarily
if [ -f "/etc/nginx/sites-enabled/queen-track-production" ]; then
    echo "Removing problematic production config..."
    rm -f /etc/nginx/sites-enabled/queen-track-production
fi

# Remove problematic staging config if it exists
if [ -f "/etc/nginx/sites-enabled/queen-track-staging" ]; then
    echo "Removing old staging config..."
    rm -f /etc/nginx/sites-enabled/queen-track-staging
fi

# Create corrected staging configuration
echo "Creating corrected staging configuration..."
cat > /etc/nginx/sites-available/queen-track-staging << 'NGINX_STAGING'
server {
    listen 3002;
    server_name 162.55.53.52;
    root /var/www/queen-track-staging;
    index index.html;

    # Health check endpoint
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

    # Gzip compression (fixed)
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX_STAGING

# Create corrected production configuration
echo "Creating corrected production configuration..."
cat > /etc/nginx/sites-available/queen-track-production << 'NGINX_PRODUCTION'
server {
    listen 3001;
    server_name 162.55.53.52;
    root /var/www/queen-track;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Health check endpoint
    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static assets - serve directly with proper caching
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

    # Gzip compression (fixed - removed invalid must-revalidate)
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX_PRODUCTION

# Enable staging config
echo "Enabling staging configuration..."
ln -sf /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-enabled/

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration test passed"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    systemctl reload nginx || service nginx reload
    
    echo "✅ Nginx reloaded successfully"
    
    # Test the applications
    echo "🧪 Testing applications..."
    sleep 2
    
    # Test staging health endpoint
    curl -f http://localhost:3002/health && echo "✅ Staging health OK"
    
    # Check what's listening
    echo "🔍 Checking ports..."
    netstat -tlnp | grep -E ":(3001|3002)" || ss -tlnp | grep -E ":(3001|3002)"
    
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

echo "🎉 Server nginx configuration fixed!" 