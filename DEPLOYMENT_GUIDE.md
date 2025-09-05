# QuantumMint Platform - Deployment Guide

## 🚀 **Production Deployment Options**

### **Option 1: Docker Compose (Recommended for Development/Testing)**

#### **Prerequisites:**
- Docker and Docker Compose installed
- At least 4GB RAM available
- Ports 80, 3000-3005, 27017 available

#### **Quick Start:**
```bash
# Clone the repository
git clone <repository-url>
cd quantummint

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

#### **Access the Application:**
- **Frontend**: http://localhost
- **API Gateway**: http://localhost:3000
- **Individual Services**: http://localhost:3001-3005

### **Option 2: Manual Deployment**

#### **Frontend Deployment:**

1. **Build the application:**
```bash
cd frontend
npm install
npm run build
```

2. **Deploy to web server:**
```bash
# Copy build folder to web server
scp -r build/* user@server:/var/www/quantummint/

# Or use nginx
sudo cp -r build/* /usr/share/nginx/html/
```

3. **Configure nginx:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### **Backend Services Deployment:**

1. **Set up environment:**
```bash
# Create deployment directory
mkdir -p /opt/quantummint
cd /opt/quantummint

# Clone repository
git clone <repository-url> .
```

2. **Install dependencies:**
```bash
# Install Node.js dependencies for each service
cd auth-service && npm install --production
cd ../money-generation && npm install --production
cd ../transaction-service && npm install --production
cd ../payment-integration && npm install --production
cd ../kyc-service && npm install --production
cd ../api-gateway && npm install --production
```

3. **Set up MongoDB:**
```bash
# Install MongoDB
sudo apt-get install mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

4. **Configure environment variables:**
```bash
# Copy example environment files
cp auth-service/env.example auth-service/.env
cp money-generation/env.example money-generation/.env
# ... repeat for all services

# Edit environment files with production values
nano auth-service/.env
```

5. **Start services with PM2:**
```bash
# Install PM2
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### **Option 3: Cloud Deployment (AWS/Azure/GCP)**

#### **AWS Deployment:**

1. **Set up EC2 instances:**
```bash
# Launch EC2 instances for each service
# Use t3.medium or larger for production
```

2. **Set up RDS for MongoDB:**
```bash
# Create MongoDB Atlas cluster or use DocumentDB
```

3. **Set up Application Load Balancer:**
```bash
# Configure ALB to route traffic to services
```

4. **Deploy with AWS CodeDeploy:**
```bash
# Set up CI/CD pipeline
# Deploy automatically on code changes
```

## 🔧 **Environment Configuration**

### **Production Environment Variables:**

#### **Auth Service (.env):**
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
EMAIL_SERVICE_API_KEY=your-email-service-key
EMAIL_FROM=noreply@quantummint.com
```

#### **API Gateway (.env):**
```env
NODE_ENV=production
PORT=3000
AUTH_SERVICE_URL=http://auth-service:3001
MONEY_GENERATION_SERVICE_URL=http://money-generation:3002
TRANSACTION_SERVICE_URL=http://transaction-service:3003
PAYMENT_INTEGRATION_SERVICE_URL=http://payment-integration:3004
KYC_SERVICE_URL=http://kyc-service:3005
JWT_SECRET=your-super-secret-jwt-key-change-in-production
CORS_ORIGIN=https://your-domain.com
```

#### **Frontend (.env):**
```env
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_ENVIRONMENT=production
```

## 🛡️ **Security Considerations**

### **Production Security Checklist:**

- [ ] Change all default passwords and secrets
- [ ] Use HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable CORS properly
- [ ] Use environment variables for secrets
- [ ] Set up monitoring and logging
- [ ] Configure backup strategies
- [ ] Enable database authentication
- [ ] Set up intrusion detection

### **SSL Certificate Setup:**
```bash
# Using Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📊 **Monitoring and Logging**

### **Set up monitoring:**
```bash
# Install monitoring tools
npm install -g pm2-logrotate

# Configure log rotation
pm2 install pm2-logrotate
```

### **Health checks:**
```bash
# Check service health
curl http://localhost:3000/health
curl http://localhost:3001/health
# ... repeat for all services
```

## 🔄 **CI/CD Pipeline**

### **GitHub Actions Example:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          # Deploy commands here
```

## 📈 **Performance Optimization**

### **Frontend Optimization:**
- Enable gzip compression
- Use CDN for static assets
- Implement caching strategies
- Optimize bundle size

### **Backend Optimization:**
- Use connection pooling
- Implement caching (Redis)
- Optimize database queries
- Use load balancing

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Services not starting:**
```bash
# Check logs
docker-compose logs service-name

# Check port conflicts
netstat -tulpn | grep :3000
```

2. **Database connection issues:**
```bash
# Check MongoDB status
sudo systemctl status mongodb

# Test connection
mongo --host localhost --port 27017
```

3. **Frontend not loading:**
```bash
# Check nginx configuration
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

## 📞 **Support**

For deployment issues:
1. Check the logs first
2. Verify environment variables
3. Ensure all services are running
4. Check network connectivity
5. Verify database connections

## 🎯 **Production Checklist**

- [ ] All services deployed and running
- [ ] Database configured and accessible
- [ ] SSL certificates installed
- [ ] Environment variables configured
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Security measures in place
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Team trained on deployment process

---

**The QuantumMint platform is now ready for production deployment!** 🚀