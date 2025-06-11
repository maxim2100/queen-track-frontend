# Quick Fix for Nginx Redirect Loop
# This generates the correct nginx config files

Write-Host "🔧 Creating Nginx configuration fix files..." -ForegroundColor Yellow
Write-Host ""

# Production nginx config
@"
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

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files `$uri =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # React Router fix
    location / {
        try_files `$uri `$uri/ @fallback;
    }

    location @fallback {
        rewrite ^.*$ /index.html last;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
"@ | Out-File -FilePath "nginx-production.conf" -Encoding UTF8

# Staging nginx config  
@"
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

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files `$uri =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://162.55.53.52:8000/;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }

    # React Router fix
    location / {
        try_files `$uri `$uri/ @fallback;
    }

    location @fallback {
        rewrite ^.*$ /index.html last;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
"@ | Out-File -FilePath "nginx-staging.conf" -Encoding UTF8

Write-Host "✅ Created nginx-production.conf" -ForegroundColor Green
Write-Host "✅ Created nginx-staging.conf" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 TO FIX THE REDIRECT LOOP ISSUE:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Upload config files to server:" -ForegroundColor White
Write-Host "   scp nginx-production.conf root@162.55.53.52:/tmp/" -ForegroundColor Yellow
Write-Host "   scp nginx-staging.conf root@162.55.53.52:/tmp/" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. SSH to server:" -ForegroundColor White  
Write-Host "   ssh root@162.55.53.52" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Apply the fix:" -ForegroundColor White
Write-Host "   cp /tmp/nginx-production.conf /etc/nginx/sites-available/queen-track-production" -ForegroundColor Yellow
Write-Host "   cp /tmp/nginx-staging.conf /etc/nginx/sites-available/queen-track-staging" -ForegroundColor Yellow
Write-Host "   nginx -t" -ForegroundColor Yellow
Write-Host "   systemctl reload nginx" -ForegroundColor Yellow
Write-Host ""

# Test current state
Write-Host "🧪 Current Status Check:" -ForegroundColor Yellow

try {
    $health1 = Invoke-WebRequest -Uri "http://162.55.53.52:3001/health" -TimeoutSec 5
    Write-Host "✅ Production health: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Production health: Failed" -ForegroundColor Red
}

try {
    $health2 = Invoke-WebRequest -Uri "http://162.55.53.52:3002/health" -TimeoutSec 5
    Write-Host "✅ Staging health: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Staging health: Failed" -ForegroundColor Red  
}

try {
    $main1 = Invoke-WebRequest -Uri "http://162.55.53.52:3001/" -Method Head -TimeoutSec 5
    Write-Host "✅ Production main: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Production main: REDIRECT LOOP" -ForegroundColor Red
}

try {
    $main2 = Invoke-WebRequest -Uri "http://162.55.53.52:3002/" -Method Head -TimeoutSec 5
    Write-Host "✅ Staging main: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Staging main: REDIRECT LOOP" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔍 THE PROBLEM: try_files `$uri `$uri/ /index.html causes redirect loops" -ForegroundColor Red
Write-Host "✅ THE SOLUTION: try_files `$uri `$uri/ @fallback + rewrite to /index.html" -ForegroundColor Green 