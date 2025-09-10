const { SMTPServer } = require('smtp-server');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const { smtp: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumSMTPServer {
  constructor(config) {
    this.config = config;
    this.securityManager = config.securityManager;
    this.mailQueue = config.mailQueue;
    this.analyticsService = config.analyticsService;
    
    this.servers = {
      standard: null,    // Port 25 - Server-to-server
      submission: null,  // Port 587 - Client submission with STARTTLS
      secure: null       // Port 465 - Implicit SSL/TLS
    };
    
    this.isRunning = false;
  }

  async start() {
    try {
      // Load TLS certificates
      const tlsOptions = await this.loadTLSCertificates();
      
      // Start standard SMTP server (port 25)
      await this.startStandardServer(tlsOptions);
      
      // Start submission server (port 587)
      await this.startSubmissionServer(tlsOptions);
      
      // Start secure server (port 465)
      await this.startSecureServer(tlsOptions);
      
      this.isRunning = true;
      logger.info('All SMTP servers started successfully');
      
    } catch (error) {
      logger.error('Failed to start SMTP servers:', error);
      throw error;
    }
  }

  async stop() {
    try {
      const stopPromises = Object.values(this.servers)
        .filter(server => server)
        .map(server => new Promise((resolve) => {
          server.close(resolve);
        }));
      
      await Promise.all(stopPromises);
      this.isRunning = false;
      logger.info('All SMTP servers stopped');
      
    } catch (error) {
      logger.error('Error stopping SMTP servers:', error);
      throw error;
    }
  }

  async loadTLSCertificates() {
    const certPath = process.env.TLS_CERT_PATH || path.join(__dirname, '../../certs');
    
    try {
      const tlsOptions = {
        key: fs.readFileSync(path.join(certPath, 'private.key')),
        cert: fs.readFileSync(path.join(certPath, 'certificate.crt'))
      };
      
      // Add CA chain if available
      const caPath = path.join(certPath, 'ca-bundle.crt');
      if (fs.existsSync(caPath)) {
        tlsOptions.ca = fs.readFileSync(caPath);
      }
      
      return tlsOptions;
      
    } catch (error) {
      logger.warn('TLS certificates not found, generating self-signed certificates');
      return await this.generateSelfSignedCertificates();
    }
  }

  async generateSelfSignedCertificates() {
    const forge = require('node-forge');
    const pki = forge.pki;
    
    // Generate key pair
    const keys = pki.rsa.generateKeyPair(2048);
    
    // Create certificate
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [{
      name: 'commonName',
      value: this.config.hostname
    }, {
      name: 'organizationName',
      value: 'QuantumMint Mail Server'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);
    
    // Convert to PEM format
    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);
    
    // Save certificates
    const certDir = path.join(__dirname, '../../certs');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(certDir, 'certificate.crt'), certPem);
    fs.writeFileSync(path.join(certDir, 'private.key'), keyPem);
    
    return {
      key: Buffer.from(keyPem),
      cert: Buffer.from(certPem)
    };
  }

  async startStandardServer(tlsOptions) {
    const serverOptions = {
      name: this.config.hostname,
      banner: `${this.config.hostname} QuantumMint Mail Server`,
      authOptional: true,
      secure: false,
      needsUpgrade: true,
      ...tlsOptions,
      
      // Connection handlers
      onConnect: this.handleConnection.bind(this),
      onAuth: this.handleAuthentication.bind(this),
      onMailFrom: this.handleMailFrom.bind(this),
      onRcptTo: this.handleRcptTo.bind(this),
      onData: this.handleData.bind(this),
      onClose: this.handleClose.bind(this),
      onError: this.handleError.bind(this)
    };

    this.servers.standard = new SMTPServer(serverOptions);
    
    return new Promise((resolve, reject) => {
      this.servers.standard.listen(this.config.port, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Standard SMTP server listening on port ${this.config.port}`);
          resolve();
        }
      });
    });
  }

  async startSubmissionServer(tlsOptions) {
    const serverOptions = {
      name: this.config.hostname,
      banner: `${this.config.hostname} QuantumMint Mail Submission`,
      authRequired: true,
      secure: false,
      needsUpgrade: true,
      ...tlsOptions,
      
      onConnect: this.handleConnection.bind(this),
      onAuth: this.handleAuthentication.bind(this),
      onMailFrom: this.handleMailFrom.bind(this),
      onRcptTo: this.handleRcptTo.bind(this),
      onData: this.handleData.bind(this),
      onClose: this.handleClose.bind(this),
      onError: this.handleError.bind(this)
    };

    this.servers.submission = new SMTPServer(serverOptions);
    
    return new Promise((resolve, reject) => {
      this.servers.submission.listen(this.config.submissionPort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Submission SMTP server listening on port ${this.config.submissionPort}`);
          resolve();
        }
      });
    });
  }

  async startSecureServer(tlsOptions) {
    const serverOptions = {
      name: this.config.hostname,
      banner: `${this.config.hostname} QuantumMint Secure Mail`,
      authRequired: true,
      secure: true,
      ...tlsOptions,
      
      onConnect: this.handleConnection.bind(this),
      onAuth: this.handleAuthentication.bind(this),
      onMailFrom: this.handleMailFrom.bind(this),
      onRcptTo: this.handleRcptTo.bind(this),
      onData: this.handleData.bind(this),
      onClose: this.handleClose.bind(this),
      onError: this.handleError.bind(this)
    };

    this.servers.secure = new SMTPServer(serverOptions);
    
    return new Promise((resolve, reject) => {
      this.servers.secure.listen(this.config.securePort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Secure SMTP server listening on port ${this.config.securePort}`);
          resolve();
        }
      });
    });
  }

  async handleConnection(session, callback) {
    const clientIP = session.remoteAddress;
    
    logger.info('New SMTP connection', {
      sessionId: session.id,
      clientIP,
      port: session.localPort
    });

    try {
      // Check IP blacklist
      const isBlocked = await this.securityManager.isIPBlocked(clientIP);
      if (isBlocked) {
        logger.warn('Blocked connection from blacklisted IP', { clientIP });
        return callback(new Error('Connection rejected'));
      }

      // Rate limiting
      const rateLimitOk = await this.securityManager.checkRateLimit(clientIP, 'connection');
      if (!rateLimitOk) {
        logger.warn('Connection rate limit exceeded', { clientIP });
        return callback(new Error('Rate limit exceeded'));
      }

      // Update analytics
      this.analyticsService.recordConnection(clientIP, session.localPort);
      
      callback();
      
    } catch (error) {
      logger.error('Error handling connection:', error);
      callback(new Error('Internal server error'));
    }
  }

  async handleAuthentication(auth, session, callback) {
    logger.info('SMTP authentication attempt', {
      sessionId: session.id,
      username: auth.username,
      clientIP: session.remoteAddress
    });

    try {
      // Find user
      const user = await MailUser.findByEmailOrUsername(auth.username);
      if (!user) {
        logger.warn('Authentication failed - user not found', { username: auth.username });
        return callback(new Error('Invalid credentials'));
      }

      // Check if account is locked
      if (user.isLocked) {
        logger.warn('Authentication failed - account locked', { username: auth.username });
        return callback(new Error('Account temporarily locked'));
      }

      // Check if account is active
      if (!user.isActive) {
        logger.warn('Authentication failed - account inactive', { username: auth.username });
        return callback(new Error('Account deactivated'));
      }

      // Verify password
      const isValidPassword = await user.comparePassword(auth.password);
      if (!isValidPassword) {
        await user.incLoginAttempts();
        logger.warn('Authentication failed - invalid password', { username: auth.username });
        return callback(new Error('Invalid credentials'));
      }

      // Check IP restrictions
      if (user.allowedIPs.length > 0 && !user.allowedIPs.includes(session.remoteAddress)) {
        logger.warn('Authentication failed - IP not allowed', { 
          username: auth.username, 
          clientIP: session.remoteAddress 
        });
        return callback(new Error('Access denied from this IP'));
      }

      // Reset login attempts on successful auth
      await user.resetLoginAttempts();
      user.lastLogin = new Date();
      await user.save();

      // Store user in session
      session.user = user;
      
      logger.info('SMTP authentication successful', { 
        username: auth.username,
        userId: user._id 
      });

      callback(null, { user: user._id.toString() });
      
    } catch (error) {
      logger.error('Authentication error:', error);
      callback(new Error('Authentication failed'));
    }
  }

  async handleMailFrom(address, session, callback) {
    logger.info('MAIL FROM command', {
      sessionId: session.id,
      from: address.address,
      clientIP: session.remoteAddress
    });

    try {
      // Store sender address
      session.envelope.mailFrom = address;

      // If authenticated, verify sender is authorized
      if (session.user) {
        const user = await MailUser.findById(session.user._id);
        
        // Check if user can send emails (rate limiting)
        if (!user.canSendEmail()) {
          logger.warn('Rate limit exceeded for user', { userId: user._id });
          return callback(new Error('Daily or hourly email limit exceeded'));
        }

        // Verify sender address belongs to user or is an alias
        const senderDomain = address.address.split('@')[1];
        const userDomain = user.email.split('@')[1];
        
        if (senderDomain !== userDomain && !user.aliases.some(alias => alias.alias === address.address)) {
          logger.warn('Unauthorized sender address', { 
            userId: user._id, 
            attempted: address.address 
          });
          return callback(new Error('Not authorized to send from this address'));
        }
      }

      // SPF check for incoming mail
      if (!session.user) {
        const spfResult = await this.securityManager.checkSPF(
          session.remoteAddress, 
          address.address, 
          session.clientHostname
        );
        
        session.spfResult = spfResult;
        
        if (spfResult.result === 'fail') {
          logger.warn('SPF check failed', { 
            clientIP: session.remoteAddress,
            sender: address.address,
            result: spfResult
          });
          // Don't reject here, just log for later processing
        }
      }

      callback();
      
    } catch (error) {
      logger.error('MAIL FROM error:', error);
      callback(new Error('Sender address rejected'));
    }
  }

  async handleRcptTo(address, session, callback) {
    logger.info('RCPT TO command', {
      sessionId: session.id,
      to: address.address,
      clientIP: session.remoteAddress
    });

    try {
      // Initialize recipients array if not exists
      if (!session.envelope.rcptTo) {
        session.envelope.rcptTo = [];
      }

      // Check recipient limit
      if (session.envelope.rcptTo.length >= 100) {
        return callback(new Error('Too many recipients'));
      }

      const recipientEmail = address.address.toLowerCase();
      const recipientDomain = recipientEmail.split('@')[1];
      const serverDomain = this.config.hostname;

      // Check if this is a local domain
      const isLocalDomain = recipientDomain === serverDomain || 
                           await this.isAcceptedDomain(recipientDomain);

      if (isLocalDomain) {
        // Local delivery - check if user exists
        const recipient = await MailUser.findOne({ email: recipientEmail });
        if (!recipient) {
          // Check aliases
          const aliasOwner = await MailUser.findOne({
            'aliases.alias': recipientEmail,
            'aliases.isActive': true
          });
          
          if (!aliasOwner) {
            logger.warn('Recipient not found', { recipient: recipientEmail });
            return callback(new Error('User unknown'));
          }
        }
      } else {
        // Remote delivery - only allow if authenticated
        if (!session.user) {
          logger.warn('Relay attempt from unauthenticated user', {
            clientIP: session.remoteAddress,
            recipient: recipientEmail
          });
          return callback(new Error('Relay access denied'));
        }
      }

      // Add to recipients
      session.envelope.rcptTo.push(address);
      
      callback();
      
    } catch (error) {
      logger.error('RCPT TO error:', error);
      callback(new Error('Recipient address rejected'));
    }
  }

  async handleData(stream, session, callback) {
    logger.info('DATA command', {
      sessionId: session.id,
      clientIP: session.remoteAddress,
      recipientCount: session.envelope.rcptTo?.length || 0
    });

    try {
      let messageSize = 0;
      let messageData = '';
      
      // Collect message data
      stream.on('data', (chunk) => {
        messageSize += chunk.length;
        
        // Check message size limit
        if (messageSize > this.config.maxMessageSize) {
          stream.destroy();
          return callback(new Error('Message too large'));
        }
        
        messageData += chunk.toString();
      });

      stream.on('end', async () => {
        try {
          // Parse message
          const parsedMessage = await this.parseMessage(messageData, session);
          
          // Security checks
          await this.performSecurityChecks(parsedMessage, session);
          
          // Queue message for delivery
          await this.queueMessage(parsedMessage, session);
          
          // Update user statistics
          if (session.user) {
            const user = await MailUser.findById(session.user._id);
            await user.recordEmailSent();
          }

          // Update analytics
          this.analyticsService.recordEmailProcessed(session.remoteAddress, messageSize);
          
          logger.info('Message accepted for delivery', {
            sessionId: session.id,
            messageId: parsedMessage.messageId,
            size: messageSize
          });

          callback(null, 'Message accepted for delivery');
          
        } catch (error) {
          logger.error('Message processing error:', error);
          callback(error);
        }
      });

      stream.on('error', (error) => {
        logger.error('Stream error:', error);
        callback(new Error('Message transmission failed'));
      });
      
    } catch (error) {
      logger.error('DATA handling error:', error);
      callback(new Error('Message rejected'));
    }
  }

  async parseMessage(messageData, session) {
    const { simpleParser } = require('mailparser');
    
    return new Promise((resolve, reject) => {
      simpleParser(messageData, async (err, parsed) => {
        if (err) {
          return reject(err);
        }

        try {
          // Generate message ID if not present
          const messageId = parsed.messageId || this.generateMessageId();
          
          // Create message object
          const message = {
            messageId,
            from: {
              address: parsed.from?.value?.[0]?.address || session.envelope.mailFrom.address,
              name: parsed.from?.value?.[0]?.name
            },
            to: parsed.to?.value?.map(addr => ({
              address: addr.address,
              name: addr.name
            })) || session.envelope.rcptTo.map(addr => ({
              address: addr.address
            })),
            cc: parsed.cc?.value?.map(addr => ({
              address: addr.address,
              name: addr.name
            })) || [],
            bcc: parsed.bcc?.value?.map(addr => ({
              address: addr.address,
              name: addr.name
            })) || [],
            subject: parsed.subject || '(No Subject)',
            textContent: parsed.text,
            htmlContent: parsed.html,
            date: parsed.date || new Date(),
            size: Buffer.byteLength(messageData, 'utf8'),
            headers: new Map(Object.entries(parsed.headers || {})),
            attachments: parsed.attachments?.map(att => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              contentId: att.contentId,
              checksum: att.checksum
            })) || [],
            clientInfo: {
              ip: session.remoteAddress,
              hostname: session.clientHostname
            },
            rawMessage: messageData
          };

          resolve(message);
          
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async performSecurityChecks(message, session) {
    // DKIM verification
    if (this.securityManager.isDKIMEnabled()) {
      const dkimResult = await this.securityManager.verifyDKIM(message.rawMessage);
      message.dkim = dkimResult;
    }

    // DMARC check
    if (this.securityManager.isDMARCEnabled()) {
      const dmarcResult = await this.securityManager.checkDMARC(
        message.from.address,
        session.spfResult,
        message.dkim
      );
      message.dmarc = dmarcResult;
    }

    // Spam filtering
    if (this.securityManager.isAntiSpamEnabled()) {
      const spamResult = await this.securityManager.checkSpam(message);
      message.spamScore = spamResult.score;
      message.spamStatus = spamResult.status;
    }

    // Virus scanning
    if (this.securityManager.isAntiVirusEnabled()) {
      const virusResult = await this.securityManager.scanVirus(message);
      message.virusStatus = virusResult.status;
      
      if (virusResult.status === 'infected') {
        throw new Error('Message contains virus');
      }
    }
  }

  async queueMessage(message, session) {
    // Determine delivery type
    const isLocal = await this.isLocalDelivery(message.to);
    
    if (isLocal) {
      // Local delivery
      await this.mailQueue.addLocalDelivery(message, session.user);
    } else {
      // Remote delivery
      await this.mailQueue.addRemoteDelivery(message, session.user);
    }
  }

  async isLocalDelivery(recipients) {
    const serverDomain = this.config.hostname;
    
    for (const recipient of recipients) {
      const domain = recipient.address.split('@')[1];
      if (domain !== serverDomain && !await this.isAcceptedDomain(domain)) {
        return false;
      }
    }
    
    return true;
  }

  async isAcceptedDomain(domain) {
    // Check if domain is in accepted domains list
    // This could be stored in database or configuration
    const acceptedDomains = process.env.ACCEPTED_DOMAINS?.split(',') || [];
    return acceptedDomains.includes(domain);
  }

  generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `<${timestamp}.${random}@${this.config.hostname}>`;
  }

  handleClose(session) {
    logger.info('SMTP connection closed', {
      sessionId: session.id,
      clientIP: session.remoteAddress
    });
    
    this.analyticsService.recordConnectionClosed(session.remoteAddress);
  }

  handleError(error, session) {
    logger.error('SMTP server error', {
      sessionId: session?.id,
      clientIP: session?.remoteAddress,
      error: error.message
    });
    
    this.analyticsService.recordError('smtp', error.message);
  }
}

module.exports = QuantumSMTPServer;
