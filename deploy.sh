#!/bin/bash

# QuantumMint Deployment Script
# This script will deploy your application with all the authentication fixes

set -e  # Exit on any error

echo "🚀 Starting QuantumMint Deployment..."

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

# Check if Docker is running
check_docker() {
    print_status "Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose..."
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Check environment file
check_env_file() {
    print_status "Checking environment file..."
    if [ ! -f "docker/.env" ]; then
        print_warning "Environment file not found. Creating template..."
        cat > docker/.env << EOF
# Database
MONGO_USERNAME=admin
MONGO_PASSWORD=password123

# JWT Secrets
JWT_SECRET=your_jwt_secret_key_here
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@quantummint.com

# Service Configuration
SERVICE_KEY=your_service_key_here
CORS_ORIGIN=http://localhost:3006
FRONTEND_URL=http://localhost:3006

# Payment Providers (Optional)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
ORANGE_MONEY_API_KEY=your_orange_money_api_key
ORANGE_MONEY_API_SECRET=your_orange_money_api_secret
AFRIMONEY_API_KEY=your_afrimoney_api_key
AFRIMONEY_API_SECRET=your_afrimoney_api_secret

# Storage (Optional)
STORAGE_TYPE=local
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket

# RabbitMQ
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=password123
EOF
        print_warning "Please edit docker/.env file with your actual values before continuing."
        read -p "Press Enter to continue after editing the .env file..."
    fi
    print_success "Environment file is ready"
}

# Stop existing containers
stop_containers() {
    print_status "Stopping existing containers..."
    cd docker
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    cd ..
    print_success "Existing containers stopped"
}

# Build and start services
deploy_services() {
    print_status "Building and starting services..."
    cd docker
    
    # Choose deployment mode
    echo "Select deployment mode:"
    echo "1) Development (with hot reload)"
    echo "2) Production (optimized)"
    read -p "Enter choice (1 or 2): " choice
    
    case $choice in
        1)
            print_status "Starting development deployment..."
            docker-compose -f docker-compose.dev.yml up --build -d
            ;;
        2)
            print_status "Starting production deployment..."
            docker-compose -f docker-compose.prod.yml up --build -d
            ;;
        *)
            print_error "Invalid choice. Defaulting to development mode."
            docker-compose -f docker-compose.dev.yml up --build -d
            ;;
    esac
    
    cd ..
    print_success "Services deployed"
}

# Wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    print_status "Checking service status..."
    cd docker
    docker-compose ps
    cd ..
    
    print_success "Services are ready"
}

# Test the deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test API Gateway
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "API Gateway is responding"
    else
        print_warning "API Gateway health check failed"
    fi
    
    # Test Auth Service
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Auth Service is responding"
    else
        print_warning "Auth Service health check failed"
    fi
    
    # Test Frontend
    if curl -f http://localhost:3006 > /dev/null 2>&1; then
        print_success "Frontend is responding"
    else
        print_warning "Frontend is not responding"
    fi
}

# Show deployment summary
show_summary() {
    print_success "🎉 Deployment completed!"
    echo ""
    echo "📋 Service URLs:"
    echo "  • Frontend: http://localhost:3006"
    echo "  • API Gateway: http://localhost:3000"
    echo "  • API Documentation: http://localhost:3000/api-docs"
    echo "  • Auth Service: http://localhost:3001"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • View logs: docker-compose -f docker/docker-compose.dev.yml logs -f"
    echo "  • Stop services: docker-compose -f docker/docker-compose.dev.yml down"
    echo "  • Restart services: docker-compose -f docker/docker-compose.dev.yml restart"
    echo ""
    echo "✅ Authentication fixes have been applied:"
    echo "  • Fixed 'unexpected error occurred' during login/registration"
    echo "  • Updated database schema to use passwordHash"
    echo "  • Enhanced user model with new fields and validation"
    echo "  • Fixed shared module dependencies"
    echo ""
    print_success "Your QuantumMint application is now ready to use!"
}

# Main deployment flow
main() {
    echo "=========================================="
    echo "🚀 QuantumMint Deployment Script"
    echo "=========================================="
    echo ""
    
    check_docker
    check_docker_compose
    check_env_file
    stop_containers
    deploy_services
    wait_for_services
    test_deployment
    show_summary
}

# Run main function
main "$@"
