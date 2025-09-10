# QuantumMint Domain Controller

A comprehensive, enterprise-grade domain controller implementation for the QuantumMint platform, providing LDAP directory services, Kerberos authentication, DNS integration, group policy management, and multi-master replication.

## Features

### Core Services
- **LDAP Directory Services** - Full LDAP v3 server with secure authentication
- **Kerberos Authentication** - KDC with ticket granting and validation
- **DNS Integration** - Domain-integrated DNS server with service records
- **Group Policy Management** - Policy creation, linking, and enforcement
- **Multi-Master Replication** - Distributed directory synchronization
- **Security & Auditing** - Comprehensive logging and security monitoring

### QuantumMint Integration
- **Authentication Provider** - SSO for QuantumMint services
- **User Directory** - Centralized user management
- **Mail Server Integration** - User lookup and authentication
- **API Gateway Integration** - Service registration and discovery

## Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 4.4+
- Redis 6.0+
- OpenSSL (for certificates)

### Installation

1. **Clone and setup**
```bash
cd domain-controller
npm install
node scripts/setup-dev.js
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start services**
```bash
# Start MongoDB and Redis first
npm start
```

4. **Test installation**
```bash
node scripts/test-domain-controller.js
```

## Configuration

### Environment Variables

#### Domain Settings
```env
DOMAIN_NAME=quantummint.local
NETBIOS_NAME=QUANTUMMINT
FOREST_NAME=quantummint.local
```

#### Service Ports
```env
LDAP_PORT=389
LDAPS_PORT=636
KERBEROS_PORT=88
DNS_PORT=53
WEB_PORT=8080
```

#### Database Connections
```env
MONGODB_URI=mongodb://localhost:27017/quantummint-domain
REDIS_URI=redis://localhost:6379
```

#### Security Settings
```env
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key
PASSWORD_MIN_LENGTH=8
PASSWORD_COMPLEXITY=true
```

## API Documentation

### Authentication
```bash
# Login via domain controller
POST /api/integration/auth/login
{
  "username": "user@quantummint.local",
  "password": "password"
}

# Validate token
POST /api/integration/auth/validate
{
  "token": "jwt-token"
}
```

### User Management
```bash
# List users
GET /api/users?page=1&limit=50

# Get user details
GET /api/users/username

# Create user
POST /api/users
{
  "sAMAccountName": "newuser",
  "displayName": "New User",
  "mail": "newuser@quantummint.local",
  "password": "SecurePass123!"
}

# Update user
PUT /api/users/username
{
  "displayName": "Updated Name"
}
```

### Group Management
```bash
# List groups
GET /api/groups

# Create group
POST /api/groups
{
  "sAMAccountName": "NewGroup",
  "description": "New security group",
  "groupScope": "Global",
  "groupCategory": "Security"
}

# Add member to group
POST /api/groups/groupname/members
{
  "memberDN": "cn=user,cn=Users,dc=quantummint,dc=local"
}
```

### Directory Operations
```bash
# Search directory
POST /api/directory/search
{
  "baseDN": "dc=quantummint,dc=local",
  "scope": "sub",
  "filter": "(objectClass=user)",
  "attributes": ["sAMAccountName", "displayName"]
}

# Get directory statistics
GET /api/directory/stats
```

### Policy Management
```bash
# List policies
GET /api/policies

# Create policy
POST /api/policies
{
  "name": "Password Policy",
  "type": "user",
  "settings": {
    "passwordMinLength": 12,
    "passwordComplexity": true
  }
}

# Link policy to OU
POST /api/policies/policy-id/link
{
  "targetDN": "ou=Users,dc=quantummint,dc=local",
  "linkOrder": 1,
  "enforced": false
}
```

### Audit & Monitoring
```bash
# Get audit events
GET /api/audit/events?type=USER_LOGIN&limit=100

# Get audit statistics
GET /api/audit/stats?period=24h

# Export audit data
POST /api/audit/export
{
  "format": "json",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

## LDAP Integration

### Connection Settings
```
Server: ldap://localhost:389 (or ldaps://localhost:636)
Base DN: dc=quantummint,dc=local
Bind DN: cn=Administrator,cn=Users,dc=quantummint,dc=local
```

### Schema Support
- **User Objects**: organizationalPerson, user
- **Group Objects**: group, groupOfNames
- **Computer Objects**: computer
- **Organizational Units**: organizationalUnit

### Example LDAP Search
```bash
ldapsearch -x -H ldap://localhost:389 \
  -D "cn=Administrator,cn=Users,dc=quantummint,dc=local" \
  -w "password" \
  -b "dc=quantummint,dc=local" \
  "(objectClass=user)"
```

## Kerberos Integration

### Realm Configuration
```
Realm: QUANTUMMINT.LOCAL
KDC: localhost:88
Admin Server: localhost:749
```

### Service Principal Names
- `ldap/quantummint.local@QUANTUMMINT.LOCAL`
- `host/quantummint.local@QUANTUMMINT.LOCAL`
- `HTTP/quantummint.local@QUANTUMMINT.LOCAL`

## DNS Integration

### Zone Configuration
- **Forward Zone**: quantummint.local
- **Reverse Zone**: Auto-generated
- **Service Records**: _ldap._tcp, _kerberos._tcp, _gc._tcp

### DNS Queries
```bash
# Test DNS resolution
nslookup quantummint.local localhost
nslookup _ldap._tcp.quantummint.local localhost
```

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t quantummint/domain-controller .

# Run container
docker run -d \
  --name domain-controller \
  -p 389:389 -p 636:636 -p 88:88 -p 53:53 -p 8080:8080 \
  -e MONGODB_URI=mongodb://mongo:27017/quantummint-domain \
  -e REDIS_URI=redis://redis:6379 \
  quantummint/domain-controller
```

### Production Considerations
- Use external MongoDB and Redis clusters
- Configure SSL certificates for LDAPS
- Set up load balancing for high availability
- Configure firewall rules for service ports
- Enable audit log retention and rotation
- Set up monitoring and alerting

## Troubleshooting

### Common Issues

#### LDAP Connection Failed
```bash
# Check LDAP server status
curl http://localhost:8080/api/health

# Test LDAP connectivity
ldapsearch -x -H ldap://localhost:389 -s base
```

#### Kerberos Authentication Failed
```bash
# Check Kerberos service
netstat -an | grep :88

# Test with kinit (if available)
kinit user@QUANTUMMINT.LOCAL
```

#### DNS Resolution Issues
```bash
# Test DNS server
nslookup quantummint.local localhost

# Check DNS service logs
curl http://localhost:8080/api/audit/events?type=DNS_QUERY
```

### Log Files
- Application logs: `logs/domain-controller.log`
- LDAP logs: Check audit events with type `LDAP_*`
- Kerberos logs: Check audit events with type `KERBEROS_*`
- DNS logs: Check audit events with type `DNS_*`

## Development

### Project Structure
```
src/
├── audit/          # Audit service
├── directory/      # Directory service
├── dns/           # DNS controller
├── integration/   # QuantumMint integration
├── kerberos/      # Kerberos KDC
├── ldap/          # LDAP server
├── models/        # Database models
├── policy/        # Group policy manager
├── replication/   # Replication manager
├── routes/        # API routes
├── security/      # Security manager
└── utils/         # Utilities and logging
```

### Running Tests
```bash
# Run comprehensive tests
node scripts/test-domain-controller.js

# Test specific components
npm test
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

Copyright (c) 2024 QuantumMint. All rights reserved.

## Support

For support and documentation:
- GitHub Issues: [Create an issue](https://github.com/quantummint/domain-controller/issues)
- Documentation: [Wiki](https://github.com/quantummint/domain-controller/wiki)
- Email: support@quantummint.com
