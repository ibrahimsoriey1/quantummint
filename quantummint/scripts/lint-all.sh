#!/bin/bash

# Lint All Services Script for QuantumMint Platform
# This script runs ESLint for all backend services and frontend

set -e

echo "🔍 Running QuantumMint Platform Linting"
echo "======================================="

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

# Function to run linting for a service
run_service_lint() {
    local service_name=$1
    local service_path=$2
    local fix_mode=$3
    
    print_status "Linting $service_name..."
    
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
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies for $service_name..."
        npm install
    fi
    
    # Run linting
    if [ "$fix_mode" = "fix" ]; then
        if npm run lint:fix; then
            print_success "$service_name linting completed with fixes ✅"
        else
            print_error "$service_name linting failed ❌"
            LINT_FAILURES=$((LINT_FAILURES + 1))
        fi
    else
        if npm run lint; then
            print_success "$service_name linting passed ✅"
        else
            print_error "$service_name linting failed ❌"
            LINT_FAILURES=$((LINT_FAILURES + 1))
        fi
    fi
    
    cd - > /dev/null
}

# Initialize lint failure counter
LINT_FAILURES=0

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if fix mode is requested
FIX_MODE=""
if [ "$1" = "--fix" ]; then
    FIX_MODE="fix"
    print_status "Running in fix mode - automatically fixing issues where possible"
fi

echo "Project root: $PROJECT_ROOT"
echo ""

# Lint backend services
print_status "Linting Backend Services..."
echo "---------------------------"

run_service_lint "API Gateway" "$PROJECT_ROOT/api-gateway" "$FIX_MODE"
run_service_lint "Auth Service" "$PROJECT_ROOT/auth-service" "$FIX_MODE"
run_service_lint "Transaction Service" "$PROJECT_ROOT/transaction-service" "$FIX_MODE"
run_service_lint "Payment Integration" "$PROJECT_ROOT/payment-integration" "$FIX_MODE"
run_service_lint "KYC Service" "$PROJECT_ROOT/kyc-service" "$FIX_MODE"
run_service_lint "Money Generation" "$PROJECT_ROOT/money-generation" "$FIX_MODE"

echo ""

# Lint frontend
print_status "Linting Frontend..."
echo "-------------------"

run_service_lint "Frontend" "$PROJECT_ROOT/frontend" "$FIX_MODE"

echo ""

# Summary
echo "Lint Summary"
echo "============"

if [ $LINT_FAILURES -eq 0 ]; then
    print_success "All linting checks passed! 🎉"
    echo ""
    echo "✅ API Gateway"
    echo "✅ Auth Service"
    echo "✅ Transaction Service"
    echo "✅ Payment Integration"
    echo "✅ KYC Service"
    echo "✅ Money Generation"
    echo "✅ Frontend"
else
    print_error "$LINT_FAILURES service(s) have linting issues"
    echo ""
    print_status "Run with --fix flag to automatically fix issues where possible:"
    echo "  ./scripts/lint-all.sh --fix"
    exit 1
fi

echo ""
print_status "Linting completed successfully!"
