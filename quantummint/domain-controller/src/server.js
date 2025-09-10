const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { main: logger } = require('./utils/logger');
const LDAPServer = require('./ldap/LDAPServer');
const KerberosServer = require('./kerberos/KerberosServer');
const DNSController = require('./dns/DNSController');
const DirectoryService = require('./directory/DirectoryService');
const GroupPolicyManager = require('./policy/GroupPolicyManager');
const ReplicationManager = require('./replication/ReplicationManager');
const SecurityManager = require('./security/SecurityManager');
const AuditService = require('./audit/AuditService');
const QuantumMintIntegration = require('./integration/QuantumMintIntegration');

class QuantumDomainController {
  constructor() {
    this.app = express();
    this.ldapServer = null;
    this.kerberosServer = null;
    this.dnsController = null;
    this.directoryService = null;
    this.groupPolicyManager = null;
    this.replicationManager = null;
    this.securityManager = null;
    this.auditService = null;
    this.integration = null;
    
    this.config = {
      // Domain Configuration
      domain: {
        name: process.env.DOMAIN_NAME || 'quantummint.local',
        netbiosName: process.env.NETBIOS_NAME || 'QUANTUMMINT',
        forestLevel: process.env.FOREST_LEVEL || '2019',
        domainLevel: process.env.DOMAIN_LEVEL || '2019'
      },
      
      // LDAP Configuration
      ldap: {
        port: process.env.LDAP_PORT || 389,
        securePort: process.env.LDAPS_PORT || 636,
        baseDN: process.env.LDAP_BASE_DN || 'dc=quantummint,dc=local',
        bindDN: process.env.LDAP_BIND_DN || 'cn=Administrator,cn=Users,dc=quantummint,dc=local',
        maxConnections: process.env.LDAP_MAX_CONNECTIONS || 1000
      },
      
      // Kerberos Configuration
      kerberos: {
        realm: process.env.KERBEROS_REALM || 'QUANTUMMINT.LOCAL',
        kdcPort: process.env.KDC_PORT || 88,
        kadminPort: process.env.KADMIN_PORT || 749,
        passwordPort: process.env.KPASSWD_PORT || 464
      },
      
      // DNS Configuration
      dns: {
        port: process.env.DNS_PORT || 53,
        forwarders: process.env.DNS_FORWARDERS?.split(',') || ['8.8.8.8', '1.1.1.1'],
        zones: process.env.DNS_ZONES?.split(',') || ['quantummint.local']
      },
      
      // Database Configuration
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummint_dc',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000
        }
      },
      
      // Redis Configuration
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        db: process.env.REDIS_DB || 1
      },
      
      // Security Configuration
      security: {
        enableAuditing: process.env.ENABLE_AUDITING !== 'false',
        enableEncryption: process.env.ENABLE_ENCRYPTION !== 'false',
        certificatePath: process.env.CERTIFICATE_PATH || './certs',
        keyPath: process.env.KEY_PATH || './certs/private'
      },
      
      // Web Interface Configuration
      web: {
        port: process.env.WEB_PORT || 8080,
        enableSSL: process.env.WEB_SSL === 'true'
      }
    };
  }

  async start() {
    try {
      logger.info('Starting QuantumMint Domain Controller...');
      
      // Connect to database
      await this.connectDatabase();
      
      // Initialize services
      await this.initializeServices();
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Start servers
      await this.startServers();
      
      logger.info('QuantumMint Domain Controller started successfully');
      
    } catch (error) {
      logger.error('Failed to start Domain Controller:', error);
      process.exit(1);
    }
  }

  async connectDatabase() {
    try {
      await mongoose.connect(this.config.database.uri, this.config.database.options);
      logger.info('Connected to MongoDB');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async initializeServices() {
    // Initialize Audit Service first
    this.auditService = new AuditService({
      redis: this.config.redis,
      enableAuditing: this.config.security.enableAuditing
    });
    await this.auditService.start();

    // Initialize Security Manager
    this.securityManager = new SecurityManager({
      ...this.config.security,
      auditService: this.auditService
    });
    await this.securityManager.start();

    // Initialize Directory Service
    this.directoryService = new DirectoryService({
      baseDN: this.config.ldap.baseDN,
      domain: this.config.domain,
      securityManager: this.securityManager,
      auditService: this.auditService
    });
    await this.directoryService.initialize();

    // Initialize LDAP Server
    this.ldapServer = new LDAPServer({
      ...this.config.ldap,
      directoryService: this.directoryService,
      securityManager: this.securityManager,
      auditService: this.auditService
    });

    // Initialize Kerberos Server
    this.kerberosServer = new KerberosServer({
      ...this.config.kerberos,
      directoryService: this.directoryService,
      securityManager: this.securityManager,
      auditService: this.auditService
    });

    // Initialize DNS Controller
    this.dnsController = new DNSController({
      ...this.config.dns,
      domain: this.config.domain,
      directoryService: this.directoryService
    });

    // Initialize Group Policy Manager
    this.groupPolicyManager = new GroupPolicyManager({
      directoryService: this.directoryService,
      auditService: this.auditService
    });

    // Initialize Replication Manager
    this.replicationManager = new ReplicationManager({
      directoryService: this.directoryService,
      redis: this.config.redis,
      auditService: this.auditService
    });
    await this.replicationManager.start();

    // Initialize QuantumMint Integration
    this.integration = new QuantumMintIntegration({
      apiGateway: process.env.QUANTUMMINT_API_GATEWAY || 'http://localhost:3000',
      authService: process.env.QUANTUMMINT_AUTH_SERVICE || 'http://localhost:3001',
      mailServer: process.env.QUANTUMMINT_MAIL_SERVER || 'http://localhost:3002',
      directoryService: this.directoryService,
      securityManager: this.securityManager,
      auditService: this.auditService
    });
    await this.integration.initialize();

    logger.info('All services initialized');
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          ldap: this.ldapServer?.isRunning || false,
          kerberos: this.kerberosServer?.isRunning || false,
          dns: this.dnsController?.isRunning || false,
          directory: this.directoryService?.isInitialized || false
        }
      });
    });

    // Store services in app for route access
    this.app.set('directoryService', this.directoryService);
    this.app.set('securityManager', this.securityManager);
    this.app.set('auditService', this.auditService);
    this.app.set('policyManager', this.groupPolicyManager);
    this.app.set('replicationManager', this.replicationManager);
    this.app.set('integration', this.integration);
    this.app.set('services', {
      ldapServer: this.ldapServer,
      kerberosServer: this.kerberosServer,
      dnsController: this.dnsController,
      directoryService: this.directoryService,
      securityManager: this.securityManager,
      auditService: this.auditService,
      policyManager: this.groupPolicyManager,
      replicationManager: this.replicationManager,
      integration: this.integration
    });

    // API routes
    this.app.use('/api', require('./routes'));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Error handling middleware
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  async startServers() {
    try {
      // Start LDAP Server
      await this.ldapServer.start();
      logger.info(`LDAP Server started on ports ${this.config.ldap.port} and ${this.config.ldap.securePort}`);

      // Start Kerberos Server
      await this.kerberosServer.start();
      logger.info(`Kerberos KDC started on port ${this.config.kerberos.kdcPort}`);

      // Start DNS Controller
      await this.dnsController.start();
      logger.info(`DNS Server started on port ${this.config.dns.port}`);

      // Start Web Interface
      const webPort = this.config.web.port;
      this.app.listen(webPort, () => {
        logger.info(`Web Interface started on port ${webPort}`);
      });

    } catch (error) {
      logger.error('Failed to start servers:', error);
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('Stopping Domain Controller...');

      // Stop all services
      if (this.ldapServer) await this.ldapServer.stop();
      if (this.kerberosServer) await this.kerberosServer.stop();
      if (this.dnsController) await this.dnsController.stop();
      if (this.replicationManager) await this.replicationManager.stop();

      // Close database connection
      await mongoose.connection.close();

      logger.info('Domain Controller stopped');
    } catch (error) {
      logger.error('Error stopping Domain Controller:', error);
    }
  }
}

// Start the server
const domainController = new QuantumDomainController();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await domainController.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await domainController.stop();
  process.exit(0);
});

// Start the domain controller
domainController.start().catch(error => {
  logger.error('Failed to start Domain Controller:', error);
  process.exit(1);
});

module.exports = QuantumDomainController;
