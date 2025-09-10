#!/bin/bash

# Test All Services Script for QuantumMint Platform
# This script runs all tests for backend services and frontend

set -e

echo "🧪 Running QuantumMint Platform Tests"
echo "===================================="

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

# Function to run tests for a service
run_service_tests() {
    local service_name=$1
    local service_path=$2
    
    print_status "Testing $service_name..."
    
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
    
    # Run tests
    if npm test; then
        print_success "$service_name tests passed ✅"
    else
        print_error "$service_name tests failed ❌"
        TEST_FAILURES=$((TEST_FAILURES + 1))
    fi
    
    cd - > /dev/null
}

# Initialize test failure counter
TEST_FAILURES=0

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Project root: $PROJECT_ROOT"
echo ""

# Test backend services
print_status "Testing Backend Services..."
echo "----------------------------"

run_service_tests "API Gateway" "$PROJECT_ROOT/api-gateway"
run_service_tests "Auth Service" "$PROJECT_ROOT/auth-service"
run_service_tests "Transaction Service" "$PROJECT_ROOT/transaction-service"
run_service_tests "Payment Integration" "$PROJECT_ROOT/payment-integration"
run_service_tests "KYC Service" "$PROJECT_ROOT/kyc-service"
run_service_tests "Money Generation" "$PROJECT_ROOT/money-generation"

echo ""

# Test frontend
print_status "Testing Frontend..."
echo "-------------------"

run_service_tests "Frontend" "$PROJECT_ROOT/frontend"

echo ""

# Generate coverage report if requested
if [ "$1" = "--coverage" ]; then
    print_status "Generating coverage reports..."
    echo "------------------------------"
    
    # Run coverage for each service
    for service in api-gateway auth-service transaction-service payment-integration kyc-service money-generation; do
        if [ -d "$PROJECT_ROOT/$service" ]; then
            print_status "Generating coverage for $service..."
            cd "$PROJECT_ROOT/$service"
            npm run test:coverage || true
            cd - > /dev/null
        fi
    done
    
    # Frontend coverage
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        print_status "Generating coverage for frontend..."
        cd "$PROJECT_ROOT/frontend"
        npm run test:coverage || true
        cd - > /dev/null
    fi
fi

# Summary
echo ""
echo "Test Summary"
echo "============"

if [ $TEST_FAILURES -eq 0 ]; then
    print_success "All tests passed! 🎉"
    echo ""
    echo "✅ API Gateway"
    echo "✅ Auth Service"
    echo "✅ Transaction Service"
    echo "✅ Payment Integration"
    echo "✅ KYC Service"
    echo "✅ Money Generation"
    echo "✅ Frontend"
else
    print_error "$TEST_FAILURES test suite(s) failed"
    exit 1
fi

echo ""
print_status "Test execution completed successfully!"
