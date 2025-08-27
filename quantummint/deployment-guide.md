# QuantumMint - Deployment Guide

## 1. Overview

This document provides comprehensive instructions for deploying the QuantumMint platform (formerly Digital Money Generation System) to a production environment. It covers server configuration, deployment procedures, database migration, monitoring setup, and post-deployment verification.

## 2. System Requirements

### 2.1 Hardware Requirements

| Component | Minimum Specifications | Recommended Specifications |
|-----------|------------------------|----------------------------|
| Application Servers | 4 CPU cores, 8GB RAM, 50GB SSD | 8 CPU cores, 16GB RAM, 100GB SSD |
| Database Servers | 4 CPU cores, 16GB RAM, 100GB SSD | 8 CPU cores, 32GB RAM, 500GB SSD |
| Redis Servers | 2 CPU cores, 4GB RAM, 20GB SSD | 4 CPU cores, 8GB RAM, 50GB SSD |
| Load Balancers | 2 CPU cores, 4GB RAM | 4 CPU cores, 8GB RAM |

### 2.2 Software Requirements

| Component | Version | Notes |
|-----------|---------|-------|
| Operating System | Ubuntu 22.04 LTS | Other Linux distributions may work but are not officially supported |
| Node.js | 20.x | Required for application servers |
| PostgreSQL | 15.x | Primary database |
| Redis | 7.x | Used for caching and session management |
| NGINX | 1.24.x | Used as reverse proxy and load balancer |
| Docker | 24.x | Used for containerization |
| Docker Compose | 2.x | Used for container orchestration |

### 2.3 Network Requirements

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| HTTP | 80 | TCP | Redirects to HTTPS |
| HTTPS | 443 | TCP | Primary application access |
| PostgreSQL | 5432 | TCP | Database access (internal only) |
| Redis | 6379 | TCP | Cache access (internal only) |
| SSH | 22 | TCP | Server administration (restricted access) |

## 3. Infrastructure Setup

### 3.1 Cloud Provider Recommendations

QuantumMint can be deployed on any major cloud provider:

- **AWS**: EC2 instances with RDS for PostgreSQL
- **Google Cloud**: Compute Engine with Cloud SQL
- **Azure**: Virtual Machines with Azure Database for PostgreSQL
- **Digital Ocean**: Droplets with Managed Databases

### 3.2 Infrastructure as Code

Infrastructure can be provisioned using:

- Terraform scripts (recommended)
- AWS CloudFormation
- Google Cloud Deployment Manager
- Azure Resource Manager templates

Example Terraform configuration files are available in the `/deployment/terraform` directory.

### 3.3 Network Configuration

1. Set up a Virtual Private Cloud (VPC) with private and public subnets
2. Place application servers and databases in private subnets
3. Place load balancers in public subnets
4. Configure security groups to restrict access:
   - Allow HTTPS (443) from anywhere to load balancers
   - Allow application traffic only between application servers and load balancers
   - Allow database traffic only between application servers and database servers

## 4. Deployment Preparation

### 4.1 Environment Configuration

Create environment-specific configuration files:

1. Copy the template from `/deployment/config/env.template.json`
2. Create environment-specific files:
   - `/deployment/config/env.production.json`
   - `/deployment/config/env.staging.json`
3. Update the configuration values for each environment

Example production configuration:

```json
{
  "environment": "production",
  "database": {
    "host": "quantummint-db.internal",
    "port": 5432,
    "name": "quantummint_prod",
    "user": "quantummint_user"
  },
  "redis": {
    "host": "quantummint-redis.internal",
    "port": 6379
  },
  "api": {
    "baseUrl": "https://api.quantummint.com/v1",
    "port": 3000,
    "rateLimit": {
      "standard": 100,
      "premium": 500,
      "enterprise": 1000
    }
  },
  "security": {
    "encryptionKey": "REPLACE_WITH_SECURE_KEY",
    "jwtSecret": "REPLACE_WITH_JWT_SECRET",
    "cookieSecret": "REPLACE_WITH_COOKIE_SECRET"
  },
  "payment": {
    "orangeMoney": {
      "apiKey": "REPLACE_WITH_ORANGE_MONEY_API_KEY",
      "apiSecret": "REPLACE_WITH_ORANGE_MONEY_API_SECRET",
      "webhookSecret": "REPLACE_WITH_ORANGE_MONEY_WEBHOOK_SECRET"
    },
    "afriMoney": {
      "apiKey": "REPLACE_WITH_AFRIMONEY_API_KEY",
      "apiSecret": "REPLACE_WITH_AFRIMONEY_API_SECRET",
      "webhookSecret": "REPLACE_WITH_AFRIMONEY_WEBHOOK_SECRET"
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

### 4.2 Secret Management

Store sensitive information using a secure secret management solution:

- **AWS**: AWS Secrets Manager
- **Google Cloud**: Google Secret Manager
- **Azure**: Azure Key Vault
- **Hashicorp Vault**: Self-hosted option

Configure the application to retrieve secrets at runtime rather than storing them in configuration files.

### 4.3 SSL Certificate Setup

1. Obtain SSL certificates for your domains:
   - `quantummint.com`
   - `api.quantummint.com`
   - `www.quantummint.com`
   - `admin.quantummint.com`

2. Options for SSL certificates:
   - Let's Encrypt (free, automated renewal)
   - Commercial SSL provider
   - Cloud provider's certificate service

3. Configure certificates in your load balancer or reverse proxy

## 5. Database Setup

### 5.1 Database Initialization

1. Create the PostgreSQL database:

```sql
CREATE DATABASE quantummint_prod;
CREATE USER quantummint_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE quantummint_prod TO quantummint_user;
```

2. Configure database parameters:

```sql
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET synchronous_commit = 'off';
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
```

3. Restart PostgreSQL to apply changes

### 5.2 Database Migration

1. Run the migration script:

```bash
cd /path/to/quantummint
NODE_ENV=production npm run db:migrate
```

2. Verify migration success:

```bash
NODE_ENV=production npm run db:status
```

### 5.3 Database Backup Configuration

1. Set up automated backups:

```bash
# Create backup script
cat > /etc/cron.daily/backup-quantummint-db << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/quantummint
mkdir -p $BACKUP_DIR
pg_dump -U quantummint_user -d quantummint_prod -F custom -f $BACKUP_DIR/quantummint_$TIMESTAMP.dump
find $BACKUP_DIR -type f -name "quantummint_*.dump" -mtime +7 -delete
EOF

# Make it executable
chmod +x /etc/cron.daily/backup-quantummint-db
```

2. Configure backup retention policy (adjust as needed)
3. Set up backup verification and monitoring

## 6. Application Deployment

### 6.1 Docker-based Deployment

1. Build the Docker image:

```bash
cd /path/to/quantummint
docker build -t quantummint:latest .
```

2. Push the image to your container registry:

```bash
docker tag quantummint:latest your-registry.com/quantummint:latest
docker push your-registry.com/quantummint:latest
```

3. Deploy using Docker Compose:

```bash
cd /path/to/quantummint/deployment
docker-compose -f docker-compose.production.yml up -d
```

### 6.2 Kubernetes Deployment

1. Apply Kubernetes manifests:

```bash
cd /path/to/quantummint/deployment/kubernetes
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f database.yaml
kubectl apply -f redis.yaml
kubectl apply -f api.yaml
kubectl apply -f web.yaml
kubectl apply -f ingress.yaml
```

2. Verify deployment:

```bash
kubectl get pods -n quantummint
kubectl get services -n quantummint
kubectl get ingress -n quantummint
```

### 6.3 Traditional Deployment

1. Clone the repository:

```bash
git clone https://github.com/your-org/quantummint.git
cd quantummint
```

2. Install dependencies:

```bash
npm install --production
```

3. Build the application:

```bash
npm run build
```

4. Start the application:

```bash
NODE_ENV=production npm start
```

5. Configure process manager (PM2):

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 7. Reverse Proxy and Load Balancing

### 7.1 NGINX Configuration

1. Install NGINX:

```bash
apt-get update
apt-get install -y nginx
```

2. Configure NGINX:

```nginx
# /etc/nginx/sites-available/quantummint.conf

upstream quantummint_api {
    server 127.0.0.1:3000;
    # Add more servers for load balancing
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name api.quantummint.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.quantummint.com;

    ssl_certificate /etc/letsencrypt/live/api.quantummint.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.quantummint.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass http://quantummint_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self';" always;
}
```

3. Enable the configuration:

```bash
ln -s /etc/nginx/sites-available/quantummint.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 7.2 Load Balancer Configuration

If using a cloud provider's load balancer:

1. Create a load balancer
2. Configure health checks:
   - Path: `/health`
   - Protocol: HTTPS
   - Port: 443
   - Interval: 30 seconds
   - Timeout: 5 seconds
   - Healthy threshold: 2
   - Unhealthy threshold: 3
3. Configure SSL termination
4. Set up request routing to your application servers

## 8. Monitoring and Logging

### 8.1 Application Monitoring

1. Set up application performance monitoring:
   - New Relic
   - Datadog
   - Prometheus + Grafana

2. Configure key metrics to monitor:
   - Request rate
   - Error rate
   - Response time
   - CPU and memory usage
   - Database connection pool
   - Redis connection pool

### 8.2 Log Management

1. Configure centralized logging:
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Graylog
   - Cloud provider's logging service

2. Configure log rotation:

```bash
cat > /etc/logrotate.d/quantummint << 'EOF'
/var/log/quantummint/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 quantummint quantummint
    sharedscripts
    postrotate
        systemctl reload quantummint >/dev/null 2>&1 || true
    endscript
}
EOF
```

### 8.3 Alerting

1. Set up alerts for critical conditions:
   - High error rate
   - Slow response time
   - Low disk space
   - High CPU usage
   - Database connection issues
   - Failed health checks

2. Configure notification channels:
   - Email
   - SMS
   - Slack
   - PagerDuty

## 9. Security Configuration

### 9.1 Firewall Setup

1. Configure host-based firewall:

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Allow internal traffic for database and Redis
ufw allow from 10.0.0.0/8 to any port 5432
ufw allow from 10.0.0.0/8 to any port 6379

# Enable firewall
ufw enable
```

2. Configure network-level firewall (security groups)

### 9.2 Security Hardening

1. Disable root SSH access:

```bash
# Edit SSH configuration
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

2. Set up automatic security updates:

```bash
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

3. Install and configure fail2ban:

```bash
apt-get install -y fail2ban
```

### 9.3 Data Protection

1. Enable database encryption:
   - Configure PostgreSQL data-at-rest encryption
   - Use encrypted volumes for database storage

2. Configure application-level encryption:
   - Ensure the encryption service is properly configured
   - Verify encryption key management

## 10. Post-Deployment Verification

### 10.1 Health Check

1. Verify API health endpoint:

```bash
curl -i https://api.quantummint.com/v1/health
```

Expected response:

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-08-21T02:55:40Z"
}
```

2. Verify database connectivity:

```bash
curl -i https://api.quantummint.com/v1/health/db
```

3. Verify Redis connectivity:

```bash
curl -i https://api.quantummint.com/v1/health/redis
```

### 10.2 Functional Testing

1. Run the post-deployment test suite:

```bash
cd /path/to/quantummint
NODE_ENV=production npm run test:e2e
```

2. Verify key functionality:
   - User authentication
   - Money generation
   - Wallet management
   - Transactions
   - Payment provider integration

### 10.3 Performance Testing

1. Run load tests:

```bash
cd /path/to/quantummint
npm run test:load
```

2. Monitor system performance during tests:
   - CPU usage
   - Memory usage
   - Database performance
   - Response times

## 11. Rollback Procedure

In case of deployment issues:

### 11.1 Docker-based Rollback

```bash
# Roll back to previous version
docker-compose -f docker-compose.production.yml down
docker tag your-registry.com/quantummint:previous your-registry.com/quantummint:latest
docker-compose -f docker-compose.production.yml up -d
```

### 11.2 Kubernetes Rollback

```bash
# Roll back deployment
kubectl rollout undo deployment/quantummint-api -n quantummint
kubectl rollout undo deployment/quantummint-web -n quantummint
```

### 11.3 Database Rollback

```bash
# Restore database from backup
pg_restore -U quantummint_user -d quantummint_prod -c /var/backups/quantummint/quantummint_TIMESTAMP.dump
```

## 12. Maintenance Procedures

### 12.1 Routine Updates

1. Schedule regular maintenance windows
2. Follow the update procedure:
   - Deploy to staging environment first
   - Run full test suite
   - Deploy to production during maintenance window
   - Verify deployment success

### 12.2 Database Maintenance

1. Schedule regular database maintenance:

```bash
# Create maintenance script
cat > /etc/cron.weekly/maintain-quantummint-db << 'EOF'
#!/bin/bash
psql -U quantummint_user -d quantummint_prod -c "VACUUM ANALYZE;"
EOF

# Make it executable
chmod +x /etc/cron.weekly/maintain-quantummint-db
```

2. Monitor database performance and optimize as needed

### 12.3 Log Rotation and Cleanup

1. Ensure log rotation is working properly
2. Set up log archiving for long-term storage
3. Configure log retention policies

## 13. Disaster Recovery

### 13.1 Backup Strategy

1. Database backups:
   - Daily full backups
   - Continuous WAL archiving
   - Regular backup testing

2. Configuration backups:
   - Version control for configuration files
   - Regular exports of environment-specific configurations

### 13.2 Recovery Procedure

1. Infrastructure recovery:
   - Provision new infrastructure using IaC
   - Restore configuration from backups

2. Database recovery:
   - Restore from latest backup
   - Apply transaction logs if available

3. Application recovery:
   - Deploy application from container registry
   - Verify application functionality

### 13.3 Recovery Testing

1. Schedule regular recovery drills
2. Document recovery time objectives (RTO) and recovery point objectives (RPO)
3. Improve recovery procedures based on drill results

## 14. Contact Information

### 14.1 Support Team

- **Technical Support**: tech-support@quantummint.com
- **Database Team**: db-team@quantummint.com
- **Security Team**: security@quantummint.com
- **DevOps Team**: devops@quantummint.com

### 14.2 Escalation Path

1. On-call engineer
2. Team lead
3. Engineering manager
4. CTO

### 14.3 Emergency Contacts

- **Primary Contact**: John Doe, Lead DevOps Engineer, +1-555-123-4567
- **Secondary Contact**: Jane Smith, System Administrator, +1-555-765-4321
- **Emergency Hotline**: +1-800-QUANTUM