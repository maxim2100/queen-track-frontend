#!/bin/bash

# Server diagnostic script for Queen Track Frontend
# Usage: ./scripts/diagnose.sh

set -e

SERVER_HOST="162.55.53.52"
SERVER_USER="root"

echo "🔍 Diagnosing Queen Track Frontend deployment issues..."
echo "📍 Server: $SERVER_HOST"
echo ""

# Function to test URL with detailed output
test_url() {
    local url=$1
    local name=$2
    echo "🌐 Testing $name: $url"
    
    # Test with curl and show detailed info
    curl -I --connect-timeout 10 --max-time 30 "$url" 2>&1 | head -10 || {
        echo "❌ Failed to connect to $url"
        
        # Try to get more info about the connection
        echo "🔍 Checking if host is reachable..."
        ping -c 2 "$SERVER_HOST" || echo "Host unreachable"
        
        echo "🔍 Checking if port is open..."
        nc -zv "$SERVER_HOST" "${url##*:}" 2>&1 || echo "Port not reachable"
    }
    echo ""
}

# Function to check server remotely (if we can connect)
check_server() {
    echo "🖥️ Checking server status..."
    
    # Try to get basic server info
    echo "Attempting to connect to server..."
    
    # Since we can't use sshpass on Windows, let's create a simple check
    # The user will need to run this manually on the server or use a different method
    
    cat << 'EOF' > server_check.sh
#!/bin/bash
echo "=== NGINX STATUS ==="
systemctl status nginx --no-pager || service nginx status

echo ""
echo "=== PORTS LISTENING ==="
netstat -tlnp | grep -E ':(3001|3002|80|443)' || ss -tlnp | grep -E ':(3001|3002|80|443)'

echo ""
echo "=== NGINX CONFIGURATION ==="
nginx -T | grep -A 5 -B 5 'listen 300' || echo "No listen 300* found"

echo ""
echo "=== NGINX SITES ENABLED ==="
ls -la /etc/nginx/sites-enabled/

echo ""
echo "=== APPLICATION DIRECTORIES ==="
ls -la /var/www/ | grep queen

echo ""
echo "=== NGINX ERROR LOG ==="
tail -20 /var/log/nginx/error.log || echo "No error log found"

echo ""
echo "=== SYSTEM PORTS ==="
ss -tlnp sport = :3001 or sport = :3002

echo ""
echo "=== FIREWALL STATUS ==="
ufw status || iptables -L | grep -E "(3001|3002)" || echo "No firewall rules found"

echo ""
echo "=== DISK SPACE ==="
df -h /var/www/

echo ""
echo "=== RECENT DEPLOYMENTS ==="
ls -lat /var/www/queen* | head -10
EOF

    echo "📋 Server diagnostic script created: server_check.sh"
    echo "To run this on your server, copy server_check.sh to your server and execute it:"
    echo "scp server_check.sh root@$SERVER_HOST:/tmp/"
    echo "ssh root@$SERVER_HOST 'chmod +x /tmp/server_check.sh && /tmp/server_check.sh'"
}

# Test the applications
test_url "http://$SERVER_HOST:3001/" "Production"
test_url "http://$SERVER_HOST:3002/" "Staging"
test_url "http://$SERVER_HOST:3001/health" "Production Health"
test_url "http://$SERVER_HOST:3002/health" "Staging Health"

# Check for common issues
echo "🔍 Checking for common issues..."

# Test if it's a redirect loop (common with React Router misconfig)
echo "📄 Testing for redirect loops..."
curl -v --max-redirects 5 "http://$SERVER_HOST:3001/" 2>&1 | grep -E "(Location:|HTTP/)" | head -10 || echo "No redirect info available"

echo ""
curl -v --max-redirects 5 "http://$SERVER_HOST:3002/" 2>&1 | grep -E "(Location:|HTTP/)" | head -10 || echo "No redirect info available"

# Generate server diagnostic script
check_server

echo ""
echo "🎯 POSSIBLE CAUSES OF 'PAGE NOT REDIRECTING PROPERLY' ERROR:"
echo "1. ❌ Nginx not running on ports 3001/3002"
echo "2. ❌ Nginx configuration error (try_files issue)" 
echo "3. ❌ React Router configuration issue"
echo "4. ❌ Firewall blocking ports 3001/3002"
echo "5. ❌ Application files not deployed correctly"
echo "6. ❌ Nginx redirect loop in configuration"
echo ""
echo "📝 NEXT STEPS:"
echo "1. Run the server diagnostic script on your server"
echo "2. Check the outputs above for connection errors"
echo "3. Verify Nginx is actually listening on the correct ports"
echo "4. Check if there are any redirect loops in the Nginx config"
echo ""

# Clean up
rm -f server_check.sh 