# QuantumMint Quick Start Guide

Get the QuantumMint digital money generation platform up and running in minutes!

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites Check

Ensure you have the following installed:
- Node.js 14+ (`node --version`)
- npm 6+ (`npm --version`)
- Git (`git --version`)

### 2. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/quantummint.git
cd quantummint

# Install dependencies
npm install
npm run install-all
```

### 3. Start with Docker (Recommended)

```bash
# Navigate to docker directory
cd docker

# Deploy the entire platform
./deploy.sh --environment dev --build
```

### 4. Access the Platform

- **Frontend**: http://localhost:3006
- **API Gateway**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs

## 🛠️ Manual Setup (Alternative)

### 1. Start Required Services

```bash
# Start MongoDB
sudo systemctl start mongod

# Start Redis
sudo systemctl start redis

# Start RabbitMQ
sudo systemctl start rabbitmq-server
```

### 2. Configure Environment

```bash
# Copy environment files
cp auth-service/env.example auth-service/.env
cp money-generation/env.example money-generation/.env
cp transaction-service/env.example transaction-service/.env
cp payment-integration/env.example payment-integration/.env
cp kyc-service/env.example kyc-service/.env
cp api-gateway/env.example api-gateway/.env

# Update with your configuration
nano auth-service/.env
```

### 3. Start Services

```bash
# Start all services
npm run start

# Or start individually
npm run start:gateway    # Port 3000
npm run start:auth       # Port 3001
npm run start:money      # Port 3002
npm run start:transaction # Port 3003
npm run start:payment    # Port 3004
npm run start:kyc        # Port 3005
npm run start:frontend   # Port 3006
```

## 🧪 Test the Platform

### 1. Health Check

```bash
# Check if services are running
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### 2. Create Test User

```bash
# Register a new user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### 3. Login

```bash
# Login with the user
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

## 📱 Frontend Access

1. Open http://localhost:3006 in your browser
2. Click "Register" to create a new account
3. Verify your email (check console logs for verification token)
4. Login and explore the platform

## 🔧 Development Commands

```bash
# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start development mode
npm run dev

# View logs
npm run logs
```

## 🐳 Docker Commands

```bash
# Check service status
./deploy.sh --status

# View logs
./deploy.sh --logs

# Stop services
./deploy.sh --stop

# Clean up
./deploy.sh --clean
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo netstat -tulpn | grep :3001
   sudo kill -9 <PID>
   ```

2. **MongoDB connection failed**
   ```bash
   sudo systemctl status mongod
   sudo systemctl start mongod
   ```

3. **Redis connection failed**
   ```bash
   sudo systemctl status redis
   sudo systemctl start redis
   ```

4. **Permission denied**
   ```bash
   sudo chown -R $USER:$USER .
   ```

### Get Help

- Check the [Development Guide](DEVELOPMENT.md)
- View service logs: `docker-compose logs <service-name>`
- Check health endpoints: `curl http://localhost:<port>/health`

## 🎯 Next Steps

1. **Explore the API**: Visit http://localhost:3000/api-docs
2. **Read Documentation**: Check [DEVELOPMENT.md](DEVELOPMENT.md)
3. **Run Tests**: `npm test`
4. **Contribute**: Create issues and pull requests

## 📊 Platform Status

| Service | Port | Status | Health Check |
|---------|------|--------|--------------|
| API Gateway | 3000 | ✅ Running | `/health` |
| Auth Service | 3001 | ✅ Running | `/health` |
| Money Generation | 3002 | ✅ Running | `/health` |
| Transaction Service | 3003 | ✅ Running | `/health` |
| Payment Integration | 3004 | ✅ Running | `/health` |
| KYC Service | 3005 | ✅ Running | `/health` |
| Frontend | 3006 | ✅ Running | `/` |
| MongoDB | 27017 | ✅ Running | Connection |
| Redis | 6379 | ✅ Running | `PING` |
| RabbitMQ | 5672 | ✅ Running | Connection |

## 🎉 Success!

You now have a fully functional QuantumMint platform running locally!

- **Frontend**: http://localhost:3006
- **API Documentation**: http://localhost:3000/api-docs
- **Admin Panel**: http://localhost:15672 (RabbitMQ)

Happy coding! 🚀
