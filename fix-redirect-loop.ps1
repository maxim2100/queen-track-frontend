# Fix Nginx redirect loop for Queen Track Frontend
# PowerShell version for Windows

Write-Host "🔧 Fixing Nginx redirect loop issue..." -ForegroundColor Yellow

$SERVER_HOST = "162.55.53.52"
$SERVER_USER = "root"
$SERVER_PASSWORD = "[DP/k(.=C8z0#87pwu+"

Write-Host "📝 The issue: Nginx try_files directive is causing redirect loops" -ForegroundColor Red
Write-Host "📝 Solution: Fix the try_files configuration for React Router" -ForegroundColor Green
Write-Host ""

# Create corrected nginx configurations
$nginxProd = @"
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
        try_files `$uri =404;
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # React Router - catch all other requests
    location / {
        try_files `$uri `$uri/ @fallback;
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
"@

$nginxStaging = @"
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
        try_files `$uri =404;
    }

    # API proxy (if needed)
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_Set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # React Router - catch all other requests
    location / {
        try_files `$uri `$uri/ @fallback;
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
"@

# Save configs to temp files
$nginxProd | Out-File -FilePath "nginx-production.conf" -Encoding utf8
$nginxStaging | Out-File -FilePath "nginx-staging.conf" -Encoding utf8

# Create SSH commands to execute on server
$sshCommands = @"
set -e

echo "🔧 Applying nginx configuration fixes..."

# Backup current configs
cp /etc/nginx/sites-available/queen-track-production /etc/nginx/sites-available/queen-track-production.backup.`$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No production config to backup"
cp /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-available/queen-track-staging.backup.`$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No staging config to backup"

# Install new configs
cp /tmp/nginx-production.conf /etc/nginx/sites-available/queen-track-production
cp /tmp/nginx-staging.conf /etc/nginx/sites-available/queen-track-staging

# Ensure sites are enabled
ln -sf /etc/nginx/sites-available/queen-track-production /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-enabled/

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t

if [ `$? -eq 0 ]; then
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
    echo "🌐 Testing main pages..."
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
"@

Write-Host "🚀 Instructions to apply the fix:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy the nginx configuration files to your server:" -ForegroundColor White
Write-Host "   scp nginx-production.conf root@162.55.53.52:/tmp/" -ForegroundColor Yellow
Write-Host "   scp nginx-staging.conf root@162.55.53.52:/tmp/" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. SSH to your server and run the fix commands:" -ForegroundColor White
Write-Host "   ssh root@162.55.53.52" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Then execute the following commands on your server:" -ForegroundColor White

# Save the SSH commands to a file for easy copying
$sshCommands | Out-File -FilePath "server-fix-commands.sh" -Encoding utf8

Write-Host ""
Write-Host "✅ Configuration files created:" -ForegroundColor Green
Write-Host "   - nginx-production.conf" -ForegroundColor White
Write-Host "   - nginx-staging.conf" -ForegroundColor White  
Write-Host "   - server-fix-commands.sh" -ForegroundColor White
Write-Host ""
Write-Host "🔍 The issue was: Nginx try_files directive causing redirect loops" -ForegroundColor Red
Write-Host "✅ The fix: Using @fallback location with proper rewrite for React Router" -ForegroundColor Green

# Test the current state
Write-Host ""
Write-Host "🧪 Testing current state of applications..." -ForegroundColor Yellow

try {
    $prodResponse = Invoke-WebRequest -Uri "http://162.55.53.52:3001/health" -TimeoutSec 5
    Write-Host "✅ Production health endpoint: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Production health endpoint: Failed" -ForegroundColor Red
}

try {
    $stagingResponse = Invoke-WebRequest -Uri "http://162.55.53.52:3002/health" -TimeoutSec 5  
    Write-Host "✅ Staging health endpoint: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Staging health endpoint: Failed" -ForegroundColor Red
}

try {
    $prodMain = Invoke-WebRequest -Uri "http://162.55.53.52:3001/" -Method Head -TimeoutSec 5
    Write-Host "✅ Production main page: OK" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -match "too many automatic redirections") {
        Write-Host "❌ Production main page: REDIRECT LOOP (needs fix)" -ForegroundColor Red
    } else {
        Write-Host "❌ Production main page: $($_.Exception.Message)" -ForegroundColor Red
    }
}

try {
    $stagingMain = Invoke-WebRequest -Uri "http://162.55.53.52:3002/" -Method Head -TimeoutSec 5
    Write-Host "✅ Staging main page: OK" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -match "too many automatic redirections") {
        Write-Host "❌ Staging main page: REDIRECT LOOP (needs fix)" -ForegroundColor Red
    } else {
        Write-Host "❌ Staging main page: $($_.Exception.Message)" -ForegroundColor Red
    }
} 