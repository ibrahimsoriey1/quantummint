#!/bin/bash

# QuantumMint Deployment Script
# This script manages the deployment of the QuantumMint microservices platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
BUILD=false
STOP=false
CLEAN=false
HELP=false

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

# Function to show help
show_help() {
    echo "QuantumMint Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment to deploy (dev, staging, prod) [default: dev]"
    echo "  -b, --build              Build Docker images before starting"
    echo "  -s, --stop               Stop all services"
    echo "  -c, --clean              Clean up containers, images, and volumes"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --environment dev --build    # Deploy dev environment with image building"
    echo "  $0 --environment prod           # Deploy production environment"
    echo "  $0 --stop                       # Stop all services"
    echo "  $0 --clean                      # Clean up everything"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to create environment file
create_env_file() {
    if [ ! -f .env ]; then
        print_status "Creating .env file from template..."
        if [ -f .env.example ]; then
            cp .env.example .env
            print_warning "Please update the .env file with your configuration before proceeding"
        else
            print_error ".env.example file not found"
            exit 1
        fi
    fi
}

# Function to build images
build_images() {
    print_status "Building Docker images..."
    
    # Build all services
    docker-compose build --no-cache
    
    print_success "Images built successfully"
}

# Function to start services
start_services() {
    print_status "Starting QuantumMint services..."
    
    # Start all services
    docker-compose up -d
    
    print_success "Services started successfully"
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Function to check service health
check_service_health() {
    print_status "Checking service health..."
    
    # Check each service
    services=("mongodb" "redis" "rabbitmq" "api-gateway" "auth-service" "money-generation" "transaction-service" "payment-integration" "kyc-service" "frontend")
    
    for service in "${services[@]}"; do
        if docker-compose ps $service | grep -q "Up"; then
            print_success "$service is running"
        else
            print_error "$service is not running"
        fi
    done
}

# Function to stop services
stop_services() {
    print_status "Stopping QuantumMint services..."
    
    docker-compose down
    
    print_success "Services stopped successfully"
}

# Function to clean up
clean_up() {
    print_warning "This will remove all containers, images, and volumes. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up..."
        
        # Stop and remove containers
        docker-compose down -v
        
        # Remove images
        docker-compose down --rmi all
        
        # Remove volumes
        docker volume prune -f
        
        # Remove networks
        docker network prune -f
        
        print_success "Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show service status
show_status() {
    print_status "Service status:"
    docker-compose ps
    
    echo ""
    print_status "Service URLs:"
    echo "  API Gateway: http://localhost:3000"
    echo "  Auth Service: http://localhost:3001"
    echo "  Money Generation: http://localhost:3002"
    echo "  Transaction Service: http://localhost:3003"
    echo "  Payment Integration: http://localhost:3004"
    echo "  KYC Service: http://localhost:3005"
    echo "  Frontend: http://localhost:3006"
    echo "  RabbitMQ Management: http://localhost:15672"
    echo "  Prometheus: http://localhost:9090"
    echo "  Grafana: http://localhost:3007"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for all services..."
    docker-compose logs -f
}

# Function to deploy
deploy() {
    print_status "Deploying QuantumMint to $ENVIRONMENT environment..."
    
    # Check prerequisites
    check_prerequisites
    
    # Create environment file
    create_env_file
    
    # Build images if requested
    if [ "$BUILD" = true ]; then
        build_images
    fi
    
    # Start services
    start_services
    
    # Show status
    show_status
    
    print_success "Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Access the frontend at http://localhost:3006"
    echo "2. Check service health with: $0 --status"
    echo "3. View logs with: $0 --logs"
    echo "4. Stop services with: $0 --stop"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -s|--stop)
            STOP=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            HELP=true
            shift
            ;;
        --status)
            show_status
            exit 0
            ;;
        --logs)
            show_logs
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Show help if requested
if [ "$HELP" = true ]; then
    show_help
    exit 0
fi

# Set environment-specific compose file
if [ "$ENVIRONMENT" = "prod" ]; then
    export COMPOSE_FILE="docker-compose.prod.yml"
elif [ "$ENVIRONMENT" = "staging" ]; then
    export COMPOSE_FILE="docker-compose.staging.yml"
else
    export COMPOSE_FILE="docker-compose.yml"
fi

# Main execution
if [ "$STOP" = true ]; then
    stop_services
elif [ "$CLEAN" = true ]; then
    clean_up
else
    deploy
fi
