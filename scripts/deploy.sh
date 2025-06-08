#!/bin/bash

# Deployment script for Queen Track Frontend
# Usage: ./scripts/deploy.sh [environment]

set -e

# Configuration
ENVIRONMENTS=("staging" "production")
DEFAULT_ENV="staging"
ENV=${1:-$DEFAULT_ENV}

# Check for required environment variables
if [ -z "$SERVER_PASSWORD" ]; then
    echo "❌ SERVER_PASSWORD environment variable is required"
    echo "Usage: SERVER_PASSWORD='your-password' ./scripts/deploy.sh [environment]"
    exit 1
fi

# Validate environment
if [[ ! " ${ENVIRONMENTS[@]} " ]]; then
    echo "❌ Invalid environment: $ENV"
    echo "Available environments: ${ENVIRONMENTS[*]}"
    exit 1
fi

# Load environment-specific configuration
case $ENV in
    "production")
        SERVER_HOST="162.55.53.52"
        SERVER_USER="root"
        SERVER_PATH="/var/www/queen-track"
        SERVER_PORT="3001"
        DOCKER_IMAGE="queen-track-frontend:latest"
        ;;
    "staging")
        SERVER_HOST="162.55.53.52"
        SERVER_USER="root"
        SERVER_PATH="/var/www/queen-track-staging"
        SERVER_PORT="3002"
        DOCKER_IMAGE="queen-track-frontend:staging"
        ;;
esac

echo "🚀 Starting deployment to $ENV environment..."
echo "📍 Server: $SERVER_HOST:$SERVER_PORT"

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."

# Check if required tools are installed
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v sshpass >/dev/null 2>&1 || { 
    echo "⚠️ sshpass not found. Installing..."
    # For Windows (if using WSL) or Linux
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update && sudo apt-get install -y sshpass
    elif command -v brew >/dev/null 2>&1; then
        brew install hudochenkov/sshpass/sshpass
    else
        echo "❌ Please install sshpass manually"
        exit 1
    fi
}

# Test SSH connection
echo "🔐 Testing SSH connection..."
sshpass -p "$SERVER_PASSWORD" ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST exit 2>/dev/null || {
    echo "❌ Cannot connect to server. Please check credentials."
    exit 1
}

echo "✅ SSH connection successful"

# Build the application
echo "🏗️ Building application for $ENV..."
if [ -f ".env.$ENV" ]; then
    cp ".env.$ENV" .env
    echo "✅ Environment file copied"
else
    echo "⚠️ No environment file found for $ENV, using defaults"
fi

npm install
npm run "build:$ENV"

echo "✅ Build completed successfully"

# Create deployment package
echo "📦 Creating deployment package..."
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="queen-track-frontend-$ENV-$TIMESTAMP.tar.gz"

tar -czf "$PACKAGE_NAME" -C build .

echo "✅ Package created: $PACKAGE_NAME"

# Upload to server
echo "⬆️ Uploading to server..."
sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no "$PACKAGE_NAME" "$SERVER_USER@$SERVER_HOST:/tmp/"

# Deploy on server
echo "🚀 Deploying on server..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_HOST" << EOF
    set -e
    
    echo "Creating backup of current deployment..."
    if [ -d "$SERVER_PATH" ]; then
        cp -r "$SERVER_PATH" "$SERVER_PATH.backup.$TIMESTAMP"
    fi
    
    echo "Extracting new deployment..."
    mkdir -p "$SERVER_PATH"
    cd /tmp
    tar -xzf "$PACKAGE_NAME" -C "$SERVER_PATH"
    chown -R www-data:www-data "$SERVER_PATH" 2>/dev/null || chown -R root:root "$SERVER_PATH"
    chmod -R 755 "$SERVER_PATH"
    
    echo "Setting up Nginx configuration..."
    cat > /etc/nginx/sites-available/queen-track-$ENV << 'NGINX_EOF'
server {
    listen $SERVER_PORT;
    server_name $SERVER_HOST;
    root $SERVER_PATH;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Handle React Router
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Health check
    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
NGINX_EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/queen-track-$ENV /etc/nginx/sites-enabled/
    
    # Test nginx configuration
    nginx -t || {
        echo "❌ Nginx configuration error"
        exit 1
    }
    
    echo "Restarting nginx..."
    systemctl reload nginx || service nginx reload
    
    echo "Testing deployment..."
    sleep 5
    curl -f http://localhost:$SERVER_PORT/health || {
        echo "❌ Health check failed, rolling back..."
        if [ -d "$SERVER_PATH.backup.$TIMESTAMP" ]; then
            rm -rf "$SERVER_PATH"
            mv "$SERVER_PATH.backup.$TIMESTAMP" "$SERVER_PATH"
            systemctl reload nginx || service nginx reload
        fi
        exit 1
    }
    
    echo "✅ Deployment successful!"
    
    # Cleanup old backups (keep last 5)
    echo "🧹 Cleaning up old backups..."
    cd \$(dirname "$SERVER_PATH")
    ls -t *.backup.* 2>/dev/null | tail -n +6 | xargs -r rm -rf
    
    # Remove deployment package
    rm -f "/tmp/$PACKAGE_NAME"
EOF

# Cleanup local files
rm -f "$PACKAGE_NAME"

# Run post-deployment tests
echo "🧪 Running post-deployment tests..."

# Health check
echo "Checking application health..."
curl -f "http://$SERVER_HOST:$SERVER_PORT/health" || {
    echo "❌ Health check failed"
    exit 1
}

# Basic functionality test
echo "Testing basic functionality..."
curl -f "http://$SERVER_HOST:$SERVER_PORT/" >/dev/null 2>&1 || {
    echo "❌ Application not responding"
    exit 1
}

echo "✅ Post-deployment tests passed"

# Deployment notification
echo "📧 Deployment completed successfully!"
DEPLOYMENT_MESSAGE="✅ Queen Track Frontend deployed successfully to $ENV environment at $(date)"
echo "$DEPLOYMENT_MESSAGE"

echo ""
echo "🎉 Deployment completed successfully!"
echo "🌐 Application URL: http://$SERVER_HOST:$SERVER_PORT"
echo "📊 Environment: $ENV"
echo "⏰ Deployment time: $(date)"

exit 0 