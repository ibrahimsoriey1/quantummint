#!/bin/bash

# Install All Dependencies Script for QuantumMint Platform
# This script installs dependencies for all services

set -e

echo "📦 Installing QuantumMint Platform Dependencies"
echo "==============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to install dependencies for a service
install_service_deps() {
    local service_name=$1
    local service_path=$2
    
    print_status "Installing dependencies for $service_name..."
    
    if [ ! -d "$service_path" ]; then
        print_warning "$service_name directory not found, skipping..."
        return 0
    fi
    
    cd "$service_path"
    
    if [ ! -f "package.json" ]; then
        print_warning "$service_name package.json not found, skipping..."
        cd - > /dev/null
        return 0
    fi
    
    # Install dependencies
    if npm install; then
        print_success "$service_name dependencies installed ✅"
    else
        print_error "$service_name dependency installation failed ❌"
        INSTALL_FAILURES=$((INSTALL_FAILURES + 1))
    fi
    
    cd - > /dev/null
}

# Initialize install failure counter
INSTALL_FAILURES=0

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Project root: $PROJECT_ROOT"
echo ""

# Check Node.js version
print_status "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js version: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 18+ to continue."
    exit 1
fi

# Check npm version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm version: $NPM_VERSION"
else
    print_error "npm is not installed. Please install npm to continue."
    exit 1
fi

echo ""

# Install shared dependencies first
print_status "Installing Shared Dependencies..."
echo "--------------------------------"
install_service_deps "Shared" "$PROJECT_ROOT/shared"

echo ""

# Install backend service dependencies
print_status "Installing Backend Service Dependencies..."
echo "----------------------------------------"

install_service_deps "API Gateway" "$PROJECT_ROOT/api-gateway"
install_service_deps "Auth Service" "$PROJECT_ROOT/auth-service"
install_service_deps "Transaction Service" "$PROJECT_ROOT/transaction-service"
install_service_deps "Payment Integration" "$PROJECT_ROOT/payment-integration"
install_service_deps "KYC Service" "$PROJECT_ROOT/kyc-service"
install_service_deps "Money Generation" "$PROJECT_ROOT/money-generation"

echo ""

# Install frontend dependencies
print_status "Installing Frontend Dependencies..."
echo "----------------------------------"
install_service_deps "Frontend" "$PROJECT_ROOT/frontend"

echo ""

# Install root dependencies
print_status "Installing Root Dependencies..."
echo "------------------------------"
cd "$PROJECT_ROOT"
if npm install; then
    print_success "Root dependencies installed ✅"
else
    print_error "Root dependency installation failed ❌"
    INSTALL_FAILURES=$((INSTALL_FAILURES + 1))
fi

echo ""

# Summary
echo "Installation Summary"
echo "==================="

if [ $INSTALL_FAILURES -eq 0 ]; then
    print_success "All dependencies installed successfully! 🎉"
    echo ""
    echo "✅ Shared"
    echo "✅ API Gateway"
    echo "✅ Auth Service"
    echo "✅ Transaction Service"
    echo "✅ Payment Integration"
    echo "✅ KYC Service"
    echo "✅ Money Generation"
    echo "✅ Frontend"
    echo "✅ Root"
    echo ""
    print_status "Next steps:"
    echo "1. Copy .env.development.example to .env.development and configure"
    echo "2. Run 'npm run dev' to start development environment"
    echo "3. Run 'npm run test:all' to run all tests"
else
    print_error "$INSTALL_FAILURES service(s) failed to install dependencies"
    exit 1
fi

echo ""
print_status "Installation completed successfully!"
