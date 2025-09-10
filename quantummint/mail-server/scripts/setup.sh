#!/bin/bash

# QuantumMint Mail Server Setup Script
# This script sets up the mail server environment and dependencies

set -e

echo "🚀 Setting up QuantumMint Mail Server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check system requirements
print_status "Checking system requirements..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v) ✓"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_status "npm version: $(npm -v) ✓"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    print_warning "MongoDB is not installed locally. Using Docker container is recommended."
else
    print_status "MongoDB found ✓"
fi

# Check Redis
if ! command -v redis-server &> /dev/null; then
    print_warning "Redis is not installed locally. Using Docker container is recommended."
else
    print_status "Redis found ✓"
fi

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p logs certs keys/dkim data backups

# Set proper permissions
chmod 700 keys/dkim
chmod 755 logs data backups
chmod 750 certs

print_status "Directory structure created ✓"

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

print_status "Dependencies installed ✓"

# Generate environment file
if [ ! -f .env ]; then
    print_status "Creating environment configuration..."
    cp .env.example .env
    
    # Generate secure secrets
    JWT_SECRET=$(openssl rand -hex 32)
    API_KEY_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    
    # Update .env file with generated secrets
    sed -i "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/" .env
    sed -i "s/your-api-key-secret-change-this/$API_KEY_SECRET/" .env
    sed -i "s/your-32-character-encryption-key-here/$ENCRYPTION_KEY/" .env
    
    print_status "Environment file created with secure secrets ✓"
else
    print_warning "Environment file already exists. Skipping creation."
fi

# Generate TLS certificates
if [ ! -f certs/private.key ] || [ ! -f certs/certificate.crt ]; then
    print_status "Generating self-signed TLS certificates..."
    
    openssl req -x509 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.crt \
        -days 365 -nodes \
        -subj "/C=US/ST=CA/L=San Francisco/O=QuantumMint/CN=mail.quantummint.com" \
        -addext "subjectAltName=DNS:mail.quantummint.com,DNS:webmail.quantummint.com,DNS:localhost,IP:127.0.0.1"
    
    chmod 600 certs/private.key
    chmod 644 certs/certificate.crt
    
    print_status "TLS certificates generated ✓"
    print_warning "Self-signed certificates are for development only. Use proper certificates in production."
else
    print_status "TLS certificates already exist ✓"
fi

# Generate DKIM keys
print_status "Generating DKIM keys..."
mkdir -p keys/dkim/quantummint.com

if [ ! -f keys/dkim/quantummint.com/quantum.private ]; then
    openssl genrsa -out keys/dkim/quantummint.com/quantum.private 2048
    openssl rsa -in keys/dkim/quantummint.com/quantum.private -pubout -out keys/dkim/quantummint.com/quantum.public
    
    chmod 600 keys/dkim/quantummint.com/quantum.private
    chmod 644 keys/dkim/quantummint.com/quantum.public
    
    print_status "DKIM keys generated ✓"
    
    # Display DKIM public key for DNS setup
    echo ""
    print_status "DKIM Public Key for DNS (TXT record: quantum._domainkey.quantummint.com):"
    echo "v=DKIM1; k=rsa; p=$(grep -v '^-' keys/dkim/quantummint.com/quantum.public | tr -d '\n')"
    echo ""
else
    print_status "DKIM keys already exist ✓"
fi

# Check Docker installation for optional services
if command -v docker &> /dev/null; then
    print_status "Docker found. You can use docker-compose for easy deployment ✓"
    
    if command -v docker-compose &> /dev/null || command -v docker compose &> /dev/null; then
        print_status "Docker Compose found ✓"
        echo ""
        print_status "To start with Docker Compose:"
        echo "  docker-compose up -d"
        echo ""
    fi
else
    print_warning "Docker not found. Manual service installation required for MongoDB, Redis, etc."
fi

# Create systemd service file (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    print_status "Creating systemd service file..."
    
    cat > quantummail.service << EOF
[Unit]
Description=QuantumMint Mail Server
After=network.target mongod.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    print_status "Systemd service file created: quantummail.service"
    echo "To install: sudo cp quantummail.service /etc/systemd/system/"
    echo "To enable: sudo systemctl enable quantummail"
    echo "To start: sudo systemctl start quantummail"
    echo ""
fi

# Display DNS setup information
print_status "DNS Setup Required:"
echo "Add these DNS records to your domain:"
echo ""
echo "MX Record:"
echo "  quantummint.com MX 10 mail.quantummint.com"
echo ""
echo "A Records:"
echo "  mail.quantummint.com A [YOUR_SERVER_IP]"
echo "  webmail.quantummint.com A [YOUR_SERVER_IP]"
echo ""
echo "SPF Record:"
echo "  quantummint.com TXT \"v=spf1 ip4:[YOUR_SERVER_IP] ~all\""
echo ""
echo "DMARC Record:"
echo "  _dmarc.quantummint.com TXT \"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@quantummint.com\""
echo ""

# Display next steps
print_status "Setup completed successfully! 🎉"
echo ""
echo "Next steps:"
echo "1. Update .env file with your specific configuration"
echo "2. Set up MongoDB and Redis (or use Docker Compose)"
echo "3. Configure DNS records for your domain"
echo "4. Update TLS certificates for production use"
echo "5. Start the mail server: npm start"
echo ""
echo "For development: npm run dev"
echo "For production with Docker: docker-compose up -d"
echo ""
print_warning "Remember to change default passwords and secure your installation!"

exit 0
