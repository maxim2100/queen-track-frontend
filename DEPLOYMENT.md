# Queen Track Frontend Deployment Guide

## Server Configuration

**Server Details:**

- IP: 162.55.53.52
- User: root
- Password: `<YOUR_SERVER_PASSWORD>` (set as environment variable)
- Production Port: 3001
- Staging Port: 3002

## Security Setup

### Environment Variables

Before deploying, set up the required environment variables:

```bash
# For manual deployment
export SERVER_PASSWORD='your-actual-server-password'

# For GitHub Actions, add these secrets:
# Go to Repository Settings > Secrets and variables > Actions
# Add: SERVER_PASSWORD = your-actual-server-password
```

## Quick Deployment Methods

### Method 1: Automatic CI/CD (Recommended)

1. **Set up GitHub secrets:**

   - Go to your repository settings
   - Navigate to "Secrets and variables" > "Actions"
   - Add secret: `SERVER_PASSWORD` with your actual server password

2. **Push to GitHub branches:**

   - Push to `develop` branch → Auto-deploys to staging (port 3002)
   - Push to `main` branch → Auto-deploys to production (port 3001)

3. **Access your applications:**
   - Staging: http://162.55.53.52:3002
   - Production: http://162.55.53.52:3001

### Method 2: Manual Deployment Script

1. **Set up environment variable:**

   ```bash
   export SERVER_PASSWORD='your-actual-server-password'
   ```

2. **Make the deployment script executable:**

   ```bash
   chmod +x scripts/deploy.sh
   ```

3. **Deploy to staging:**

   ```bash
   SERVER_PASSWORD='your-password' ./scripts/deploy.sh staging
   ```

4. **Deploy to production:**
   ```bash
   SERVER_PASSWORD='your-password' ./scripts/deploy.sh production
   ```

### Method 3: Manual Steps

1. **Build the application:**

   ```bash
   # For production
   cp .env.production .env
   npm install --legacy-peer-deps
   npm run build

   # For staging
   cp .env.staging .env
   npm install --legacy-peer-deps
   npm run build
   ```

2. **Create and upload package:**

   ```bash
   # Create package
   tar -czf frontend-build.tar.gz -C build .

   # Upload to server (replace YOUR_PASSWORD with actual password)
   sshpass -p 'YOUR_PASSWORD' scp frontend-build.tar.gz root@162.55.53.52:/tmp/
   ```

3. **Deploy on server:**

   ```bash
   # Connect to server (replace YOUR_PASSWORD with actual password)
   sshpass -p 'YOUR_PASSWORD' ssh root@162.55.53.52

   # For production deployment
   mkdir -p /var/www/queen-track
   cd /tmp
   tar -xzf frontend-build.tar.gz -C /var/www/queen-track
   chown -R www-data:www-data /var/www/queen-track
   chmod -R 755 /var/www/queen-track

   # For staging deployment
   mkdir -p /var/www/queen-track-staging
   cd /tmp
   tar -xzf frontend-build.tar.gz -C /var/www/queen-track-staging
   chown -R www-data:www-data /var/www/queen-track-staging
   chmod -R 755 /var/www/queen-track-staging
   ```

## Server Setup (One-time)

### 1. Install Required Software

```bash
# Connect to your server (replace YOUR_PASSWORD with actual password)
sshpass -p 'YOUR_PASSWORD' ssh root@162.55.53.52

# Update system
apt update && apt upgrade -y

# Install Nginx
apt install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create web directories
mkdir -p /var/www/queen-track
mkdir -p /var/www/queen-track-staging
```

### 2. Configure Nginx

The deployment scripts will automatically create Nginx configurations, but you can also set them up manually:

**Production Config (`/etc/nginx/sites-available/queen-track-production`):**

```nginx
server {
    listen 3001;
    server_name 162.55.53.52;
    root /var/www/queen-track;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
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
```

**Staging Config (`/etc/nginx/sites-available/queen-track-staging`):**

```nginx
server {
    listen 3002;
    server_name 162.55.53.52;
    root /var/www/queen-track-staging;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

**Enable the sites:**

```bash
ln -s /etc/nginx/sites-available/queen-track-production /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/queen-track-staging /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 3. Configure Firewall (if needed)

```bash
# Allow the new ports
ufw allow 3001
ufw allow 3002
ufw reload
```

## Environment Configuration

Your application is configured to connect to your backend at:

- Backend API: http://162.55.53.52:8000
- WebSocket: ws://162.55.53.52:8000

Make sure your backend is running on port 8000.

## Testing Deployment

After deployment, test your applications:

```bash
# Test health endpoints
curl http://162.55.53.52:3001/health  # Production
curl http://162.55.53.52:3002/health  # Staging

# Test main pages
curl http://162.55.53.52:3001/  # Production
curl http://162.55.53.52:3002/  # Staging
```

## Troubleshooting

### Common Issues

1. **Permission errors:**

   ```bash
   chown -R www-data:www-data /var/www/queen-track*
   chmod -R 755 /var/www/queen-track*
   ```

2. **Nginx configuration errors:**

   ```bash
   nginx -t  # Test configuration
   systemctl status nginx  # Check status
   tail -f /var/log/nginx/error.log  # Check logs
   ```

3. **Port conflicts:**

   ```bash
   netstat -tulpn | grep :3001  # Check what's using port 3001
   netstat -tulpn | grep :3002  # Check what's using port 3002
   ```

4. **Application not loading:**
   - Check if files exist: `ls -la /var/www/queen-track/`
   - Check Nginx logs: `tail -f /var/log/nginx/access.log`
   - Verify backend is running on port 8000

### Logs and Monitoring

- Nginx access logs: `/var/log/nginx/access.log`
- Nginx error logs: `/var/log/nginx/error.log`
- Application logs: Available through browser console

## Workflow Summary

1. **Development:** Work on feature branches
2. **Staging:** Merge to `develop` branch → Auto-deploy to staging (port 3002)
3. **Production:** Merge to `main` branch → Auto-deploy to production (port 3001)

Your application will automatically deploy whenever you push code to the main branch, and it will be available at http://162.55.53.52:3001!

## Security Best Practices

- ✅ Never commit passwords to version control
- ✅ Use environment variables for sensitive data
- ✅ Use GitHub secrets for CI/CD credentials
- ✅ Regularly update server and dependencies
- ✅ Monitor access logs for suspicious activity

---

**Last Updated**: December 2024
**Version**: 1.0
