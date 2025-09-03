#!/bin/bash

# QuantumMint Deployment Script

# Exit on error
set -e

# Display help message
display_help() {
    echo "QuantumMint Deployment Script"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  -e, --environment ENV   Specify environment (dev, staging, prod) [default: dev]"
    echo "  -b, --build             Build containers before starting"
    echo "  -r, --restart           Restart containers"
    echo "  -d, --down              Stop and remove containers"
    echo "  -h, --help              Display this help message"
    echo
}

# Default values
ENVIRONMENT="dev"
BUILD=false
RESTART=false
DOWN=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -e|--environment)
            ENVIRONMENT="$2"
            shift
            shift
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -r|--restart)
            RESTART=true
            shift
            ;;
        -d|--down)
            DOWN=true
            shift
            ;;
        -h|--help)
            display_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            display_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    echo "Error: Invalid environment. Must be one of: dev, staging, prod"
    exit 1
fi

# Set docker-compose file based on environment
if [[ "$ENVIRONMENT" == "dev" ]]; then
    COMPOSE_FILE="docker-compose.dev.yml"
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    COMPOSE_FILE="docker-compose.staging.yml"
else
    COMPOSE_FILE="docker-compose.prod.yml"
fi

# Check if docker-compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Error: Docker Compose file '$COMPOSE_FILE' not found"
    exit 1
fi

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    echo "Warning: .env file not found. Creating from .env.example..."
    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        echo "Created .env file from .env.example. Please update with your actual values."
    else
        echo "Error: .env.example file not found"
        exit 1
    fi
fi

# Stop and remove containers if requested
if [[ "$DOWN" == true ]]; then
    echo "Stopping and removing containers..."
    docker-compose -f "$COMPOSE_FILE" down
    echo "Containers stopped and removed"
    exit 0
fi

# Restart containers if requested
if [[ "$RESTART" == true ]]; then
    echo "Restarting containers..."
    docker-compose -f "$COMPOSE_FILE" restart
    echo "Containers restarted"
    exit 0
fi

# Build and start containers
if [[ "$BUILD" == true ]]; then
    echo "Building and starting containers for environment: $ENVIRONMENT"
    docker-compose -f "$COMPOSE_FILE" up -d --build
else
    echo "Starting containers for environment: $ENVIRONMENT"
    docker-compose -f "$COMPOSE_FILE" up -d
fi

echo "Deployment completed successfully"
