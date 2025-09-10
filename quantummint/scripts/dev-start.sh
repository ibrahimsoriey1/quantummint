#!/bin/bash

# QuantumMint Platform Development Environment Startup Script
set -e

echo "🚀 Starting QuantumMint Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Setup development environment
setup_dev_environment() {
    print_status "Setting up development environment..."
    
    # Create .env file for development if it doesn't exist
    if [ ! -f .env ]; then
        if [ -f .env.development.example ]; then
            cp .env.development.example .env
            print_warning "Created .env file from .env.development.example"
        else
            print_error ".env.development.example file not found"
            exit 1
        fi
    fi
    
    # Create logs directories for all services
    services=("api-gateway" "auth-service" "money-generation" "transaction-service" "payment-integration" "kyc-service")
    for service in "${services[@]}"; do
        mkdir -p "$service/logs"
    done
    
    print_success "Development environment setup complete"
}

# Start development services
start_dev_services() {
    print_status "Starting development services..."
    
    # Stop any running containers
    print_status "Stopping existing containers..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans
    
    # Start services in development mode
    print_status "Starting services in development mode..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    
    print_success "Development services started"
}

# Show development information
show_dev_info() {
    print_success "🎉 QuantumMint Development Environment is ready!"
    echo ""
    echo "📋 Development Services:"
    echo "  Frontend (React):      http://localhost:3000"
    echo "  API Gateway:           http://localhost:3000/api"
    echo "  Auth Service:          http://localhost:3001"
    echo "  Money Generation:      http://localhost:3002"
    echo "  Transaction Service:   http://localhost:3003"
    echo "  Payment Integration:   http://localhost:3004"
    echo "  KYC Service:           http://localhost:3005"
    echo ""
    echo "🗄️  Database Services:"
    echo "  MongoDB:               mongodb://localhost:27017"
    echo "  Redis:                 redis://localhost:6379"
    echo "  RabbitMQ Management:   http://localhost:15672 (admin/password123)"
    echo ""
    echo "🛠️  Development Tools:"
    echo "  View logs:             docker-compose logs -f [service-name]"
    echo "  Restart service:       docker-compose restart [service-name]"
    echo "  Stop all:              docker-compose down"
    echo "  Rebuild service:       docker-compose build [service-name]"
    echo ""
    echo "📝 Hot Reloading:"
    echo "  All services are configured with hot reloading"
    echo "  Changes to source code will automatically restart the services"
    echo ""
    print_warning "Development mode uses nodemon for auto-restart on file changes"
}

# Main function
main() {
    echo "========================================"
    echo "   QuantumMint Development Environment"
    echo "========================================"
    echo ""
    
    check_dependencies
    setup_dev_environment
    start_dev_services
    
    # Wait a moment for services to start
    sleep 5
    
    show_dev_info
    
    print_success "Development environment started successfully! 🚀"
    echo ""
    print_status "Use 'docker-compose logs -f' to view real-time logs"
    print_status "Press Ctrl+C to stop all services"
}

# Handle script interruption
trap 'print_error "Development environment stopped"; docker-compose -f docker-compose.yml -f docker-compose.dev.yml down; exit 1' INT TERM

# Run main function
main "$@"
