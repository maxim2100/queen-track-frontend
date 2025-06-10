# Queen Track Frontend - Production Guide

This document provides comprehensive instructions for deploying, monitoring, and maintaining the Queen Track Frontend application in production.

## 🏗️ Architecture Overview

The application is built using:
- **Frontend**: React 19 with React Router
- **Build Tool**: Create React App
- **Web Server**: Nginx (in Docker container)
- **Containerization**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions
- **Deployment**: Automated with rollback capabilities

## 🚀 Deployment Process

### Prerequisites

1. **Server Requirements**:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker and Docker Compose
   - Nginx (for reverse proxy)
   - SSH access configured
   - Minimum 2GB RAM, 10GB disk space

2. **Local Requirements**:
   - Node.js 18+
   - Docker
   - SSH client

### Environment Setup

1. **Create environment files**:
   ```bash
   # Production environment
   cp .env.example .env.production
   # Edit .env.production with production values
   
   # Staging environment  
   cp .env.example .env.staging
   # Edit .env.staging with staging values
   ```

2. **Configure deployment secrets** (for GitHub Actions):
   - `DEPLOY_HOST`: Production server IP/hostname
   - `DEPLOY_USER`: SSH username
   - `DEPLOY_KEY`: Private SSH key for deployment

### Manual Deployment

1. **Using deployment script**:
   ```bash
   # Deploy to staging
   ./scripts/deploy.sh staging
   
   # Deploy to production
   ./scripts/deploy.sh production
   ```

2. **Using Docker**:
   ```bash
   # Build image
   docker build -t queen-track-frontend .
   
   # Run container
   docker run -d \
     --name queen-track-frontend \
     -p 3000:3000 \
     --restart unless-stopped \
     queen-track-frontend
   ```

### Automated Deployment (CI/CD)

The application automatically deploys when:
- **Staging**: Push to `develop` branch
- **Production**: Push to `main` branch

The CI/CD pipeline includes:
1. **Testing**: Lint, unit tests, integration tests
2. **Security**: Dependency audit, vulnerability scanning
3. **Building**: Multi-environment builds
4. **Deployment**: Automated deployment with health checks
5. **Rollback**: Automatic rollback on deployment failure

## 🧪 Testing

### Running Tests Locally

```bash
# Run all tests
./scripts/test.sh all

# Run specific test types
./scripts/test.sh unit
./scripts/test.sh integration
./scripts/test.sh lint
./scripts/test.sh coverage
```

### Test Coverage Requirements

- **Lines**: ≥70%
- **Functions**: ≥70%
- **Branches**: ≥70%
- **Statements**: ≥70%

## 📊 Monitoring and Health Checks

### Health Endpoints

- **Application Health**: `http://your-domain:3000/health`
- **Nginx Status**: Available through nginx status module

### Key Metrics to Monitor

1. **Application Metrics**:
   - Response times
   - Error rates
   - User sessions
   - API call success rates

2. **Infrastructure Metrics**:
   - CPU usage
   - Memory usage
   - Disk space
   - Network connectivity

3. **Business Metrics**:
   - Active users
   - Video uploads
   - Camera connection success rate

### Monitoring Setup

1. **Application Monitoring**:
   ```bash
   # Check application status
   curl -f http://your-domain:3000/health
   
   # Check application logs
   docker logs queen-track-frontend
   ```

2. **System Monitoring**:
   ```bash
   # Check system resources
   htop
   df -h
   
   # Check nginx status
   sudo systemctl status nginx
   ```

## 🔧 Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Check application logs for errors
   - Monitor disk space usage
   - Review security audit reports

2. **Monthly**:
   - Update dependencies (security patches)
   - Clean up old Docker images
   - Review and rotate logs

3. **Quarterly**:
   - Full security audit
   - Performance optimization review
   - Capacity planning assessment

### Backup Procedures

1. **Application Backups**:
   ```bash
   # Backup current deployment
   sudo tar -czf /backup/queen-track-$(date +%Y%m%d).tar.gz /var/www/queen-track
   ```

2. **Configuration Backups**:
   ```bash
   # Backup nginx configuration
   sudo cp /etc/nginx/sites-available/queen-track /backup/nginx-config-$(date +%Y%m%d)
   ```

### Log Management

1. **Application Logs**:
   ```bash
   # View recent logs
   docker logs --tail 100 queen-track-frontend
   
   # Follow logs in real-time
   docker logs -f queen-track-frontend
   ```

2. **Nginx Logs**:
   ```bash
   # Access logs
   sudo tail -f /var/log/nginx/access.log
   
   # Error logs
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Log Rotation**:
   ```bash
   # Configure logrotate for application logs
   sudo vim /etc/logrotate.d/queen-track
   ```

## 🚨 Troubleshooting

### Common Issues

1. **Application Won't Start**:
   ```bash
   # Check Docker container status
   docker ps -a
   
   # Check container logs
   docker logs queen-track-frontend
   
   # Restart container
   docker restart queen-track-frontend
   ```

2. **502 Bad Gateway**:
   ```bash
   # Check nginx configuration
   sudo nginx -t
   
   # Check if application is running
   curl localhost:3000
   
   # Restart nginx
   sudo systemctl restart nginx
   ```

3. **High Memory Usage**:
   ```bash
   # Check memory usage
   free -h
   
   # Check process memory usage
   ps aux --sort=-%mem | head
   
   # Restart application
   docker restart queen-track-frontend
   ```

### Emergency Procedures

1. **Rollback Deployment**:
   ```bash
   # Automatic rollback (if deployment failed)
   # The deployment script automatically handles this
   
   # Manual rollback
   sudo rm -rf /var/www/queen-track
   sudo mv /var/www/queen-track.backup.YYYYMMDD_HHMMSS /var/www/queen-track
   sudo systemctl reload nginx
   ```

2. **Emergency Maintenance Mode**:
   ```bash
   # Enable maintenance mode
   sudo cp /var/www/maintenance.html /var/www/queen-track/index.html
   
   # Disable maintenance mode
   # Redeploy application
   ```

## 🔐 Security

### Security Measures

1. **Container Security**:
   - Non-root user execution
   - Minimal base image (Alpine)
   - Regular security updates

2. **Web Security**:
   - Security headers (CSP, HSTS, etc.)
   - Input validation
   - HTTPS enforcement (configure at reverse proxy level)

3. **Access Control**:
   - SSH key-based authentication
   - Limited sudo access
   - Regular access reviews

### Security Updates

1. **Dependency Updates**:
   ```bash
   # Check for vulnerabilities
   npm audit
   
   # Fix vulnerabilities
   npm audit fix
   ```

2. **Base Image Updates**:
   ```bash
   # Rebuild with latest base image
   docker build --no-cache -t queen-track-frontend .
   ```

## 📈 Performance Optimization

### Frontend Optimization

1. **Build Optimization**:
   - Code splitting enabled
   - Asset compression (gzip)
   - Cache headers configured

2. **Runtime Optimization**:
   - Lazy loading components
   - Memoization where appropriate
   - Optimized bundle sizes

### Infrastructure Optimization

1. **Nginx Configuration**:
   - Gzip compression enabled
   - Static asset caching
   - Connection pooling

2. **Docker Optimization**:
   - Multi-stage builds
   - Minimal image size
   - Efficient layer caching

## 🔄 Scaling

### Horizontal Scaling

1. **Load Balancer Setup**:
   ```nginx
   upstream queen_track_frontend {
       server 127.0.0.1:3000;
       server 127.0.0.1:3001;
       server 127.0.0.1:3002;
   }
   ```

2. **Multiple Container Instances**:
   ```bash
   # Run multiple containers
   docker run -d --name frontend-1 -p 3000:3000 queen-track-frontend
   docker run -d --name frontend-2 -p 3001:3000 queen-track-frontend
   docker run -d --name frontend-3 -p 3002:3000 queen-track-frontend
   ```

### Vertical Scaling

1. **Resource Limits**:
   ```bash
   # Run with resource limits
   docker run -d \
     --name queen-track-frontend \
     --memory="1g" \
     --cpus="1.0" \
     -p 3000:3000 \
     queen-track-frontend
   ```

## 📞 Support and Contacts

- **Development Team**: [Your team email]
- **System Administrator**: [Admin email]
- **Emergency Contact**: [Emergency phone/email]

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Last Updated**: $(date)
**Version**: 1.0
**Environment**: Production 