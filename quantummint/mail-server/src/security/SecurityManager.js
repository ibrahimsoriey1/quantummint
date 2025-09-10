const dns = require('dns').promises;
const crypto = require('crypto');
const { security: logger } = require('../utils/logger');

class SecurityManager {
  constructor(config) {
    this.config = config;
    this.spfCache = new Map();
    this.dkimCache = new Map();
    this.ipBlacklist = new Set();
    this.rateLimitCache = new Map();
    this.initialized = false;
  }

  async start() {
    try {
      // Load IP blacklists
      await this.loadIPBlacklists();
      
      // Initialize spam filter
      if (this.config.enableAntiSpam) {
        await this.initializeSpamFilter();
      }
      
      // Initialize antivirus
      if (this.config.enableAntiVirus) {
        await this.initializeAntiVirus();
      }
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      this.initialized = true;
      logger.info('Security Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Security Manager:', error);
      throw error;
    }
  }

  async loadIPBlacklists() {
    // Load from various RBL sources
    const rblSources = [
      'zen.spamhaus.org',
      'bl.spamcop.net',
      'dnsbl.sorbs.net',
      'cbl.abuseat.org'
    ];

    logger.info('Loading IP blacklists from RBL sources');
    
    // This would typically load from external RBL services
    // For now, we'll maintain a local blacklist
    const localBlacklist = process.env.IP_BLACKLIST?.split(',') || [];
    localBlacklist.forEach(ip => this.ipBlacklist.add(ip.trim()));
    
    logger.info(`Loaded ${this.ipBlacklist.size} blacklisted IPs`);
  }

  async initializeSpamFilter() {
    // Initialize SpamAssassin or similar
    logger.info('Initializing spam filter');
    
    // SpamAssassin configuration would go here
    this.spamFilter = {
      threshold: this.config.spamThreshold || 5.0,
      rules: await this.loadSpamRules()
    };
  }

  async initializeAntiVirus() {
    // Initialize ClamAV or similar
    logger.info('Initializing antivirus scanner');
    
    try {
      const clam = require('clamscan');
      this.antiVirus = await new clam().init({
        removeInfected: false,
        quarantineInfected: true,
        scanLog: null,
        debugMode: false,
        fileList: null,
        scanRecursively: true,
        clamscan: {
          path: '/usr/bin/clamscan',
          scanArchives: true,
          active: true
        },
        clamdscan: {
          socket: false,
          host: false,
          port: false,
          timeout: 60000,
          localFallback: true,
          path: '/usr/bin/clamdscan',
          configFile: null,
          multiscan: true,
          reloadDb: false,
          active: true,
          bypassTest: false
        },
        preference: 'clamdscan'
      });
      
      logger.info('Antivirus scanner initialized');
      
    } catch (error) {
      logger.warn('Failed to initialize antivirus scanner:', error.message);
      this.antiVirus = null;
    }
  }

  async loadSpamRules() {
    // Load spam detection rules
    return {
      // Content-based rules
      suspiciousWords: [
        'viagra', 'cialis', 'lottery', 'winner', 'congratulations',
        'urgent', 'act now', 'limited time', 'free money', 'click here'
      ],
      
      // Header-based rules
      suspiciousHeaders: [
        'x-spam-flag',
        'x-spam-status'
      ],
      
      // Pattern-based rules
      patterns: [
        /\$\d+[\s,]*million/i,
        /urgent[\s!]*reply/i,
        /act[\s!]*now/i,
        /limited[\s!]*time/i
      ]
    };
  }

  startCleanupTasks() {
    // Clean up caches every hour
    setInterval(() => {
      this.cleanupCaches();
    }, 60 * 60 * 1000);

    // Clean up rate limit cache every 15 minutes
    setInterval(() => {
      this.cleanupRateLimitCache();
    }, 15 * 60 * 1000);
  }

  cleanupCaches() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean SPF cache
    for (const [key, entry] of this.spfCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.spfCache.delete(key);
      }
    }

    // Clean DKIM cache
    for (const [key, entry] of this.dkimCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.dkimCache.delete(key);
      }
    }

    logger.debug('Security caches cleaned up');
  }

  cleanupRateLimitCache() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, entry] of this.rateLimitCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.rateLimitCache.delete(key);
      }
    }

    logger.debug('Rate limit cache cleaned up');
  }

  async isIPBlocked(ip) {
    // Check local blacklist
    if (this.ipBlacklist.has(ip)) {
      return true;
    }

    // Check RBL services
    return await this.checkRBL(ip);
  }

  async checkRBL(ip) {
    const rblSources = [
      'zen.spamhaus.org',
      'bl.spamcop.net',
      'dnsbl.sorbs.net'
    ];

    // Reverse IP for RBL lookup
    const reversedIP = ip.split('.').reverse().join('.');

    for (const rbl of rblSources) {
      try {
        const query = `${reversedIP}.${rbl}`;
        await dns.resolve4(query);
        
        logger.warn(`IP ${ip} found in RBL ${rbl}`);
        return true;
        
      } catch (error) {
        // Not found in this RBL, continue checking
        continue;
      }
    }

    return false;
  }

  async checkRateLimit(identifier, type = 'connection') {
    const key = `${identifier}:${type}`;
    const now = Date.now();
    const windowSize = 60 * 60 * 1000; // 1 hour
    const limit = this.config.rateLimitPerHour || 100;

    const entry = this.rateLimitCache.get(key);
    
    if (!entry) {
      this.rateLimitCache.set(key, {
        count: 1,
        timestamp: now,
        window: now
      });
      return true;
    }

    // Reset if window expired
    if (now - entry.window > windowSize) {
      entry.count = 1;
      entry.window = now;
      entry.timestamp = now;
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= limit) {
      logger.warn(`Rate limit exceeded for ${identifier}`, { type, count: entry.count });
      return false;
    }

    // Increment counter
    entry.count += 1;
    entry.timestamp = now;
    
    return true;
  }

  async checkSPF(ip, sender, hostname) {
    const domain = sender.split('@')[1];
    const cacheKey = `${ip}:${domain}`;
    
    // Check cache first
    const cached = this.spfCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.result;
    }

    try {
      const spfRecord = await this.getSPFRecord(domain);
      if (!spfRecord) {
        const result = { result: 'none', details: 'No SPF record found' };
        this.spfCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      const result = await this.evaluateSPF(spfRecord, ip, sender, hostname);
      this.spfCache.set(cacheKey, { result, timestamp: Date.now() });
      
      logger.debug('SPF check completed', { ip, sender, result: result.result });
      return result;
      
    } catch (error) {
      logger.error('SPF check failed:', error);
      return { result: 'temperror', details: error.message };
    }
  }

  async getSPFRecord(domain) {
    try {
      const records = await dns.resolveTxt(domain);
      
      for (const record of records) {
        const txt = record.join('');
        if (txt.startsWith('v=spf1')) {
          return txt;
        }
      }
      
      return null;
      
    } catch (error) {
      logger.debug(`No SPF record found for ${domain}`);
      return null;
    }
  }

  async evaluateSPF(spfRecord, ip, sender, hostname) {
    const mechanisms = spfRecord.split(' ').slice(1); // Remove 'v=spf1'
    
    for (const mechanism of mechanisms) {
      const result = await this.evaluateSPFMechanism(mechanism, ip, sender, hostname);
      
      if (result !== 'neutral') {
        return {
          result,
          details: `SPF mechanism '${mechanism}' evaluated to '${result}'`
        };
      }
    }
    
    return { result: 'neutral', details: 'No matching SPF mechanisms' };
  }

  async evaluateSPFMechanism(mechanism, ip, sender, hostname) {
    const qualifier = mechanism.charAt(0);
    const mech = qualifier === '+' || qualifier === '-' || qualifier === '~' || qualifier === '?' 
      ? mechanism.slice(1) 
      : mechanism;
    
    const action = qualifier === '-' ? 'fail' : 
                  qualifier === '~' ? 'softfail' : 
                  qualifier === '?' ? 'neutral' : 'pass';

    if (mech === 'all') {
      return action;
    }
    
    if (mech.startsWith('ip4:')) {
      const allowedIP = mech.substring(4);
      return ip === allowedIP ? action : 'neutral';
    }
    
    if (mech.startsWith('include:')) {
      const includeDomain = mech.substring(8);
      const includeResult = await this.checkSPF(ip, `test@${includeDomain}`, hostname);
      return includeResult.result === 'pass' ? action : 'neutral';
    }
    
    if (mech === 'a') {
      const domain = sender.split('@')[1];
      try {
        const addresses = await dns.resolve4(domain);
        return addresses.includes(ip) ? action : 'neutral';
      } catch (error) {
        return 'neutral';
      }
    }
    
    if (mech === 'mx') {
      const domain = sender.split('@')[1];
      try {
        const mxRecords = await dns.resolveMx(domain);
        for (const mx of mxRecords) {
          const addresses = await dns.resolve4(mx.exchange);
          if (addresses.includes(ip)) {
            return action;
          }
        }
        return 'neutral';
      } catch (error) {
        return 'neutral';
      }
    }
    
    return 'neutral';
  }

  async verifyDKIM(rawMessage) {
    if (!this.config.enableDKIM) {
      return { result: 'none', details: 'DKIM verification disabled' };
    }

    try {
      const dkimVerify = require('dkim-signer');
      const result = await dkimVerify.verify(rawMessage);
      
      logger.debug('DKIM verification completed', { result });
      return {
        result: result.success ? 'pass' : 'fail',
        signature: result.signature,
        details: result.info
      };
      
    } catch (error) {
      logger.error('DKIM verification failed:', error);
      return { result: 'temperror', details: error.message };
    }
  }

  async checkDMARC(sender, spfResult, dkimResult) {
    if (!this.config.enableDMARC) {
      return { result: 'none', details: 'DMARC checking disabled' };
    }

    const domain = sender.split('@')[1];
    
    try {
      const dmarcRecord = await this.getDMARCRecord(domain);
      if (!dmarcRecord) {
        return { result: 'none', details: 'No DMARC record found' };
      }

      const policy = this.parseDMARCRecord(dmarcRecord);
      const alignment = this.checkDMARCAlignment(sender, spfResult, dkimResult, policy);
      
      const result = {
        result: alignment ? 'pass' : 'fail',
        policy: policy.p,
        details: `DMARC policy: ${policy.p}, alignment: ${alignment}`
      };
      
      logger.debug('DMARC check completed', { sender, result: result.result });
      return result;
      
    } catch (error) {
      logger.error('DMARC check failed:', error);
      return { result: 'temperror', details: error.message };
    }
  }

  async getDMARCRecord(domain) {
    try {
      const records = await dns.resolveTxt(`_dmarc.${domain}`);
      
      for (const record of records) {
        const txt = record.join('');
        if (txt.startsWith('v=DMARC1')) {
          return txt;
        }
      }
      
      return null;
      
    } catch (error) {
      logger.debug(`No DMARC record found for ${domain}`);
      return null;
    }
  }

  parseDMARCRecord(record) {
    const policy = {};
    const parts = record.split(';');
    
    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key && value) {
        policy[key] = value;
      }
    }
    
    return policy;
  }

  checkDMARCAlignment(sender, spfResult, dkimResult, policy) {
    const senderDomain = sender.split('@')[1];
    
    // Check SPF alignment
    const spfAligned = spfResult.result === 'pass';
    
    // Check DKIM alignment
    const dkimAligned = dkimResult.result === 'pass';
    
    // DMARC requires at least one to pass
    return spfAligned || dkimAligned;
  }

  async checkSpam(message) {
    if (!this.config.enableAntiSpam) {
      return { score: 0, status: 'clean' };
    }

    let score = 0;
    const reasons = [];

    // Content analysis
    const contentScore = this.analyzeContent(message);
    score += contentScore.score;
    reasons.push(...contentScore.reasons);

    // Header analysis
    const headerScore = this.analyzeHeaders(message);
    score += headerScore.score;
    reasons.push(...headerScore.reasons);

    // Reputation analysis
    const reputationScore = await this.analyzeReputation(message);
    score += reputationScore.score;
    reasons.push(...reputationScore.reasons);

    // Determine status
    let status = 'clean';
    if (score >= 5.0) {
      status = 'spam';
    } else if (score >= 2.0) {
      status = 'suspicious';
    }

    logger.debug('Spam analysis completed', { 
      messageId: message.messageId, 
      score, 
      status, 
      reasons 
    });

    return { score, status, reasons };
  }

  analyzeContent(message) {
    let score = 0;
    const reasons = [];
    const rules = this.spamFilter.rules;

    // Check suspicious words
    const text = (message.textContent || '') + ' ' + (message.subject || '');
    const lowerText = text.toLowerCase();

    for (const word of rules.suspiciousWords) {
      if (lowerText.includes(word)) {
        score += 1.0;
        reasons.push(`Suspicious word: ${word}`);
      }
    }

    // Check patterns
    for (const pattern of rules.patterns) {
      if (pattern.test(text)) {
        score += 1.5;
        reasons.push(`Suspicious pattern matched`);
      }
    }

    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.3) {
      score += 1.0;
      reasons.push('Excessive capital letters');
    }

    // Check for excessive exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      score += 0.5;
      reasons.push('Excessive exclamation marks');
    }

    return { score, reasons };
  }

  analyzeHeaders(message) {
    let score = 0;
    const reasons = [];

    // Check for missing headers
    if (!message.headers.get('message-id')) {
      score += 1.0;
      reasons.push('Missing Message-ID header');
    }

    if (!message.headers.get('date')) {
      score += 0.5;
      reasons.push('Missing Date header');
    }

    // Check for suspicious headers
    for (const header of this.spamFilter.rules.suspiciousHeaders) {
      if (message.headers.get(header)) {
        score += 2.0;
        reasons.push(`Suspicious header: ${header}`);
      }
    }

    return { score, reasons };
  }

  async analyzeReputation(message) {
    let score = 0;
    const reasons = [];

    // Check sender reputation (simplified)
    const senderDomain = message.from.address.split('@')[1];
    
    // Check if sender domain is in known spam domains
    const spamDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    if (spamDomains.includes(senderDomain)) {
      score += 3.0;
      reasons.push('Sender from temporary email domain');
    }

    return { score, reasons };
  }

  async scanVirus(message) {
    if (!this.config.enableAntiVirus || !this.antiVirus) {
      return { status: 'clean', details: 'Antivirus scanning disabled or unavailable' };
    }

    try {
      // Scan message content
      const scanResult = await this.antiVirus.scanBuffer(
        Buffer.from(message.rawMessage),
        { scanLog: null, debugMode: false }
      );

      // Scan attachments if any
      for (const attachment of message.attachments || []) {
        if (attachment.content) {
          const attachmentResult = await this.antiVirus.scanBuffer(
            attachment.content,
            { scanLog: null, debugMode: false }
          );
          
          if (attachmentResult.isInfected) {
            return {
              status: 'infected',
              details: `Virus found in attachment: ${attachment.filename}`,
              virus: attachmentResult.viruses
            };
          }
        }
      }

      return {
        status: scanResult.isInfected ? 'infected' : 'clean',
        details: scanResult.isInfected ? 'Virus detected' : 'No virus found',
        virus: scanResult.viruses
      };
      
    } catch (error) {
      logger.error('Virus scanning failed:', error);
      return { status: 'error', details: error.message };
    }
  }

  // Utility methods
  isDKIMEnabled() {
    return this.config.enableDKIM;
  }

  isDMARCEnabled() {
    return this.config.enableDMARC;
  }

  isAntiSpamEnabled() {
    return this.config.enableAntiSpam;
  }

  isAntiVirusEnabled() {
    return this.config.enableAntiVirus;
  }
}

module.exports = SecurityManager;
