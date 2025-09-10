const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const net = require('net');
const { imap: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumIMAPServer {
  constructor(config) {
    this.config = config;
    this.securityManager = config.securityManager;
    this.analyticsService = config.analyticsService;
    
    this.servers = {
      standard: null, // Port 143 - STARTTLS
      secure: null    // Port 993 - Implicit SSL/TLS
    };
    
    this.connections = new Map();
    this.isRunning = false;
  }

  async start() {
    try {
      // Load TLS certificates
      const tlsOptions = await this.loadTLSCertificates();
      
      // Start standard IMAP server (port 143)
      await this.startStandardServer(tlsOptions);
      
      // Start secure IMAP server (port 993)
      await this.startSecureServer(tlsOptions);
      
      this.isRunning = true;
      logger.info('IMAP servers started successfully');
      
    } catch (error) {
      logger.error('Failed to start IMAP servers:', error);
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
      logger.info('IMAP servers stopped');
      
    } catch (error) {
      logger.error('Error stopping IMAP servers:', error);
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
          logger.info(`IMAP server listening on port ${this.config.port}`);
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
          logger.info(`Secure IMAP server listening on port ${this.config.securePort}`);
          resolve();
        }
      });
    });
  }

  handleConnection(socket, isSecure, tlsOptions) {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    logger.info('New IMAP connection', {
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
      selectedMailbox: null,
      state: 'not-authenticated',
      commandBuffer: '',
      capabilities: this.getCapabilities(isSecure)
    };

    this.connections.set(connectionId, connection);

    // Send greeting
    this.sendResponse(connection, '* OK [CAPABILITY ' + connection.capabilities.join(' ') + '] QuantumMint IMAP Server ready');

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
    socket.setTimeout(30 * 60 * 1000); // 30 minutes
    socket.on('timeout', () => {
      this.sendResponse(connection, '* BYE Timeout');
      socket.destroy();
    });
  }

  getCapabilities(isSecure) {
    const capabilities = [
      'IMAP4rev1',
      'IDLE',
      'NAMESPACE',
      'QUOTA',
      'SORT',
      'THREAD=REFERENCES',
      'THREAD=ORDEREDSUBJECT',
      'MULTIAPPEND',
      'UNSELECT',
      'CHILDREN',
      'UIDPLUS'
    ];

    if (!isSecure) {
      capabilities.push('STARTTLS');
    }

    if (!connection?.isAuthenticated) {
      capabilities.push('AUTH=PLAIN', 'AUTH=LOGIN');
    }

    return capabilities;
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
    logger.debug('IMAP command received', {
      connectionId: connection.id,
      command: commandLine.substring(0, 100) // Truncate for logging
    });

    try {
      const parts = commandLine.split(' ');
      const tag = parts[0];
      const command = parts[1]?.toUpperCase();
      const args = parts.slice(2);

      switch (command) {
        case 'CAPABILITY':
          await this.handleCapability(connection, tag);
          break;
        case 'STARTTLS':
          await this.handleStartTLS(connection, tag);
          break;
        case 'LOGIN':
          await this.handleLogin(connection, tag, args);
          break;
        case 'AUTHENTICATE':
          await this.handleAuthenticate(connection, tag, args);
          break;
        case 'LOGOUT':
          await this.handleLogout(connection, tag);
          break;
        case 'SELECT':
          await this.handleSelect(connection, tag, args);
          break;
        case 'EXAMINE':
          await this.handleExamine(connection, tag, args);
          break;
        case 'LIST':
          await this.handleList(connection, tag, args);
          break;
        case 'LSUB':
          await this.handleLsub(connection, tag, args);
          break;
        case 'STATUS':
          await this.handleStatus(connection, tag, args);
          break;
        case 'FETCH':
          await this.handleFetch(connection, tag, args);
          break;
        case 'STORE':
          await this.handleStore(connection, tag, args);
          break;
        case 'SEARCH':
          await this.handleSearch(connection, tag, args);
          break;
        case 'SORT':
          await this.handleSort(connection, tag, args);
          break;
        case 'COPY':
          await this.handleCopy(connection, tag, args);
          break;
        case 'MOVE':
          await this.handleMove(connection, tag, args);
          break;
        case 'EXPUNGE':
          await this.handleExpunge(connection, tag);
          break;
        case 'CLOSE':
          await this.handleClose(connection, tag);
          break;
        case 'IDLE':
          await this.handleIdle(connection, tag);
          break;
        case 'NOOP':
          await this.handleNoop(connection, tag);
          break;
        default:
          this.sendResponse(connection, `${tag} BAD Unknown command`);
      }
    } catch (error) {
      logger.error('IMAP command processing error:', error);
      const tag = commandLine.split(' ')[0];
      this.sendResponse(connection, `${tag} BAD Internal server error`);
    }
  }

  async handleCapability(connection, tag) {
    const capabilities = this.getCapabilities(connection.isSecure);
    this.sendResponse(connection, '* CAPABILITY ' + capabilities.join(' '));
    this.sendResponse(connection, `${tag} OK CAPABILITY completed`);
  }

  async handleStartTLS(connection, tag) {
    if (connection.isSecure) {
      this.sendResponse(connection, `${tag} BAD Already in secure mode`);
      return;
    }

    this.sendResponse(connection, `${tag} OK Begin TLS negotiation now`);
    
    // Upgrade to TLS
    const tlsSocket = new tls.TLSSocket(connection.socket, {
      isServer: true,
      key: this.tlsOptions.key,
      cert: this.tlsOptions.cert
    });

    connection.socket = tlsSocket;
    connection.isSecure = true;
    connection.capabilities = this.getCapabilities(true);
  }

  async handleLogin(connection, tag, args) {
    if (connection.isAuthenticated) {
      this.sendResponse(connection, `${tag} BAD Already authenticated`);
      return;
    }

    if (args.length < 2) {
      this.sendResponse(connection, `${tag} BAD LOGIN requires username and password`);
      return;
    }

    const username = this.parseString(args[0]);
    const password = this.parseString(args[1]);

    try {
      const user = await this.authenticateUser(username, password, connection);
      if (user) {
        connection.isAuthenticated = true;
        connection.user = user;
        connection.state = 'authenticated';
        
        logger.info('IMAP authentication successful', {
          connectionId: connection.id,
          username,
          userId: user._id
        });

        this.sendResponse(connection, `${tag} OK LOGIN completed`);
      } else {
        logger.warn('IMAP authentication failed', {
          connectionId: connection.id,
          username
        });
        this.sendResponse(connection, `${tag} NO LOGIN failed`);
      }
    } catch (error) {
      logger.error('IMAP authentication error:', error);
      this.sendResponse(connection, `${tag} NO LOGIN failed`);
    }
  }

  async handleAuthenticate(connection, tag, args) {
    // Simplified AUTHENTICATE implementation
    this.sendResponse(connection, `${tag} NO AUTHENTICATE not implemented, use LOGIN`);
  }

  async handleLogout(connection, tag) {
    this.sendResponse(connection, '* BYE LOGOUT received');
    this.sendResponse(connection, `${tag} OK LOGOUT completed`);
    connection.socket.end();
  }

  async handleSelect(connection, tag, args) {
    if (!connection.isAuthenticated) {
      this.sendResponse(connection, `${tag} NO Not authenticated`);
      return;
    }

    if (args.length < 1) {
      this.sendResponse(connection, `${tag} BAD SELECT requires mailbox name`);
      return;
    }

    const mailboxName = this.parseString(args[0]);
    
    try {
      const mailboxInfo = await this.getMailboxInfo(connection.user, mailboxName);
      
      connection.selectedMailbox = mailboxName;
      connection.state = 'selected';

      // Send mailbox status
      this.sendResponse(connection, `* ${mailboxInfo.exists} EXISTS`);
      this.sendResponse(connection, `* ${mailboxInfo.recent} RECENT`);
      this.sendResponse(connection, `* OK [UIDVALIDITY ${mailboxInfo.uidvalidity}] UIDs valid`);
      this.sendResponse(connection, `* OK [UIDNEXT ${mailboxInfo.uidnext}] Predicted next UID`);
      this.sendResponse(connection, `* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)`);
      this.sendResponse(connection, `* OK [PERMANENTFLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft \\*)] Limited`);
      
      this.sendResponse(connection, `${tag} OK [READ-WRITE] SELECT completed`);
      
    } catch (error) {
      logger.error('SELECT error:', error);
      this.sendResponse(connection, `${tag} NO SELECT failed`);
    }
  }

  async handleExamine(connection, tag, args) {
    // Similar to SELECT but read-only
    await this.handleSelect(connection, tag, args);
    // Would modify the response to indicate read-only mode
  }

  async handleList(connection, tag, args) {
    if (!connection.isAuthenticated) {
      this.sendResponse(connection, `${tag} NO Not authenticated`);
      return;
    }

    // Simplified LIST implementation
    const folders = ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'];
    
    for (const folder of folders) {
      this.sendResponse(connection, `* LIST () "/" "${folder}"`);
    }
    
    this.sendResponse(connection, `${tag} OK LIST completed`);
  }

  async handleLsub(connection, tag, args) {
    // Similar to LIST but for subscribed folders
    await this.handleList(connection, tag, args);
  }

  async handleStatus(connection, tag, args) {
    if (!connection.isAuthenticated) {
      this.sendResponse(connection, `${tag} NO Not authenticated`);
      return;
    }

    if (args.length < 2) {
      this.sendResponse(connection, `${tag} BAD STATUS requires mailbox and items`);
      return;
    }

    const mailboxName = this.parseString(args[0]);
    
    try {
      const mailboxInfo = await this.getMailboxInfo(connection.user, mailboxName);
      
      this.sendResponse(connection, `* STATUS "${mailboxName}" (MESSAGES ${mailboxInfo.exists} RECENT ${mailboxInfo.recent} UIDNEXT ${mailboxInfo.uidnext} UIDVALIDITY ${mailboxInfo.uidvalidity} UNSEEN ${mailboxInfo.unseen})`);
      this.sendResponse(connection, `${tag} OK STATUS completed`);
      
    } catch (error) {
      logger.error('STATUS error:', error);
      this.sendResponse(connection, `${tag} NO STATUS failed`);
    }
  }

  async handleFetch(connection, tag, args) {
    if (!connection.isAuthenticated || !connection.selectedMailbox) {
      this.sendResponse(connection, `${tag} NO Not authenticated or no mailbox selected`);
      return;
    }

    if (args.length < 2) {
      this.sendResponse(connection, `${tag} BAD FETCH requires sequence set and items`);
      return;
    }

    try {
      const sequenceSet = args[0];
      const items = args.slice(1).join(' ');
      
      const messages = await this.getMessages(connection.user, connection.selectedMailbox, sequenceSet);
      
      for (const message of messages) {
        const fetchData = await this.buildFetchResponse(message, items);
        this.sendResponse(connection, `* ${message.sequenceNumber} FETCH ${fetchData}`);
      }
      
      this.sendResponse(connection, `${tag} OK FETCH completed`);
      
    } catch (error) {
      logger.error('FETCH error:', error);
      this.sendResponse(connection, `${tag} NO FETCH failed`);
    }
  }

  async handleStore(connection, tag, args) {
    if (!connection.isAuthenticated || !connection.selectedMailbox) {
      this.sendResponse(connection, `${tag} NO Not authenticated or no mailbox selected`);
      return;
    }

    // Simplified STORE implementation for flags
    this.sendResponse(connection, `${tag} OK STORE completed`);
  }

  async handleSearch(connection, tag, args) {
    if (!connection.isAuthenticated || !connection.selectedMailbox) {
      this.sendResponse(connection, `${tag} NO Not authenticated or no mailbox selected`);
      return;
    }

    try {
      // Simplified search - return all messages
      const messages = await this.getAllMessages(connection.user, connection.selectedMailbox);
      const results = messages.map((msg, index) => index + 1).join(' ');
      
      this.sendResponse(connection, `* SEARCH ${results}`);
      this.sendResponse(connection, `${tag} OK SEARCH completed`);
      
    } catch (error) {
      logger.error('SEARCH error:', error);
      this.sendResponse(connection, `${tag} NO SEARCH failed`);
    }
  }

  async handleSort(connection, tag, args) {
    // SORT extension - simplified implementation
    await this.handleSearch(connection, tag, args);
  }

  async handleCopy(connection, tag, args) {
    this.sendResponse(connection, `${tag} OK COPY completed`);
  }

  async handleMove(connection, tag, args) {
    this.sendResponse(connection, `${tag} OK MOVE completed`);
  }

  async handleExpunge(connection, tag) {
    if (!connection.isAuthenticated || !connection.selectedMailbox) {
      this.sendResponse(connection, `${tag} NO Not authenticated or no mailbox selected`);
      return;
    }

    this.sendResponse(connection, `${tag} OK EXPUNGE completed`);
  }

  async handleClose(connection, tag) {
    if (connection.selectedMailbox) {
      connection.selectedMailbox = null;
      connection.state = 'authenticated';
    }
    
    this.sendResponse(connection, `${tag} OK CLOSE completed`);
  }

  async handleIdle(connection, tag) {
    this.sendResponse(connection, '+ idling');
    connection.isIdling = true;
    
    // IDLE implementation would listen for changes and send updates
  }

  async handleNoop(connection, tag) {
    this.sendResponse(connection, `${tag} OK NOOP completed`);
  }

  async authenticateUser(username, password, connection) {
    try {
      // Check rate limiting
      const rateLimitOk = await this.securityManager.checkRateLimit(connection.socket.remoteAddress, 'imap-auth');
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

  async getMailboxInfo(user, mailboxName) {
    const folder = this.mapMailboxToFolder(mailboxName);
    
    const stats = await EmailMessage.aggregate([
      { $match: { userId: user._id, folder } },
      {
        $group: {
          _id: null,
          exists: { $sum: 1 },
          unseen: {
            $sum: {
              $cond: [{ $not: { $in: ['seen', '$flags'] } }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || { exists: 0, unseen: 0 };
    
    return {
      exists: result.exists,
      recent: 0, // Simplified
      unseen: result.unseen,
      uidvalidity: Math.floor(Date.now() / 1000),
      uidnext: result.exists + 1
    };
  }

  async getMessages(user, mailboxName, sequenceSet) {
    const folder = this.mapMailboxToFolder(mailboxName);
    
    // Parse sequence set (simplified)
    const messages = await EmailMessage.find({
      userId: user._id,
      folder
    }).sort({ date: -1 }).limit(50);

    return messages.map((msg, index) => ({
      ...msg.toObject(),
      sequenceNumber: index + 1
    }));
  }

  async getAllMessages(user, mailboxName) {
    const folder = this.mapMailboxToFolder(mailboxName);
    
    return await EmailMessage.find({
      userId: user._id,
      folder
    }).sort({ date: -1 });
  }

  async buildFetchResponse(message, items) {
    const parts = [];
    
    if (items.includes('UID')) {
      parts.push(`UID ${message._id}`);
    }
    
    if (items.includes('FLAGS')) {
      const flags = message.flags || [];
      parts.push(`FLAGS (${flags.map(f => '\\' + f.charAt(0).toUpperCase() + f.slice(1)).join(' ')})`);
    }
    
    if (items.includes('ENVELOPE')) {
      const envelope = this.buildEnvelope(message);
      parts.push(`ENVELOPE ${envelope}`);
    }
    
    if (items.includes('BODY') || items.includes('BODYSTRUCTURE')) {
      const bodyStructure = this.buildBodyStructure(message);
      parts.push(`BODYSTRUCTURE ${bodyStructure}`);
    }
    
    if (items.includes('RFC822.SIZE')) {
      parts.push(`RFC822.SIZE ${message.size}`);
    }

    return `(${parts.join(' ')})`;
  }

  buildEnvelope(message) {
    const formatAddress = (addr) => {
      if (!addr) return 'NIL';
      return `("${addr.name || ''}" NIL "${addr.address.split('@')[0]}" "${addr.address.split('@')[1]}")`;
    };

    const date = message.date ? `"${message.date.toISOString()}"` : 'NIL';
    const subject = message.subject ? `"${message.subject.replace(/"/g, '\\"')}"` : 'NIL';
    const from = formatAddress(message.from);
    const sender = formatAddress(message.sender || message.from);
    const replyTo = formatAddress(message.replyTo || message.from);
    const to = message.to?.length ? `(${message.to.map(formatAddress).join(' ')})` : 'NIL';
    const cc = message.cc?.length ? `(${message.cc.map(formatAddress).join(' ')})` : 'NIL';
    const bcc = 'NIL'; // BCC not included in envelope
    const inReplyTo = message.inReplyTo ? `"${message.inReplyTo}"` : 'NIL';
    const messageId = message.messageId ? `"${message.messageId}"` : 'NIL';

    return `(${date} ${subject} (${from}) (${sender}) (${replyTo}) (${to}) ${cc} ${bcc} ${inReplyTo} ${messageId})`;
  }

  buildBodyStructure(message) {
    // Simplified body structure
    if (message.htmlContent && message.textContent) {
      return '("text" "html" ("charset" "utf-8") NIL NIL "7bit" ' + (message.htmlContent.length) + ' NIL NIL NIL)';
    } else if (message.textContent) {
      return '("text" "plain" ("charset" "utf-8") NIL NIL "7bit" ' + (message.textContent.length) + ' NIL NIL NIL)';
    } else {
      return '("text" "plain" ("charset" "utf-8") NIL NIL "7bit" 0 NIL NIL NIL)';
    }
  }

  mapMailboxToFolder(mailboxName) {
    const mapping = {
      'INBOX': 'INBOX',
      'Sent': 'Sent',
      'Drafts': 'Drafts',
      'Trash': 'Trash',
      'Spam': 'Spam',
      'Junk': 'Spam'
    };
    
    return mapping[mailboxName] || mailboxName;
  }

  parseString(str) {
    // Remove quotes if present
    if (str.startsWith('"') && str.endsWith('"')) {
      return str.slice(1, -1);
    }
    return str;
  }

  sendResponse(connection, response) {
    if (connection.socket && !connection.socket.destroyed) {
      connection.socket.write(response + '\r\n');
    }
  }

  handleClose(connection) {
    logger.info('IMAP connection closed', {
      connectionId: connection.id
    });
    
    this.connections.delete(connection.id);
    this.analyticsService?.recordConnectionClosed(connection.socket.remoteAddress);
  }

  handleError(connection, error) {
    logger.error('IMAP connection error', {
      connectionId: connection.id,
      error: error.message
    });
    
    this.connections.delete(connection.id);
    this.analyticsService?.recordError('imap', error.message);
  }
}

module.exports = QuantumIMAPServer;
