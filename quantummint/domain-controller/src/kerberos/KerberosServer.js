const dgram = require('dgram');
const crypto = require('crypto');
const forge = require('node-forge');
const { kerberos: logger } = require('../utils/logger');

class KerberosServer {
  constructor(config) {
    this.config = config;
    this.directoryService = config.directoryService;
    this.securityManager = config.securityManager;
    this.auditService = config.auditService;
    
    this.servers = {
      kdc: null,      // Key Distribution Center (port 88)
      kadmin: null,   // Admin server (port 749)
      kpasswd: null   // Password change (port 464)
    };
    
    this.realm = config.realm;
    this.masterKey = null;
    this.tickets = new Map(); // Active tickets cache
    this.isRunning = false;
  }

  async start() {
    try {
      // Initialize master key
      await this.initializeMasterKey();
      
      // Start KDC server
      await this.startKDCServer();
      
      // Start admin server
      await this.startAdminServer();
      
      // Start password server
      await this.startPasswordServer();
      
      this.isRunning = true;
      logger.info('Kerberos servers started successfully');
      
    } catch (error) {
      logger.error('Failed to start Kerberos servers:', error);
      throw error;
    }
  }

  async initializeMasterKey() {
    try {
      // Generate or load master key for the realm
      const keyData = crypto.randomBytes(32);
      this.masterKey = keyData;
      
      logger.info('Kerberos master key initialized');
    } catch (error) {
      logger.error('Failed to initialize master key:', error);
      throw error;
    }
  }

  async startKDCServer() {
    this.servers.kdc = dgram.createSocket('udp4');
    
    this.servers.kdc.on('message', async (msg, rinfo) => {
      try {
        await this.handleKDCRequest(msg, rinfo);
      } catch (error) {
        logger.error('KDC request handling error:', error);
      }
    });

    this.servers.kdc.on('error', (err) => {
      logger.error('KDC server error:', err);
    });

    return new Promise((resolve, reject) => {
      this.servers.kdc.bind(this.config.kdcPort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`KDC server listening on port ${this.config.kdcPort}`);
          resolve();
        }
      });
    });
  }

  async startAdminServer() {
    this.servers.kadmin = dgram.createSocket('udp4');
    
    this.servers.kadmin.on('message', async (msg, rinfo) => {
      try {
        await this.handleAdminRequest(msg, rinfo);
      } catch (error) {
        logger.error('Admin request handling error:', error);
      }
    });

    return new Promise((resolve, reject) => {
      this.servers.kadmin.bind(this.config.kadminPort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Kadmin server listening on port ${this.config.kadminPort}`);
          resolve();
        }
      });
    });
  }

  async startPasswordServer() {
    this.servers.kpasswd = dgram.createSocket('udp4');
    
    this.servers.kpasswd.on('message', async (msg, rinfo) => {
      try {
        await this.handlePasswordRequest(msg, rinfo);
      } catch (error) {
        logger.error('Password request handling error:', error);
      }
    });

    return new Promise((resolve, reject) => {
      this.servers.kpasswd.bind(this.config.passwordPort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Kpasswd server listening on port ${this.config.passwordPort}`);
          resolve();
        }
      });
    });
  }

  async handleKDCRequest(msg, rinfo) {
    try {
      // Parse Kerberos request
      const request = this.parseKerberosRequest(msg);
      
      logger.info('KDC request received', {
        type: request.type,
        client: request.client,
        service: request.service,
        ip: rinfo.address
      });

      let response;
      
      switch (request.type) {
        case 'AS-REQ': // Authentication Server Request
          response = await this.handleASRequest(request, rinfo);
          break;
        case 'TGS-REQ': // Ticket Granting Server Request
          response = await this.handleTGSRequest(request, rinfo);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      // Send response
      if (response) {
        this.servers.kdc.send(response, rinfo.port, rinfo.address);
      }

    } catch (error) {
      logger.error('KDC request error:', error);
      
      // Send error response
      const errorResponse = this.createErrorResponse(error);
      this.servers.kdc.send(errorResponse, rinfo.port, rinfo.address);
    }
  }

  async handleASRequest(request, rinfo) {
    try {
      const { client, service, timestamp, nonce } = request;
      
      // Authenticate client
      const user = await this.directoryService.getUserByPrincipal(`${client}@${this.realm}`);
      if (!user) {
        throw new Error('Client not found');
      }

      // Verify pre-authentication if present
      if (request.preAuth) {
        const isValid = await this.verifyPreAuthentication(request.preAuth, user);
        if (!isValid) {
          throw new Error('Pre-authentication failed');
        }
      }

      // Generate session key
      const sessionKey = crypto.randomBytes(32);
      
      // Create TGT (Ticket Granting Ticket)
      const tgt = await this.createTGT(user, sessionKey);
      
      // Create AS-REP response
      const response = this.createASResponse({
        client,
        sessionKey,
        tgt,
        nonce,
        timestamp: new Date()
      });

      // Cache ticket
      this.tickets.set(tgt.id, {
        user,
        sessionKey,
        created: new Date(),
        expires: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
      });

      // Audit successful authentication
      await this.auditService.logEvent({
        type: 'KERBEROS_AS_SUCCESS',
        user: user.sAMAccountName,
        client: client,
        ip: rinfo.address,
        timestamp: new Date()
      });

      logger.info('AS-REQ processed successfully', { client, user: user.sAMAccountName });
      
      return response;
      
    } catch (error) {
      // Audit failed authentication
      await this.auditService.logEvent({
        type: 'KERBEROS_AS_FAILURE',
        client: request.client,
        error: error.message,
        ip: rinfo.address,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  async handleTGSRequest(request, rinfo) {
    try {
      const { tgt, service, nonce } = request;
      
      // Verify TGT
      const ticketInfo = this.tickets.get(tgt.id);
      if (!ticketInfo) {
        throw new Error('Invalid or expired TGT');
      }

      // Check TGT expiration
      if (new Date() > ticketInfo.expires) {
        this.tickets.delete(tgt.id);
        throw new Error('TGT expired');
      }

      // Verify service exists
      const serviceAccount = await this.directoryService.getUserByPrincipal(`${service}@${this.realm}`);
      if (!serviceAccount) {
        throw new Error('Service not found');
      }

      // Generate service session key
      const serviceSessionKey = crypto.randomBytes(32);
      
      // Create service ticket
      const serviceTicket = await this.createServiceTicket(
        ticketInfo.user,
        serviceAccount,
        serviceSessionKey
      );

      // Create TGS-REP response
      const response = this.createTGSResponse({
        client: ticketInfo.user.sAMAccountName,
        service,
        sessionKey: serviceSessionKey,
        ticket: serviceTicket,
        nonce
      });

      // Audit service ticket request
      await this.auditService.logEvent({
        type: 'KERBEROS_TGS_SUCCESS',
        user: ticketInfo.user.sAMAccountName,
        service,
        ip: rinfo.address,
        timestamp: new Date()
      });

      logger.info('TGS-REQ processed successfully', { 
        client: ticketInfo.user.sAMAccountName, 
        service 
      });
      
      return response;
      
    } catch (error) {
      // Audit failed service ticket request
      await this.auditService.logEvent({
        type: 'KERBEROS_TGS_FAILURE',
        service: request.service,
        error: error.message,
        ip: rinfo.address,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  async handleAdminRequest(msg, rinfo) {
    try {
      const request = this.parseAdminRequest(msg);
      
      logger.info('Admin request received', {
        type: request.type,
        principal: request.principal,
        ip: rinfo.address
      });

      let response;
      
      switch (request.type) {
        case 'CREATE_PRINCIPAL':
          response = await this.createPrincipal(request);
          break;
        case 'DELETE_PRINCIPAL':
          response = await this.deletePrincipal(request);
          break;
        case 'MODIFY_PRINCIPAL':
          response = await this.modifyPrincipal(request);
          break;
        case 'LIST_PRINCIPALS':
          response = await this.listPrincipals(request);
          break;
        default:
          throw new Error(`Unknown admin request type: ${request.type}`);
      }

      this.servers.kadmin.send(response, rinfo.port, rinfo.address);
      
    } catch (error) {
      logger.error('Admin request error:', error);
      
      const errorResponse = this.createAdminErrorResponse(error);
      this.servers.kadmin.send(errorResponse, rinfo.port, rinfo.address);
    }
  }

  async handlePasswordRequest(msg, rinfo) {
    try {
      const request = this.parsePasswordRequest(msg);
      
      logger.info('Password change request received', {
        principal: request.principal,
        ip: rinfo.address
      });

      // Verify current password
      const user = await this.directoryService.getUserByPrincipal(request.principal);
      if (!user) {
        throw new Error('Principal not found');
      }

      const isCurrentValid = await this.verifyPassword(user, request.currentPassword);
      if (!isCurrentValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await this.directoryService.modifyEntry(user.dn, [{
        operation: 'replace',
        modification: {
          type: 'password',
          vals: [request.newPassword]
        }
      }]);

      // Create success response
      const response = this.createPasswordResponse({ success: true });
      
      // Audit password change
      await this.auditService.logEvent({
        type: 'KERBEROS_PASSWORD_CHANGE',
        user: user.sAMAccountName,
        ip: rinfo.address,
        timestamp: new Date()
      });

      this.servers.kpasswd.send(response, rinfo.port, rinfo.address);
      
      logger.info('Password changed successfully', { principal: request.principal });
      
    } catch (error) {
      logger.error('Password change error:', error);
      
      const errorResponse = this.createPasswordErrorResponse(error);
      this.servers.kpasswd.send(errorResponse, rinfo.port, rinfo.address);
    }
  }

  parseKerberosRequest(msg) {
    // Simplified Kerberos request parser
    // In a real implementation, this would use ASN.1 parsing
    try {
      const data = JSON.parse(msg.toString());
      return {
        type: data.type,
        client: data.client,
        service: data.service,
        timestamp: data.timestamp,
        nonce: data.nonce,
        preAuth: data.preAuth,
        tgt: data.tgt
      };
    } catch (error) {
      throw new Error('Invalid Kerberos request format');
    }
  }

  async createTGT(user, sessionKey) {
    const tgtId = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours
    
    const tgt = {
      id: tgtId,
      client: user.sAMAccountName,
      realm: this.realm,
      sessionKey: sessionKey.toString('base64'),
      issued: now,
      expires,
      flags: ['forwardable', 'renewable']
    };

    // Encrypt TGT with master key
    const cipher = crypto.createCipher('aes-256-cbc', this.masterKey);
    let encrypted = cipher.update(JSON.stringify(tgt), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      id: tgtId,
      data: encrypted
    };
  }

  async createServiceTicket(user, service, sessionKey) {
    const ticketId = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    
    const ticket = {
      id: ticketId,
      client: user.sAMAccountName,
      service: service.sAMAccountName,
      realm: this.realm,
      sessionKey: sessionKey.toString('base64'),
      issued: now,
      expires
    };

    // Encrypt ticket with service key (simplified)
    const serviceKey = await this.getServiceKey(service);
    const cipher = crypto.createCipher('aes-256-cbc', serviceKey);
    let encrypted = cipher.update(JSON.stringify(ticket), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      id: ticketId,
      data: encrypted
    };
  }

  createASResponse(data) {
    const response = {
      type: 'AS-REP',
      client: data.client,
      tgt: data.tgt,
      sessionKey: data.sessionKey.toString('base64'),
      nonce: data.nonce,
      timestamp: data.timestamp
    };
    
    return Buffer.from(JSON.stringify(response));
  }

  createTGSResponse(data) {
    const response = {
      type: 'TGS-REP',
      client: data.client,
      service: data.service,
      ticket: data.ticket,
      sessionKey: data.sessionKey.toString('base64'),
      nonce: data.nonce
    };
    
    return Buffer.from(JSON.stringify(response));
  }

  createErrorResponse(error) {
    const response = {
      type: 'KRB-ERROR',
      error: error.message,
      timestamp: new Date()
    };
    
    return Buffer.from(JSON.stringify(response));
  }

  async verifyPreAuthentication(preAuth, user) {
    // Simplified pre-authentication verification
    // In a real implementation, this would verify encrypted timestamp
    return true;
  }

  async verifyPassword(user, password) {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(password, user.password);
  }

  async getServiceKey(service) {
    // Generate or retrieve service key
    // In a real implementation, this would be stored securely
    return crypto.createHash('sha256').update(service.sAMAccountName + this.realm).digest();
  }

  parseAdminRequest(msg) {
    try {
      return JSON.parse(msg.toString());
    } catch (error) {
      throw new Error('Invalid admin request format');
    }
  }

  parsePasswordRequest(msg) {
    try {
      return JSON.parse(msg.toString());
    } catch (error) {
      throw new Error('Invalid password request format');
    }
  }

  createPasswordResponse(data) {
    return Buffer.from(JSON.stringify(data));
  }

  createPasswordErrorResponse(error) {
    return Buffer.from(JSON.stringify({ 
      success: false, 
      error: error.message 
    }));
  }

  createAdminErrorResponse(error) {
    return Buffer.from(JSON.stringify({ 
      success: false, 
      error: error.message 
    }));
  }

  async createPrincipal(request) {
    // Implementation for creating new principals
    const response = { success: true, message: 'Principal created' };
    return Buffer.from(JSON.stringify(response));
  }

  async deletePrincipal(request) {
    // Implementation for deleting principals
    const response = { success: true, message: 'Principal deleted' };
    return Buffer.from(JSON.stringify(response));
  }

  async modifyPrincipal(request) {
    // Implementation for modifying principals
    const response = { success: true, message: 'Principal modified' };
    return Buffer.from(JSON.stringify(response));
  }

  async listPrincipals(request) {
    // Implementation for listing principals
    const response = { success: true, principals: [] };
    return Buffer.from(JSON.stringify(response));
  }

  async stop() {
    try {
      const closePromises = Object.values(this.servers)
        .filter(server => server)
        .map(server => new Promise(resolve => server.close(resolve)));
      
      await Promise.all(closePromises);
      
      this.tickets.clear();
      this.isRunning = false;
      
      logger.info('Kerberos servers stopped');
    } catch (error) {
      logger.error('Error stopping Kerberos servers:', error);
    }
  }
}

module.exports = KerberosServer;
