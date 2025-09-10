# QuantumMint Mail Server

A comprehensive, enterprise-grade mail server solution built for the QuantumMint platform. This mail server provides robust email handling with advanced security, authentication, and management features.

## Features

### Core Mail Services
- **SMTP Server** - Multi-port support (25, 587, 465) with TLS/SSL encryption
- **IMAP Server** - Full IMAP4 implementation with secure connections
- **POP3 Server** - POP3 support for legacy email clients
- **Web Interface** - Modern web-based control panel for administration
- **REST API** - Comprehensive API for email integration

### Security & Authentication
- **Email Authentication** - SPF, DKIM, and DMARC support
- **Anti-Spam** - SpamAssassin integration with configurable thresholds
- **Anti-Virus** - ClamAV integration for malware detection
- **Rate Limiting** - IP-based and user-based rate limiting
- **TLS/SSL** - Full encryption support for all protocols

### Advanced Features
- **Message Queuing** - Redis-based queue system with Bull
- **Analytics & Reporting** - Comprehensive email analytics
- **DNS Management** - Automated DNS record management
- **User Management** - Multi-user support with quotas and permissions
- **Email Forwarding** - Flexible forwarding and alias support
- **Autoresponders** - Automated email responses

## Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB 4.4 or higher
- Redis 6.0 or higher
- OpenSSL (for certificate generation)

### Installation

1. **Clone and Setup**
   ```bash
   cd mail-server
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

   For Windows:
   ```cmd
   cd mail-server
   scripts\setup.bat
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Services**
   
   **With Docker Compose (Recommended):**
   ```bash
   docker-compose up -d
   ```

   **Manual Start:**
   ```bash
   npm start
   ```

### Configuration

#### Environment Variables
Key configuration options in `.env`:

```env
# Domain Configuration
MAIL_DOMAIN=quantummint.com
MAIL_SERVER_IP=127.0.0.1

# Database
MONGODB_URI=mongodb://localhost:27017/quantummail
REDIS_URI=redis://localhost:6379

# Security
ENABLE_SPF=true
ENABLE_DKIM=true
ENABLE_DMARC=true
ENABLE_ANTISPAM=true
ENABLE_ANTIVIRUS=true

# Ports
SMTP_PORT=25
SMTP_SUBMISSION_PORT=587
SMTP_SECURE_PORT=465
IMAP_PORT=143
IMAP_SECURE_PORT=993
POP3_PORT=110
POP3_SECURE_PORT=995
```

#### DNS Setup
Configure these DNS records for your domain:

```dns
# MX Record
quantummint.com.        MX    10 mail.quantummint.com.

# A Records
mail.quantummint.com.   A     YOUR_SERVER_IP
webmail.quantummint.com. A    YOUR_SERVER_IP

# SPF Record
quantummint.com.        TXT   "v=spf1 ip4:YOUR_SERVER_IP ~all"

# DKIM Record (generated during setup)
quantum._domainkey.quantummint.com. TXT "v=DKIM1; k=rsa; p=..."

# DMARC Record
_dmarc.quantummint.com. TXT   "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@quantummint.com"
```

## Usage

### Web Interface
Access the web control panel at `http://localhost:8080`

Default admin credentials:
- Username: `admin`
- Password: `admin123` (change immediately!)

### API Usage
Send emails via REST API:

```javascript
const response = await fetch('http://localhost:8081/api/email/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    to: ['user@example.com'],
    subject: 'Test Email',
    content: '<h1>Hello from QuantumMint!</h1>',
    contentType: 'text/html'
  })
});
```

### Email Client Configuration
Configure email clients with these settings:

**SMTP (Outgoing):**
- Server: mail.quantummint.com
- Port: 587 (STARTTLS) or 465 (SSL/TLS)
- Authentication: Required

**IMAP (Incoming):**
- Server: mail.quantummint.com
- Port: 143 (STARTTLS) or 993 (SSL/TLS)
- Authentication: Required

**POP3 (Incoming):**
- Server: mail.quantummint.com
- Port: 110 (STARTTLS) or 995 (SSL/TLS)
- Authentication: Required

## Architecture

### Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SMTP Server   │    │   IMAP Server   │    │   POP3 Server   │
│   Ports: 25,    │    │   Ports: 143,   │    │   Ports: 110,   │
│   587, 465      │    │   993           │    │   995           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────────────────────┼─────────────────────────────────┐
│                    Core Mail Engine                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐│
│  │ Security    │  │ Queue       │  │ Analytics   │  │ DNS        ││
│  │ Manager     │  │ System      │  │ Service     │  │ Manager    ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘│
└─────────────────────────────────┼─────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Web Interface  │    │   REST API      │    │   Database      │
│  Port: 8080     │    │   Port: 8081    │    │   MongoDB +     │
│                 │    │                 │    │   Redis         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **Incoming Email** → SMTP Server → Security Checks → Queue → Database
2. **Outgoing Email** → API/SMTP → Queue → Delivery → Analytics
3. **Email Retrieval** → IMAP/POP3 → Authentication → Database → Client

## Development

### Project Structure
```
mail-server/
├── src/
│   ├── smtp/           # SMTP server implementation
│   ├── imap/           # IMAP server implementation
│   ├── pop3/           # POP3 server implementation
│   ├── web/            # Web interface
│   ├── api/            # REST API
│   ├── security/       # Security and authentication
│   ├── queue/          # Message queuing system
│   ├── analytics/      # Analytics and reporting
│   ├── dns/            # DNS management
│   ├── models/         # Database models
│   ├── utils/          # Utilities and helpers
│   └── server.js       # Main server entry point
├── scripts/            # Setup and utility scripts
├── certs/              # TLS certificates
├── keys/               # DKIM keys
├── logs/               # Log files
└── data/               # Data storage
```

### Running in Development
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Building for Production
```bash
npm run build
docker build -t quantummail .
```

## Monitoring

### Health Checks
- HTTP: `GET /health`
- Docker: Built-in health check
- Systemd: Service status monitoring

### Logs
Logs are written to:
- Console (development)
- Files in `logs/` directory
- Structured JSON format for production

### Metrics
Access analytics at:
- Web Interface: Analytics tab
- API: `GET /api/analytics/overview`

## Security Considerations

### Production Deployment
1. **Change Default Passwords** - Update admin and database passwords
2. **Use Real TLS Certificates** - Replace self-signed certificates
3. **Configure Firewall** - Restrict access to necessary ports
4. **Enable Monitoring** - Set up log monitoring and alerts
5. **Regular Updates** - Keep dependencies updated
6. **Backup Strategy** - Implement regular database backups

### Security Features
- JWT-based authentication
- Rate limiting and DDoS protection
- Email authentication (SPF/DKIM/DMARC)
- Spam and virus filtering
- TLS encryption for all connections
- IP blacklisting and reputation management

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Check what's using the port
netstat -tulpn | grep :25
# Kill the process or change port in .env
```

**MongoDB Connection Failed:**
```bash
# Check MongoDB status
systemctl status mongod
# Or start with Docker
docker-compose up -d mongo
```

**TLS Certificate Errors:**
```bash
# Regenerate certificates
openssl req -x509 -newkey rsa:2048 -keyout certs/private.key -out certs/certificate.crt -days 365 -nodes
```

**DNS Resolution Issues:**
```bash
# Test DNS records
dig MX quantummint.com
dig TXT quantummint.com
```

### Log Analysis
Check logs for issues:
```bash
tail -f logs/mail-server.log
tail -f logs/smtp.log
tail -f logs/security.log
```

## API Reference

### Authentication
All API endpoints require JWT authentication:
```
Authorization: Bearer <jwt-token>
```

### Endpoints

**Send Email:**
```http
POST /api/email/send
Content-Type: application/json

{
  "to": ["user@example.com"],
  "subject": "Subject",
  "content": "Email content",
  "contentType": "text/html"
}
```

**Get Email Status:**
```http
GET /api/email/{messageId}/status
```

**Queue Statistics:**
```http
GET /api/queue/status
```

**User Management:**
```http
POST /api/users/create
GET /api/users/{identifier}
PUT /api/users/{id}/quota
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is part of the QuantumMint platform and is proprietary software.

## Support

For support and questions:
- Documentation: [Internal Wiki]
- Issues: [Internal Issue Tracker]
- Email: support@quantummint.com

---

**QuantumMint Mail Server** - Enterprise Email Solution
Built with ❤️ for the QuantumMint Platform
