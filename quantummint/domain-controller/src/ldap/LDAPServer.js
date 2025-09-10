const ldap = require('ldapjs');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const { ldap: logger } = require('../utils/logger');

class LDAPServer {
  constructor(config) {
    this.config = config;
    this.directoryService = config.directoryService;
    this.securityManager = config.securityManager;
    this.auditService = config.auditService;
    
    this.servers = {
      standard: null, // Port 389
      secure: null    // Port 636 (LDAPS)
    };
    
    this.connections = new Map();
    this.isRunning = false;
  }

  async start() {
    try {
      // Load TLS certificates
      const tlsOptions = await this.loadTLSCertificates();
      
      // Start standard LDAP server (port 389)
      await this.startStandardServer(tlsOptions);
      
      // Start secure LDAP server (port 636)
      await this.startSecureServer(tlsOptions);
      
      this.isRunning = true;
      logger.info('LDAP servers started successfully');
      
    } catch (error) {
      logger.error('Failed to start LDAP servers:', error);
      throw error;
    }
  }

  async startStandardServer(tlsOptions) {
    this.servers.standard = ldap.createServer({
      certificate: tlsOptions.cert,
      key: tlsOptions.key
    });

    // Bind handlers
    this.setupHandlers(this.servers.standard);

    return new Promise((resolve, reject) => {
      this.servers.standard.listen(this.config.port, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`LDAP server listening on port ${this.config.port}`);
          resolve();
        }
      });
    });
  }

  async startSecureServer(tlsOptions) {
    this.servers.secure = ldap.createServer({
      certificate: tlsOptions.cert,
      key: tlsOptions.key
    });

    // Bind handlers
    this.setupHandlers(this.servers.secure);

    return new Promise((resolve, reject) => {
      this.servers.secure.listen(this.config.securePort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`LDAPS server listening on port ${this.config.securePort}`);
          resolve();
        }
      });
    });
  }

  setupHandlers(server) {
    // Bind operation
    server.bind(this.config.baseDN, async (req, res, next) => {
      try {
        const dn = req.dn.toString();
        const password = req.credentials;
        
        logger.info('LDAP bind attempt', { dn, ip: req.connection.remoteAddress });
        
        // Authenticate user
        const user = await this.directoryService.authenticateUser(dn, password);
        
        if (user) {
          // Store connection info
          this.connections.set(req.connection.id, {
            dn,
            user,
            bindTime: new Date(),
            ip: req.connection.remoteAddress
          });
          
          // Audit successful bind
          await this.auditService.logEvent({
            type: 'LDAP_BIND_SUCCESS',
            user: dn,
            ip: req.connection.remoteAddress,
            timestamp: new Date()
          });
          
          res.end();
        } else {
          // Audit failed bind
          await this.auditService.logEvent({
            type: 'LDAP_BIND_FAILURE',
            user: dn,
            ip: req.connection.remoteAddress,
            timestamp: new Date()
          });
          
          return next(new ldap.InvalidCredentialsError());
        }
      } catch (error) {
        logger.error('LDAP bind error:', error);
        return next(new ldap.OperationsError(error.message));
      }
    });

    // Search operation
    server.search(this.config.baseDN, async (req, res, next) => {
      try {
        const connection = this.connections.get(req.connection.id);
        if (!connection) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        const baseDN = req.dn.toString();
        const scope = req.scope;
        const filter = req.filter.toString();
        const attributes = req.attributes;

        logger.info('LDAP search request', { 
          baseDN, 
          scope, 
          filter, 
          attributes,
          user: connection.dn 
        });

        // Check permissions
        const hasPermission = await this.securityManager.checkLDAPPermission(
          connection.user, 
          'search', 
          baseDN
        );

        if (!hasPermission) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        // Perform search
        const results = await this.directoryService.search({
          baseDN,
          scope,
          filter,
          attributes
        });

        // Send results
        for (const entry of results) {
          res.send(entry);
        }

        // Audit search
        await this.auditService.logEvent({
          type: 'LDAP_SEARCH',
          user: connection.dn,
          baseDN,
          filter,
          resultCount: results.length,
          timestamp: new Date()
        });

        res.end();
      } catch (error) {
        logger.error('LDAP search error:', error);
        return next(new ldap.OperationsError(error.message));
      }
    });

    // Add operation
    server.add(this.config.baseDN, async (req, res, next) => {
      try {
        const connection = this.connections.get(req.connection.id);
        if (!connection) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        const dn = req.dn.toString();
        const entry = req.toObject().attributes;

        logger.info('LDAP add request', { dn, user: connection.dn });

        // Check permissions
        const hasPermission = await this.securityManager.checkLDAPPermission(
          connection.user, 
          'add', 
          dn
        );

        if (!hasPermission) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        // Add entry
        await this.directoryService.addEntry(dn, entry);

        // Audit add
        await this.auditService.logEvent({
          type: 'LDAP_ADD',
          user: connection.dn,
          targetDN: dn,
          timestamp: new Date()
        });

        res.end();
      } catch (error) {
        logger.error('LDAP add error:', error);
        return next(new ldap.OperationsError(error.message));
      }
    });

    // Modify operation
    server.modify(this.config.baseDN, async (req, res, next) => {
      try {
        const connection = this.connections.get(req.connection.id);
        if (!connection) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        const dn = req.dn.toString();
        const changes = req.changes;

        logger.info('LDAP modify request', { dn, user: connection.dn });

        // Check permissions
        const hasPermission = await this.securityManager.checkLDAPPermission(
          connection.user, 
          'modify', 
          dn
        );

        if (!hasPermission) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        // Modify entry
        await this.directoryService.modifyEntry(dn, changes);

        // Audit modify
        await this.auditService.logEvent({
          type: 'LDAP_MODIFY',
          user: connection.dn,
          targetDN: dn,
          changes: changes.map(c => ({ operation: c.operation, attribute: c.modification.type })),
          timestamp: new Date()
        });

        res.end();
      } catch (error) {
        logger.error('LDAP modify error:', error);
        return next(new ldap.OperationsError(error.message));
      }
    });

    // Delete operation
    server.del(this.config.baseDN, async (req, res, next) => {
      try {
        const connection = this.connections.get(req.connection.id);
        if (!connection) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        const dn = req.dn.toString();

        logger.info('LDAP delete request', { dn, user: connection.dn });

        // Check permissions
        const hasPermission = await this.securityManager.checkLDAPPermission(
          connection.user, 
          'delete', 
          dn
        );

        if (!hasPermission) {
          return next(new ldap.InsufficientAccessRightsError());
        }

        // Delete entry
        await this.directoryService.deleteEntry(dn);

        // Audit delete
        await this.auditService.logEvent({
          type: 'LDAP_DELETE',
          user: connection.dn,
          targetDN: dn,
          timestamp: new Date()
        });

        res.end();
      } catch (error) {
        logger.error('LDAP delete error:', error);
        return next(new ldap.OperationsError(error.message));
      }
    });

    // Connection close handler
    server.on('close', (req) => {
      const connection = this.connections.get(req.connection.id);
      if (connection) {
        logger.info('LDAP connection closed', { 
          user: connection.dn,
          duration: Date.now() - connection.bindTime.getTime()
        });
        this.connections.delete(req.connection.id);
      }
    });
  }

  async loadTLSCertificates() {
    const certPath = path.join(this.config.certificatePath || './certs', 'server.crt');
    const keyPath = path.join(this.config.keyPath || './certs', 'server.key');

    try {
      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);
      
      return { cert, key };
    } catch (error) {
      logger.warn('TLS certificates not found, generating self-signed certificates');
      return await this.generateSelfSignedCertificates();
    }
  }

  async generateSelfSignedCertificates() {
    const forge = require('node-forge');
    
    // Generate key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [{
      name: 'commonName',
      value: this.config.domain?.name || 'quantummint.local'
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      name: 'organizationName',
      value: 'QuantumMint'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);
    
    // Convert to PEM format
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    
    // Save certificates
    const certDir = path.dirname(this.config.certificatePath || './certs/server.crt');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(certDir, 'server.crt'), certPem);
    fs.writeFileSync(path.join(certDir, 'server.key'), keyPem);
    
    return {
      cert: Buffer.from(certPem),
      key: Buffer.from(keyPem)
    };
  }

  async stop() {
    try {
      const stopPromises = Object.values(this.servers)
        .filter(server => server)
        .map(server => new Promise(resolve => server.close(resolve)));
      
      await Promise.all(stopPromises);
      
      this.connections.clear();
      this.isRunning = false;
      
      logger.info('LDAP servers stopped');
    } catch (error) {
      logger.error('Error stopping LDAP servers:', error);
    }
  }
}

module.exports = LDAPServer;
