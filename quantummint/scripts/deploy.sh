#!/bin/bash

# QuantumMint Platform Deployment Script
set -e

echo "🚀 Starting QuantumMint Platform Deployment..."

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

# Create environment file if it doesn't exist
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        if [ -f .env.docker.example ]; then
            cp .env.docker.example .env
            print_warning "Created .env file from .env.docker.example"
            print_warning "Please update the .env file with your actual configuration values"
        else
            print_error ".env.docker.example file not found"
            exit 1
        fi
    else
        print_success "Environment file already exists"
    fi
}

# Build and start services
deploy_services() {
    print_status "Building and starting services..."
    
    # Stop any running containers
    print_status "Stopping existing containers..."
    docker-compose down --remove-orphans
    
    # Build images
    print_status "Building Docker images..."
    docker-compose build --no-cache
    
    # Start services
    print_status "Starting services..."
    docker-compose up -d
    
    print_success "Services started successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for database services
    print_status "Waiting for MongoDB..."
    until docker-compose exec mongodb mongosh --eval "print('MongoDB is ready')" &>/dev/null; do
        sleep 2
    done
    
    print_status "Waiting for Redis..."
    until docker-compose exec redis redis-cli ping &>/dev/null; do
        sleep 2
    done
    
    print_status "Waiting for RabbitMQ..."
    until docker-compose exec rabbitmq rabbitmqctl status &>/dev/null; do
        sleep 2
    done
    
    # Wait for application services
    services=("api-gateway" "auth-service" "money-generation" "transaction-service" "payment-integration" "kyc-service")
    
    for service in "${services[@]}"; do
        print_status "Waiting for $service..."
        until docker-compose exec $service curl -f http://localhost:$(docker-compose port $service | cut -d: -f2)/health &>/dev/null; do
            sleep 3
        done
    done
    
    print_success "All services are ready"
}

# Run database migrations/initialization
initialize_database() {
    print_status "Initializing database..."
    
    # Create database indexes and initial data
    docker-compose exec mongodb mongosh quantummint --eval "
        // Create indexes for better performance
        db.users.createIndex({ email: 1 }, { unique: true });
        db.transactions.createIndex({ userId: 1, createdAt: -1 });
        db.transactions.createIndex({ transactionId: 1 }, { unique: true });
        db.balances.createIndex({ userId: 1 }, { unique: true });
        db.payments.createIndex({ userId: 1, createdAt: -1 });
        db.kycprofiles.createIndex({ userId: 1 }, { unique: true });
        db.documents.createIndex({ userId: 1, profileId: 1 });
        db.verifications.createIndex({ userId: 1, profileId: 1 });
        
        print('Database indexes created successfully');
    "
    
    print_success "Database initialized"
}

# Display deployment information
show_deployment_info() {
    print_success "🎉 QuantumMint Platform deployed successfully!"
    echo ""
    echo "📋 Service Information:"
    echo "  Frontend:              http://localhost"
    echo "  API Gateway:           http://localhost:3000"
    echo "  Auth Service:          http://localhost:3001"
    echo "  Money Generation:      http://localhost:3002"
    echo "  Transaction Service:   http://localhost:3003"
    echo "  Payment Integration:   http://localhost:3004"
    echo "  KYC Service:           http://localhost:3005"
    echo ""
    echo "🗄️  Database Services:"
    echo "  MongoDB:               mongodb://localhost:27017"
    echo "  Redis:                 redis://localhost:6379"
    echo "  RabbitMQ Management:   http://localhost:15672"
    echo ""
    echo "📊 Monitoring:"
    echo "  View logs:             docker-compose logs -f [service-name]"
    echo "  Check status:          docker-compose ps"
    echo "  Stop services:         docker-compose down"
    echo ""
    print_warning "Don't forget to update your .env file with production values!"
}

# Main deployment process
main() {
    echo "========================================"
    echo "    QuantumMint Platform Deployment"
    echo "========================================"
    echo ""
    
    check_dependencies
    setup_environment
    deploy_services
    wait_for_services
    initialize_database
    show_deployment_info
    
    print_success "Deployment completed successfully! 🚀"
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
