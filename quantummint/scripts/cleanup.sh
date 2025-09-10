#!/bin/bash

# QuantumMint Platform Cleanup Script
set -e

echo "🧹 QuantumMint Platform Cleanup Script"

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

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --containers    Stop and remove all containers"
    echo "  --images        Remove all QuantumMint images"
    echo "  --volumes       Remove all volumes (WARNING: This will delete all data!)"
    echo "  --networks      Remove custom networks"
    echo "  --all           Complete cleanup (containers, images, volumes, networks)"
    echo "  --logs          Clear all log files"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --containers          # Stop and remove containers only"
    echo "  $0 --images --volumes    # Remove images and volumes"
    echo "  $0 --all                 # Complete cleanup"
}

# Stop and remove containers
cleanup_containers() {
    print_status "Stopping and removing containers..."
    
    # Stop all services
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    
    # Remove any remaining QuantumMint containers
    containers=$(docker ps -a --filter "name=quantummint" --format "{{.ID}}" 2>/dev/null || true)
    if [ ! -z "$containers" ]; then
        docker rm -f $containers
        print_success "Removed QuantumMint containers"
    else
        print_status "No QuantumMint containers found"
    fi
}

# Remove images
cleanup_images() {
    print_status "Removing QuantumMint images..."
    
    # Remove QuantumMint images
    images=$(docker images --filter "reference=quantummint*" --format "{{.ID}}" 2>/dev/null || true)
    if [ ! -z "$images" ]; then
        docker rmi -f $images
        print_success "Removed QuantumMint images"
    else
        print_status "No QuantumMint images found"
    fi
    
    # Remove dangling images
    dangling=$(docker images -f "dangling=true" -q 2>/dev/null || true)
    if [ ! -z "$dangling" ]; then
        docker rmi $dangling
        print_success "Removed dangling images"
    fi
}

# Remove volumes
cleanup_volumes() {
    print_warning "This will permanently delete all database data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Removing volumes..."
        
        # Remove named volumes
        volumes=$(docker volume ls --filter "name=quantummint" --format "{{.Name}}" 2>/dev/null || true)
        if [ ! -z "$volumes" ]; then
            docker volume rm $volumes
            print_success "Removed QuantumMint volumes"
        else
            print_status "No QuantumMint volumes found"
        fi
        
        # Remove dangling volumes
        dangling_volumes=$(docker volume ls -f "dangling=true" -q 2>/dev/null || true)
        if [ ! -z "$dangling_volumes" ]; then
            docker volume rm $dangling_volumes
            print_success "Removed dangling volumes"
        fi
    else
        print_status "Volume cleanup cancelled"
    fi
}

# Remove networks
cleanup_networks() {
    print_status "Removing custom networks..."
    
    # Remove QuantumMint networks
    networks=$(docker network ls --filter "name=quantummint" --format "{{.ID}}" 2>/dev/null || true)
    if [ ! -z "$networks" ]; then
        docker network rm $networks 2>/dev/null || true
        print_success "Removed QuantumMint networks"
    else
        print_status "No QuantumMint networks found"
    fi
}

# Clear log files
cleanup_logs() {
    print_status "Clearing log files..."
    
    services=("api-gateway" "auth-service" "money-generation" "transaction-service" "payment-integration" "kyc-service")
    
    for service in "${services[@]}"; do
        if [ -d "$service/logs" ]; then
            rm -rf "$service/logs"/*
            print_status "Cleared logs for $service"
        fi
    done
    
    print_success "Log files cleared"
}

# Complete cleanup
complete_cleanup() {
    print_warning "This will perform a complete cleanup of the QuantumMint platform!"
    print_warning "All containers, images, volumes, and data will be removed!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_containers
        cleanup_images
        cleanup_volumes
        cleanup_networks
        cleanup_logs
        
        # Docker system prune
        print_status "Running Docker system prune..."
        docker system prune -f
        
        print_success "Complete cleanup finished!"
    else
        print_status "Complete cleanup cancelled"
    fi
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --containers)
            cleanup_containers
            shift
            ;;
        --images)
            cleanup_images
            shift
            ;;
        --volumes)
            cleanup_volumes
            shift
            ;;
        --networks)
            cleanup_networks
            shift
            ;;
        --logs)
            cleanup_logs
            shift
            ;;
        --all)
            complete_cleanup
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

print_success "Cleanup operations completed!"
