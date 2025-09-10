# QuantumMint Platform Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying the QuantumMint digital money system platform in production environments.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended) or Windows Server 2019+
- **CPU**: Minimum 8 cores, Recommended 16+ cores
- **RAM**: Minimum 16GB, Recommended 32GB+
- **Storage**: Minimum 100GB SSD, Recommended 500GB+ SSD
- **Network**: Static IP address, Domain name configured

### Software Dependencies
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for development)
- Git 2.30+

## Pre-Deployment Checklist

### 1. Environment Configuration 
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Configure all required environment variables
- [ ] Set strong passwords for all services
- [ ] Configure JWT secrets and encryption keys
- [ ] Set up SSL certificates for HTTPS

### 2. Security Configuration 
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS certificates
- [ ] Configure secure database passwords
- [ ] Set up API keys for external services (Stripe, Orange Money, etc.)
- [ ] Configure CORS origins for production domains
- [ ] Enable rate limiting and security headers

### 3. Database Setup 
- [ ] MongoDB cluster configuration
- [ ] Redis cluster setup for caching
- [ ] RabbitMQ cluster for message queuing
- [ ] Database backup strategy
- [ ] Data retention policies

### 4. Service Dependencies 
- [ ] Domain Controller service configured
- [ ] Mail Server service configured
- [ ] All 8 backend services tested
- [ ] Frontend React application built
- [ ] API Gateway routing configured

## Deployment Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/quantummint.git
cd quantummint
```

### Step 2: Environment Setup
```bash
# Copy production environment file
cp .env.production.example .env.production

# Edit environment variables
nano .env.production
```

### Step 3: SSL Certificate Setup
```bash
# Create SSL directory
mkdir -p ssl/

# Copy your SSL certificates
cp your-domain.crt ssl/
cp your-domain.key ssl/
cp ca-bundle.crt ssl/
```

### Step 4: Build and Deploy
```bash
# Build all services
docker-compose -f docker-compose.yml build

# Start infrastructure services first
docker-compose up -d mongodb redis rabbitmq

# Wait for infrastructure to be ready (30-60 seconds)
sleep 60

# Start backend services
docker-compose up -d api-gateway auth-service transaction-service payment-integration kyc-service money-generation domain-controller mail-server

# Start frontend
docker-compose up -d frontend
```

### Step 5: Verify Deployment
```bash
# Check all services are running
docker-compose ps

# Check service health
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:8080/health
curl http://localhost:3006/health
```

## Service Configuration

### API Gateway (Port 3000)
- **Purpose**: Main entry point, request routing, rate limiting
- **Dependencies**: All backend services
- **Health Check**: `GET /health`

### Auth Service (Port 3001)
- **Purpose**: User authentication, JWT management, 2FA
- **Dependencies**: MongoDB, Redis, Mail Server
- **Health Check**: `GET /health`

### Transaction Service (Port 3003)
- **Purpose**: Transaction processing, balance management
- **Dependencies**: MongoDB, Redis, RabbitMQ
- **Health Check**: `GET /health`

### Payment Integration (Port 3004)
- **Purpose**: External payment provider integration
- **Dependencies**: MongoDB, Redis, Stripe API, Orange Money API
- **Health Check**: `GET /health`

### KYC Service (Port 3005)
- **Purpose**: Know Your Customer verification
- **Dependencies**: MongoDB, Redis, External KYC APIs
- **Health Check**: `GET /health`

### Money Generation (Port 3002)
- **Purpose**: Digital money creation and management
- **Dependencies**: MongoDB, Redis, RabbitMQ
- **Health Check**: `GET /health`

### Domain Controller (Port 8080)
- **Purpose**: LDAP directory, Kerberos auth, DNS services
- **Dependencies**: MongoDB, Redis
- **Ports**: 8080 (Web), 389 (LDAP), 636 (LDAPS), 88 (Kerberos), 53 (DNS)
- **Health Check**: `GET /health`

### Mail Server (Port 3006)
- **Purpose**: Email services, SMTP/IMAP/POP3
- **Dependencies**: MongoDB, Redis, Domain Controller
- **Ports**: 3006 (Web), 25/587/465 (SMTP), 143/993 (IMAP), 110/995 (POP3)
- **Health Check**: `GET /health`

### Frontend (Port 80/443)
- **Purpose**: React web application
- **Dependencies**: API Gateway
- **Health Check**: HTTP 200 on root path

## Monitoring and Logging

### Log Files
- **Location**: `/var/log/quantummint/`
- **Services**: Each service logs to separate files
- **Rotation**: Daily rotation with 30-day retention

### Health Monitoring
```bash
# Monitor all services
./scripts/health-check.sh

# View service logs
docker-compose logs -f [service-name]
```

### Performance Monitoring
- CPU and memory usage monitoring
- Database performance metrics
- API response time monitoring
- Error rate tracking

## Backup and Recovery

### Database Backup
```bash
# MongoDB backup
docker exec quantummint-mongodb mongodump --out /backup/mongodb/$(date +%Y%m%d)

# Redis backup
docker exec quantummint-redis redis-cli BGSAVE
```

### Application Backup
```bash
# Backup configuration files
tar -czf quantummint-config-$(date +%Y%m%d).tar.gz .env.production docker-compose.yml ssl/
```

### Recovery Procedures
1. Stop all services: `docker-compose down`
2. Restore database from backup
3. Restore configuration files
4. Restart services: `docker-compose up -d`

## Scaling Considerations

### Horizontal Scaling
- Load balancer configuration for multiple API Gateway instances
- Database sharding for high transaction volumes
- Redis clustering for cache distribution
- CDN setup for frontend assets

### Vertical Scaling
- Increase container resource limits
- Optimize database queries and indexes
- Implement connection pooling
- Enable service-level caching

## Security Best Practices

### Network Security
- Use private networks for service communication
- Configure firewall rules (only expose necessary ports)
- Enable SSL/TLS for all external communications
- Use VPN for administrative access

### Application Security
- Regular security updates for all dependencies
- Input validation and sanitization
- Rate limiting and DDoS protection
- Regular security audits and penetration testing

### Data Security
- Encrypt sensitive data at rest
- Use strong encryption for data in transit
- Implement proper access controls
- Regular backup encryption verification

## Troubleshooting

### Common Issues

#### Service Won't Start
1. Check Docker logs: `docker-compose logs [service-name]`
2. Verify environment variables
3. Check port conflicts
4. Ensure dependencies are running

#### Database Connection Issues
1. Verify MongoDB is running: `docker-compose ps mongodb`
2. Check connection string in environment variables
3. Verify network connectivity between services
4. Check MongoDB logs for authentication issues

#### Performance Issues
1. Monitor resource usage: `docker stats`
2. Check database query performance
3. Review application logs for errors
4. Verify network latency between services

### Support Contacts
- **Technical Support**: support@quantummint.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.quantummint.com

## Maintenance Schedule

### Daily
- Monitor service health and logs
- Check system resource usage
- Verify backup completion

### Weekly
- Review security logs
- Update system packages
- Performance optimization review

### Monthly
- Security audit and updates
- Capacity planning review
- Disaster recovery testing

---

**Last Updated**: $(date)
**Version**: 1.0.0
**Maintainer**: QuantumMint DevOps Team
