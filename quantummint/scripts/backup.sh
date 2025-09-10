#!/bin/bash

# QuantumMint Platform Backup Script
set -e

echo "💾 QuantumMint Platform Backup Script"

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

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="quantummint_backup_${TIMESTAMP}"

# Create backup directory
create_backup_dir() {
    print_status "Creating backup directory..."
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
    print_success "Backup directory created: ${BACKUP_DIR}/${BACKUP_NAME}"
}

# Backup MongoDB
backup_mongodb() {
    print_status "Backing up MongoDB..."
    
    # Check if MongoDB container is running
    if ! docker-compose ps mongodb | grep -q "Up"; then
        print_error "MongoDB container is not running"
        return 1
    fi
    
    # Create MongoDB backup
    docker-compose exec -T mongodb mongodump --db quantummint --out /tmp/backup
    docker-compose exec -T mongodb tar -czf /tmp/mongodb_backup.tar.gz -C /tmp/backup .
    docker cp $(docker-compose ps -q mongodb):/tmp/mongodb_backup.tar.gz "${BACKUP_DIR}/${BACKUP_NAME}/"
    
    print_success "MongoDB backup completed"
}

# Backup Redis
backup_redis() {
    print_status "Backing up Redis..."
    
    # Check if Redis container is running
    if ! docker-compose ps redis | grep -q "Up"; then
        print_error "Redis container is not running"
        return 1
    fi
    
    # Create Redis backup
    docker-compose exec -T redis redis-cli BGSAVE
    sleep 5  # Wait for background save to complete
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "${BACKUP_DIR}/${BACKUP_NAME}/redis_dump.rdb"
    
    print_success "Redis backup completed"
}

# Backup uploaded files
backup_files() {
    print_status "Backing up uploaded files..."
    
    # Check if KYC service container is running
    if docker-compose ps kyc-service | grep -q "Up"; then
        # Copy uploaded files from KYC service
        docker cp $(docker-compose ps -q kyc-service):/app/uploads "${BACKUP_DIR}/${BACKUP_NAME}/uploads" 2>/dev/null || true
        print_success "Uploaded files backup completed"
    else
        print_warning "KYC service not running, skipping file backup"
    fi
}

# Backup configuration files
backup_config() {
    print_status "Backing up configuration files..."
    
    # Copy important configuration files
    cp .env "${BACKUP_DIR}/${BACKUP_NAME}/" 2>/dev/null || true
    cp docker-compose.yml "${BACKUP_DIR}/${BACKUP_NAME}/"
    cp docker-compose.dev.yml "${BACKUP_DIR}/${BACKUP_NAME}/" 2>/dev/null || true
    
    # Copy package.json files
    find . -name "package.json" -not -path "./node_modules/*" -not -path "./**/node_modules/*" -exec cp --parents {} "${BACKUP_DIR}/${BACKUP_NAME}/" \;
    
    print_success "Configuration files backup completed"
}

# Create backup metadata
create_metadata() {
    print_status "Creating backup metadata..."
    
    cat > "${BACKUP_DIR}/${BACKUP_NAME}/backup_info.txt" << EOF
QuantumMint Platform Backup
===========================
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Platform Version: 1.0.0

Services Backed Up:
- MongoDB Database
- Redis Cache
- Uploaded Files
- Configuration Files

Restore Instructions:
1. Stop all services: docker-compose down
2. Restore MongoDB: mongorestore --db quantummint /path/to/backup
3. Restore Redis: Copy redis_dump.rdb to Redis data directory
4. Restore files: Copy uploads directory to KYC service
5. Restore config: Copy .env and docker-compose files
6. Start services: docker-compose up -d

EOF
    
    print_success "Backup metadata created"
}

# Compress backup
compress_backup() {
    print_status "Compressing backup..."
    
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
    rm -rf "${BACKUP_NAME}"
    cd - > /dev/null
    
    print_success "Backup compressed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
}

# Clean old backups (keep last 7 days)
cleanup_old_backups() {
    print_status "Cleaning up old backups..."
    
    find "${BACKUP_DIR}" -name "quantummint_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    
    print_success "Old backups cleaned up"
}

# Show backup information
show_backup_info() {
    print_success "🎉 Backup completed successfully!"
    echo ""
    echo "📋 Backup Information:"
    echo "  Backup File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    echo "  Backup Size: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"
    echo "  Backup Date: $(date)"
    echo ""
    echo "📝 Backup Contents:"
    echo "  ✓ MongoDB Database"
    echo "  ✓ Redis Cache"
    echo "  ✓ Uploaded Files"
    echo "  ✓ Configuration Files"
    echo ""
    echo "🔄 To restore this backup:"
    echo "  1. Extract: tar -xzf ${BACKUP_NAME}.tar.gz"
    echo "  2. Follow instructions in backup_info.txt"
    echo ""
    print_warning "Store this backup in a secure location!"
}

# Main backup function
main() {
    echo "========================================"
    echo "     QuantumMint Platform Backup"
    echo "========================================"
    echo ""
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    create_backup_dir
    backup_mongodb
    backup_redis
    backup_files
    backup_config
    create_metadata
    compress_backup
    cleanup_old_backups
    show_backup_info
    
    print_success "Backup process completed! 💾"
}

# Handle script interruption
trap 'print_error "Backup interrupted"; exit 1' INT TERM

# Run main function
main "$@"
