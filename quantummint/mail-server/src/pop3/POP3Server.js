const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pop3: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumPOP3Server {
  constructor(config) {
    this.config = config;
    this.securityManager = config.securityManager;
    this.analyticsService = config.analyticsService;
    
    this.servers = {
      standard: null, // Port 110 - STARTTLS
      secure: null    // Port 995 - Implicit SSL/TLS
    };
    
    this.connections = new Map();
    this.isRunning = false;
  }

  async start() {
    try {
      // Load TLS certificates
      const tlsOptions = await this.loadTLSCertificates();
      
      // Start standard POP3 server (port 110)
      await this.startStandardServer(tlsOptions);
      
      // Start secure POP3 server (port 995)
      await this.startSecureServer(tlsOptions);
      
      this.isRunning = true;
      logger.info('POP3 servers started successfully');
      
    } catch (error) {
      logger.error('Failed to start POP3 servers:', error);
      throw error;
    }
  }

  async stop() {
    try {
      // Close all active connections
      for (const [connectionId, connection] of this.connections) {
        try {
          connection.socket.destroy();
        } catch (error) {
          logger.warn(`Error closing connection ${connectionId}:`, error);
        }
      }
      this.connections.clear();

      // Close servers
      const closePromises = [];
      if (this.servers.standard) {
        closePromises.push(new Promise(resolve => this.servers.standard.close(resolve)));
      }
      if (this.servers.secure) {
        closePromises.push(new Promise(resolve => this.servers.secure.close(resolve)));
      }
      
      await Promise.all(closePromises);
      this.isRunning = false;
      logger.info('POP3 servers stopped');
      
    } catch (error) {
      logger.error('Error stopping POP3 servers:', error);
      throw error;
    }
  }

  async loadTLSCertificates() {
    const certPath = process.env.TLS_CERT_PATH || path.join(__dirname, '../../certs');
    
    try {
      return {
        key: fs.readFileSync(path.join(certPath, 'private.key')),
        cert: fs.readFileSync(path.join(certPath, 'certificate.crt'))
      };
    } catch (error) {
      logger.warn('TLS certificates not found, using self-signed certificates');
      // Use the same certificate generation logic as SMTP server
      const SMTPServer = require('../smtp/SMTPServer');
      const smtpServer = new SMTPServer(this.config);
      return await smtpServer.generateSelfSignedCertificates();
    }
  }

  async startStandardServer(tlsOptions) {
    this.servers.standard = net.createServer((socket) => {
      this.handleConnection(socket, false, tlsOptions);
    });

    return new Promise((resolve, reject) => {
      this.servers.standard.listen(this.config.port, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`POP3 server listening on port ${this.config.port}`);
          resolve();
        }
      });
    });
  }

  async startSecureServer(tlsOptions) {
    this.servers.secure = tls.createServer(tlsOptions, (socket) => {
      this.handleConnection(socket, true, tlsOptions);
    });

    return new Promise((resolve, reject) => {
      this.servers.secure.listen(this.config.securePort, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Secure POP3 server listening on port ${this.config.securePort}`);
          resolve();
        }
      });
    });
  }

  handleConnection(socket, isSecure, tlsOptions) {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    logger.info('New POP3 connection', {
      connectionId,
      clientIP: socket.remoteAddress,
      secure: isSecure
    });

    const connection = {
      id: connectionId,
      socket,
      isSecure,
      isAuthenticated: false,
      user: null,
      state: 'authorization', // authorization, transaction, update
      commandBuffer: '',
      messages: [],
      deletedMessages: new Set(),
      tlsOptions
    };

    this.connections.set(connectionId, connection);

    // Send greeting
    this.sendResponse(connection, '+OK QuantumMint POP3 Server ready');

    // Handle data
    socket.on('data', (data) => {
      this.handleData(connection, data);
    });

    // Handle connection close
    socket.on('close', () => {
      this.handleClose(connection);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.handleError(connection, error);
    });

    // Set timeout
    socket.setTimeout(10 * 60 * 1000); // 10 minutes
    socket.on('timeout', () => {
      this.sendResponse(connection, '-ERR Timeout');
      socket.destroy();
    });
  }

  handleData(connection, data) {
    connection.commandBuffer += data.toString();

    // Process complete lines
    const lines = connection.commandBuffer.split('\r\n');
    connection.commandBuffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        this.processCommand(connection, line.trim());
      }
    }
  }

  async processCommand(connection, commandLine) {
    logger.debug('POP3 command received', {
      connectionId: connection.id,
      command: commandLine.substring(0, 50) // Truncate for logging
    });

    try {
      const parts = commandLine.split(' ');
      const command = parts[0].toUpperCase();
      const args = parts.slice(1);

      switch (command) {
        case 'CAPA':
          await this.handleCapabilities(connection);
          break;
        case 'STLS':
          await this.handleStartTLS(connection);
          break;
        case 'USER':
          await this.handleUser(connection, args);
          break;
        case 'PASS':
          await this.handlePass(connection, args);
          break;
        case 'APOP':
          await this.handleApop(connection, args);
          break;
        case 'STAT':
          await this.handleStat(connection);
          break;
        case 'LIST':
          await this.handleList(connection, args);
          break;
        case 'RETR':
          await this.handleRetr(connection, args);
          break;
        case 'DELE':
          await this.handleDele(connection, args);
          break;
        case 'NOOP':
          await this.handleNoop(connection);
          break;
        case 'RSET':
          await this.handleRset(connection);
          break;
        case 'TOP':
          await this.handleTop(connection, args);
          break;
        case 'UIDL':
          await this.handleUidl(connection, args);
          break;
        case 'QUIT':
          await this.handleQuit(connection);
          break;
        default:
          this.sendResponse(connection, '-ERR Unknown command');
      }
    } catch (error) {
      logger.error('POP3 command processing error:', error);
      this.sendResponse(connection, '-ERR Internal server error');
    }
  }

  async handleCapabilities(connection) {
    const capabilities = [
      'TOP',
      'UIDL',
      'RESP-CODES',
      'PIPELINING',
      'USER'
    ];

    if (!connection.isSecure) {
      capabilities.push('STLS');
    }

    this.sendResponse(connection, '+OK Capability list follows');
    for (const cap of capabilities) {
      this.sendResponse(connection, cap);
    }
    this.sendResponse(connection, '.');
  }

  async handleStartTLS(connection) {
    if (connection.isSecure) {
      this.sendResponse(connection, '-ERR Already in secure mode');
      return;
    }

    this.sendResponse(connection, '+OK Begin TLS negotiation');
    
    // Upgrade to TLS
    const tlsSocket = new tls.TLSSocket(connection.socket, {
      isServer: true,
      key: connection.tlsOptions.key,
      cert: connection.tlsOptions.cert
    });

    connection.socket = tlsSocket;
    connection.isSecure = true;
  }

  async handleUser(connection, args) {
    if (connection.state !== 'authorization') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 1) {
      this.sendResponse(connection, '-ERR USER requires username');
      return;
    }

    connection.username = args[0];
    this.sendResponse(connection, '+OK User accepted');
  }

  async handlePass(connection, args) {
    if (connection.state !== 'authorization' || !connection.username) {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 1) {
      this.sendResponse(connection, '-ERR PASS requires password');
      return;
    }

    const password = args.join(' '); // In case password contains spaces

    try {
      const user = await this.authenticateUser(connection.username, password, connection);
      if (user) {
        connection.isAuthenticated = true;
        connection.user = user;
        connection.state = 'transaction';
        
        // Load user's messages
        await this.loadMessages(connection);
        
        logger.info('POP3 authentication successful', {
          connectionId: connection.id,
          username: connection.username,
          userId: user._id
        });

        this.sendResponse(connection, `+OK Maildrop ready, ${connection.messages.length} messages`);
      } else {
        logger.warn('POP3 authentication failed', {
          connectionId: connection.id,
          username: connection.username
        });
        this.sendResponse(connection, '-ERR Authentication failed');
        connection.username = null;
      }
    } catch (error) {
      logger.error('POP3 authentication error:', error);
      this.sendResponse(connection, '-ERR Authentication failed');
      connection.username = null;
    }
  }

  async handleApop(connection, args) {
    if (connection.state !== 'authorization') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 2) {
      this.sendResponse(connection, '-ERR APOP requires username and digest');
      return;
    }

    // APOP authentication not implemented in this simplified version
    this.sendResponse(connection, '-ERR APOP not supported');
  }

  async handleStat(connection) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    const activeMessages = connection.messages.filter(msg => !connection.deletedMessages.has(msg.index));
    const totalSize = activeMessages.reduce((sum, msg) => sum + msg.size, 0);

    this.sendResponse(connection, `+OK ${activeMessages.length} ${totalSize}`);
  }

  async handleList(connection, args) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length > 0) {
      // LIST specific message
      const messageIndex = parseInt(args[0]);
      const message = connection.messages.find(msg => msg.index === messageIndex);
      
      if (!message || connection.deletedMessages.has(messageIndex)) {
        this.sendResponse(connection, '-ERR No such message');
        return;
      }

      this.sendResponse(connection, `+OK ${messageIndex} ${message.size}`);
    } else {
      // LIST all messages
      const activeMessages = connection.messages.filter(msg => !connection.deletedMessages.has(msg.index));
      
      this.sendResponse(connection, `+OK ${activeMessages.length} messages`);
      for (const message of activeMessages) {
        this.sendResponse(connection, `${message.index} ${message.size}`);
      }
      this.sendResponse(connection, '.');
    }
  }

  async handleRetr(connection, args) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 1) {
      this.sendResponse(connection, '-ERR RETR requires message number');
      return;
    }

    const messageIndex = parseInt(args[0]);
    const message = connection.messages.find(msg => msg.index === messageIndex);
    
    if (!message || connection.deletedMessages.has(messageIndex)) {
      this.sendResponse(connection, '-ERR No such message');
      return;
    }

    try {
      const fullMessage = await this.getFullMessage(message.id);
      this.sendResponse(connection, `+OK ${message.size} octets`);
      this.sendResponse(connection, fullMessage);
      this.sendResponse(connection, '.');
      
      // Mark as read
      await this.markMessageAsRead(message.id);
      
    } catch (error) {
      logger.error('Error retrieving message:', error);
      this.sendResponse(connection, '-ERR Unable to retrieve message');
    }
  }

  async handleDele(connection, args) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 1) {
      this.sendResponse(connection, '-ERR DELE requires message number');
      return;
    }

    const messageIndex = parseInt(args[0]);
    const message = connection.messages.find(msg => msg.index === messageIndex);
    
    if (!message || connection.deletedMessages.has(messageIndex)) {
      this.sendResponse(connection, '-ERR No such message');
      return;
    }

    connection.deletedMessages.add(messageIndex);
    this.sendResponse(connection, `+OK Message ${messageIndex} deleted`);
  }

  async handleNoop(connection) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    this.sendResponse(connection, '+OK');
  }

  async handleRset(connection) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    connection.deletedMessages.clear();
    this.sendResponse(connection, '+OK Reset completed');
  }

  async handleTop(connection, args) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length < 2) {
      this.sendResponse(connection, '-ERR TOP requires message number and line count');
      return;
    }

    const messageIndex = parseInt(args[0]);
    const lineCount = parseInt(args[1]);
    const message = connection.messages.find(msg => msg.index === messageIndex);
    
    if (!message || connection.deletedMessages.has(messageIndex)) {
      this.sendResponse(connection, '-ERR No such message');
      return;
    }

    try {
      const messageTop = await this.getMessageTop(message.id, lineCount);
      this.sendResponse(connection, '+OK Top of message follows');
      this.sendResponse(connection, messageTop);
      this.sendResponse(connection, '.');
      
    } catch (error) {
      logger.error('Error retrieving message top:', error);
      this.sendResponse(connection, '-ERR Unable to retrieve message');
    }
  }

  async handleUidl(connection, args) {
    if (connection.state !== 'transaction') {
      this.sendResponse(connection, '-ERR Command not valid in this state');
      return;
    }

    if (args.length > 0) {
      // UIDL specific message
      const messageIndex = parseInt(args[0]);
      const message = connection.messages.find(msg => msg.index === messageIndex);
      
      if (!message || connection.deletedMessages.has(messageIndex)) {
        this.sendResponse(connection, '-ERR No such message');
        return;
      }

      this.sendResponse(connection, `+OK ${messageIndex} ${message.uidl}`);
    } else {
      // UIDL all messages
      const activeMessages = connection.messages.filter(msg => !connection.deletedMessages.has(msg.index));
      
      this.sendResponse(connection, '+OK Unique-ID listing follows');
      for (const message of activeMessages) {
        this.sendResponse(connection, `${message.index} ${message.uidl}`);
      }
      this.sendResponse(connection, '.');
    }
  }

  async handleQuit(connection) {
    if (connection.state === 'transaction') {
      // Enter UPDATE state and commit deletions
      connection.state = 'update';
      
      try {
        await this.commitDeletions(connection);
        const deletedCount = connection.deletedMessages.size;
        this.sendResponse(connection, `+OK QuantumMint POP3 Server signing off (${deletedCount} messages deleted)`);
      } catch (error) {
        logger.error('Error committing deletions:', error);
        this.sendResponse(connection, '-ERR Some deleted messages not removed');
      }
    } else {
      this.sendResponse(connection, '+OK QuantumMint POP3 Server signing off');
    }
    
    connection.socket.end();
  }

  async authenticateUser(username, password, connection) {
    try {
      // Check rate limiting
      const rateLimitOk = await this.securityManager.checkRateLimit(connection.socket.remoteAddress, 'pop3-auth');
      if (!rateLimitOk) {
        throw new Error('Rate limit exceeded');
      }

      const user = await MailUser.findByEmailOrUsername(username);
      if (!user || !user.isActive || user.isLocked) {
        return null;
      }

      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        await user.incLoginAttempts();
        return null;
      }

      await user.resetLoginAttempts();
      user.lastLogin = new Date();
      await user.save();

      return user;
      
    } catch (error) {
      logger.error('User authentication error:', error);
      return null;
    }
  }

  async loadMessages(connection) {
    try {
      // Load messages from INBOX only (POP3 typically only shows INBOX)
      const messages = await EmailMessage.find({
        userId: connection.user._id,
        folder: 'INBOX'
      }).sort({ date: -1 });

      connection.messages = messages.map((msg, index) => ({
        index: index + 1,
        id: msg._id,
        size: msg.size,
        uidl: this.generateUIDL(msg._id, msg.date)
      }));

      logger.debug('Messages loaded for POP3 session', {
        connectionId: connection.id,
        messageCount: connection.messages.length
      });
      
    } catch (error) {
      logger.error('Error loading messages:', error);
      connection.messages = [];
    }
  }

  async getFullMessage(messageId) {
    try {
      const message = await EmailMessage.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Build RFC822 message
      let rfc822 = '';
      
      // Headers
      rfc822 += `Message-ID: ${message.messageId}\r\n`;
      rfc822 += `Date: ${message.date.toUTCString()}\r\n`;
      rfc822 += `From: ${this.formatAddress(message.from)}\r\n`;
      
      if (message.to && message.to.length > 0) {
        rfc822 += `To: ${message.to.map(addr => this.formatAddress(addr)).join(', ')}\r\n`;
      }
      
      if (message.cc && message.cc.length > 0) {
        rfc822 += `Cc: ${message.cc.map(addr => this.formatAddress(addr)).join(', ')}\r\n`;
      }
      
      rfc822 += `Subject: ${message.subject}\r\n`;
      
      // Add other headers
      if (message.headers) {
        for (const [key, value] of message.headers) {
          if (!['message-id', 'date', 'from', 'to', 'cc', 'subject'].includes(key.toLowerCase())) {
            rfc822 += `${key}: ${value}\r\n`;
          }
        }
      }
      
      rfc822 += `Content-Type: ${message.htmlContent ? 'text/html' : 'text/plain'}; charset=utf-8\r\n`;
      rfc822 += `Content-Transfer-Encoding: 8bit\r\n`;
      rfc822 += `\r\n`;
      
      // Body
      rfc822 += message.htmlContent || message.textContent || '';
      
      return rfc822;
      
    } catch (error) {
      logger.error('Error building full message:', error);
      throw error;
    }
  }

  async getMessageTop(messageId, lineCount) {
    try {
      const fullMessage = await this.getFullMessage(messageId);
      const lines = fullMessage.split('\r\n');
      
      // Find end of headers
      let headerEnd = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === '') {
          headerEnd = i;
          break;
        }
      }
      
      // Return headers + specified number of body lines
      const result = lines.slice(0, headerEnd + 1 + lineCount).join('\r\n');
      return result;
      
    } catch (error) {
      logger.error('Error building message top:', error);
      throw error;
    }
  }

  async markMessageAsRead(messageId) {
    try {
      const message = await EmailMessage.findById(messageId);
      if (message) {
        await message.addFlag('seen');
      }
    } catch (error) {
      logger.error('Error marking message as read:', error);
    }
  }

  async commitDeletions(connection) {
    try {
      const deletionPromises = [];
      
      for (const messageIndex of connection.deletedMessages) {
        const message = connection.messages.find(msg => msg.index === messageIndex);
        if (message) {
          deletionPromises.push(
            EmailMessage.findByIdAndUpdate(message.id, {
              $addToSet: { flags: 'deleted' },
              folder: 'Trash'
            })
          );
        }
      }
      
      await Promise.all(deletionPromises);
      
      logger.info('POP3 deletions committed', {
        connectionId: connection.id,
        deletedCount: connection.deletedMessages.size
      });
      
    } catch (error) {
      logger.error('Error committing deletions:', error);
      throw error;
    }
  }

  generateUIDL(messageId, date) {
    // Generate unique ID for message
    const hash = crypto.createHash('md5');
    hash.update(messageId.toString() + date.toISOString());
    return hash.digest('hex');
  }

  formatAddress(address) {
    if (!address) return '';
    
    if (address.name) {
      return `"${address.name}" <${address.address}>`;
    } else {
      return address.address;
    }
  }

  sendResponse(connection, response) {
    if (connection.socket && !connection.socket.destroyed) {
      connection.socket.write(response + '\r\n');
    }
  }

  handleClose(connection) {
    logger.info('POP3 connection closed', {
      connectionId: connection.id
    });
    
    this.connections.delete(connection.id);
    this.analyticsService?.recordConnectionClosed(connection.socket.remoteAddress);
  }

  handleError(connection, error) {
    logger.error('POP3 connection error', {
      connectionId: connection.id,
      error: error.message
    });
    
    this.connections.delete(connection.id);
    this.analyticsService?.recordError('pop3', error.message);
  }
}

module.exports = QuantumPOP3Server;
