const dns = require('dns').promises;
const crypto = require('crypto');
const { dns: logger } = require('../utils/logger');

class QuantumDNSManager {
  constructor(config) {
    this.config = config;
    this.domain = config.domain || 'quantummint.com';
    this.dnsProviders = new Map();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    this.initializeDNSProviders();
  }

  initializeDNSProviders() {
    // Initialize supported DNS providers
    if (process.env.CLOUDFLARE_API_TOKEN) {
      this.dnsProviders.set('cloudflare', {
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        zoneId: process.env.CLOUDFLARE_ZONE_ID,
        baseUrl: 'https://api.cloudflare.com/client/v4'
      });
    }

    if (process.env.ROUTE53_ACCESS_KEY) {
      this.dnsProviders.set('route53', {
        accessKey: process.env.ROUTE53_ACCESS_KEY,
        secretKey: process.env.ROUTE53_SECRET_KEY,
        region: process.env.ROUTE53_REGION || 'us-east-1'
      });
    }

    if (process.env.DIGITALOCEAN_API_TOKEN) {
      this.dnsProviders.set('digitalocean', {
        apiToken: process.env.DIGITALOCEAN_API_TOKEN,
        baseUrl: 'https://api.digitalocean.com/v2'
      });
    }

    logger.info('DNS providers initialized', {
      providers: Array.from(this.dnsProviders.keys())
    });
  }

  async setupMailDNSRecords(domain = this.domain) {
    try {
      logger.info('Setting up mail DNS records', { domain });

      const records = await this.generateMailDNSRecords(domain);
      const results = [];

      for (const record of records) {
        try {
          const result = await this.createDNSRecord(domain, record);
          results.push({ ...record, success: true, result });
        } catch (error) {
          logger.error(`Failed to create DNS record ${record.name}:`, error);
          results.push({ ...record, success: false, error: error.message });
        }
      }

      logger.info('Mail DNS setup completed', {
        domain,
        total: records.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Error setting up mail DNS records:', error);
      throw error;
    }
  }

  async generateMailDNSRecords(domain) {
    const records = [];
    const mailServerIP = process.env.MAIL_SERVER_IP || '127.0.0.1';
    const webInterfaceIP = process.env.WEB_INTERFACE_IP || mailServerIP;

    // MX Record
    records.push({
      type: 'MX',
      name: domain,
      content: `10 mail.${domain}`,
      ttl: 3600,
      priority: 10
    });

    // A Records for mail server
    records.push({
      type: 'A',
      name: `mail.${domain}`,
      content: mailServerIP,
      ttl: 3600
    });

    records.push({
      type: 'A',
      name: `webmail.${domain}`,
      content: webInterfaceIP,
      ttl: 3600
    });

    // SPF Record
    const spfRecord = this.generateSPFRecord(domain, mailServerIP);
    records.push({
      type: 'TXT',
      name: domain,
      content: spfRecord,
      ttl: 3600
    });

    // DKIM Records
    const dkimRecords = await this.generateDKIMRecords(domain);
    records.push(...dkimRecords);

    // DMARC Record
    const dmarcRecord = this.generateDMARCRecord(domain);
    records.push({
      type: 'TXT',
      name: `_dmarc.${domain}`,
      content: dmarcRecord,
      ttl: 3600
    });

    // Additional mail-related records
    records.push(
      // Autodiscover for Outlook
      {
        type: 'CNAME',
        name: `autodiscover.${domain}`,
        content: `webmail.${domain}`,
        ttl: 3600
      },
      // SRV records for mail services
      {
        type: 'SRV',
        name: `_submission._tcp.${domain}`,
        content: `0 1 587 mail.${domain}`,
        ttl: 3600
      },
      {
        type: 'SRV',
        name: `_imap._tcp.${domain}`,
        content: `0 1 143 mail.${domain}`,
        ttl: 3600
      },
      {
        type: 'SRV',
        name: `_imaps._tcp.${domain}`,
        content: `0 1 993 mail.${domain}`,
        ttl: 3600
      },
      {
        type: 'SRV',
        name: `_pop3._tcp.${domain}`,
        content: `0 1 110 mail.${domain}`,
        ttl: 3600
      },
      {
        type: 'SRV',
        name: `_pop3s._tcp.${domain}`,
        content: `0 1 995 mail.${domain}`,
        ttl: 3600
      }
    );

    return records;
  }

  generateSPFRecord(domain, mailServerIP) {
    const mechanisms = [
      `ip4:${mailServerIP}`,
      `include:_spf.google.com`, // If using Google Workspace as backup
      'include:mailgun.org', // If using Mailgun for transactional emails
      '~all' // Soft fail for other sources
    ];

    return `v=spf1 ${mechanisms.join(' ')}`;
  }

  async generateDKIMRecords(domain) {
    const records = [];
    
    try {
      // Generate DKIM key pair if not exists
      const dkimKeys = await this.generateDKIMKeys(domain);
      
      for (const [selector, keyData] of Object.entries(dkimKeys)) {
        const publicKeyRecord = this.formatDKIMPublicKey(keyData.publicKey);
        
        records.push({
          type: 'TXT',
          name: `${selector}._domainkey.${domain}`,
          content: publicKeyRecord,
          ttl: 3600
        });
      }

    } catch (error) {
      logger.error('Error generating DKIM records:', error);
      // Add a placeholder DKIM record
      records.push({
        type: 'TXT',
        name: `quantum._domainkey.${domain}`,
        content: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...',
        ttl: 3600
      });
    }

    return records;
  }

  generateDMARCRecord(domain) {
    const policy = process.env.DMARC_POLICY || 'quarantine';
    const reportEmail = process.env.DMARC_REPORT_EMAIL || `dmarc-reports@${domain}`;
    
    return `v=DMARC1; p=${policy}; rua=mailto:${reportEmail}; ruf=mailto:${reportEmail}; fo=1`;
  }

  async generateDKIMKeys(domain) {
    const keys = {};
    const selectors = ['quantum', 'default'];

    for (const selector of selectors) {
      try {
        // Generate RSA key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });

        keys[selector] = {
          publicKey,
          privateKey,
          selector,
          domain
        };

        // Store private key for mail server use
        await this.storeDKIMPrivateKey(domain, selector, privateKey);

      } catch (error) {
        logger.error(`Error generating DKIM key for selector ${selector}:`, error);
      }
    }

    return keys;
  }

  formatDKIMPublicKey(publicKeyPem) {
    // Extract the public key data from PEM format
    const publicKeyData = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\n/g, '');

    return `v=DKIM1; k=rsa; p=${publicKeyData}`;
  }

  async storeDKIMPrivateKey(domain, selector, privateKey) {
    // In a real implementation, this would store the private key securely
    // For now, we'll log where it should be stored
    logger.info('DKIM private key generated', {
      domain,
      selector,
      storageLocation: `/etc/quantummail/dkim/${domain}/${selector}.private`
    });
  }

  async createDNSRecord(domain, record) {
    const provider = this.getPreferredDNSProvider();
    
    if (!provider) {
      throw new Error('No DNS provider configured');
    }

    switch (provider.name) {
      case 'cloudflare':
        return await this.createCloudflareRecord(domain, record, provider.config);
      case 'route53':
        return await this.createRoute53Record(domain, record, provider.config);
      case 'digitalocean':
        return await this.createDigitalOceanRecord(domain, record, provider.config);
      default:
        throw new Error(`Unsupported DNS provider: ${provider.name}`);
    }
  }

  async createCloudflareRecord(domain, record, config) {
    const fetch = require('node-fetch');
    
    const url = `${config.baseUrl}/zones/${config.zoneId}/dns_records`;
    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const data = {
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl || 3600
    };

    if (record.priority) {
      data.priority = record.priority;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cloudflare API error: ${error.errors?.[0]?.message || response.statusText}`);
    }

    return await response.json();
  }

  async createRoute53Record(domain, record, config) {
    // AWS SDK would be used here in a real implementation
    throw new Error('Route53 integration not implemented yet');
  }

  async createDigitalOceanRecord(domain, record, config) {
    const fetch = require('node-fetch');
    
    const url = `${config.baseUrl}/domains/${domain}/records`;
    const headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    const data = {
      type: record.type,
      name: record.name.replace(`.${domain}`, ''),
      data: record.content,
      ttl: record.ttl || 3600
    };

    if (record.priority) {
      data.priority = record.priority;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DigitalOcean API error: ${error.message || response.statusText}`);
    }

    return await response.json();
  }

  getPreferredDNSProvider() {
    const providers = Array.from(this.dnsProviders.entries());
    
    if (providers.length === 0) {
      return null;
    }

    // Return the first available provider
    const [name, config] = providers[0];
    return { name, config };
  }

  async verifyDNSRecords(domain = this.domain) {
    try {
      logger.info('Verifying DNS records', { domain });

      const results = {
        mx: await this.verifyMXRecord(domain),
        spf: await this.verifySPFRecord(domain),
        dkim: await this.verifyDKIMRecords(domain),
        dmarc: await this.verifyDMARCRecord(domain)
      };

      const allValid = Object.values(results).every(r => r.valid);
      
      logger.info('DNS verification completed', {
        domain,
        allValid,
        results
      });

      return { domain, valid: allValid, details: results };

    } catch (error) {
      logger.error('Error verifying DNS records:', error);
      throw error;
    }
  }

  async verifyMXRecord(domain) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      const hasMailServer = mxRecords.some(mx => 
        mx.exchange.includes('mail.') || mx.exchange.includes(domain)
      );

      return {
        valid: hasMailServer,
        records: mxRecords,
        message: hasMailServer ? 'MX record found' : 'No valid MX record found'
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'Failed to resolve MX records'
      };
    }
  }

  async verifySPFRecord(domain) {
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const spfRecord = txtRecords.find(record => 
        record.some(txt => txt.startsWith('v=spf1'))
      );

      return {
        valid: !!spfRecord,
        record: spfRecord?.[0],
        message: spfRecord ? 'SPF record found' : 'No SPF record found'
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'Failed to resolve SPF record'
      };
    }
  }

  async verifyDKIMRecords(domain) {
    const selectors = ['quantum', 'default', 'selector1', 'google'];
    const results = [];

    for (const selector of selectors) {
      try {
        const dkimDomain = `${selector}._domainkey.${domain}`;
        const txtRecords = await dns.resolveTxt(dkimDomain);
        const dkimRecord = txtRecords.find(record =>
          record.some(txt => txt.includes('v=DKIM1'))
        );

        if (dkimRecord) {
          results.push({
            selector,
            valid: true,
            record: dkimRecord[0]
          });
        }

      } catch (error) {
        // DKIM record not found for this selector (normal)
      }
    }

    return {
      valid: results.length > 0,
      selectors: results,
      message: results.length > 0 ? 
        `Found ${results.length} DKIM record(s)` : 
        'No DKIM records found'
    };
  }

  async verifyDMARCRecord(domain) {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await dns.resolveTxt(dmarcDomain);
      const dmarcRecord = txtRecords.find(record =>
        record.some(txt => txt.startsWith('v=DMARC1'))
      );

      return {
        valid: !!dmarcRecord,
        record: dmarcRecord?.[0],
        message: dmarcRecord ? 'DMARC record found' : 'No DMARC record found'
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'Failed to resolve DMARC record'
      };
    }
  }

  async getDNSRecommendations(domain = this.domain) {
    try {
      const verification = await this.verifyDNSRecords(domain);
      const recommendations = [];

      if (!verification.details.mx.valid) {
        recommendations.push({
          type: 'MX',
          priority: 'high',
          message: 'Add MX record pointing to your mail server',
          record: `${domain} MX 10 mail.${domain}`
        });
      }

      if (!verification.details.spf.valid) {
        recommendations.push({
          type: 'SPF',
          priority: 'high',
          message: 'Add SPF record to prevent email spoofing',
          record: `${domain} TXT "${this.generateSPFRecord(domain, process.env.MAIL_SERVER_IP || '127.0.0.1')}"`
        });
      }

      if (!verification.details.dkim.valid) {
        recommendations.push({
          type: 'DKIM',
          priority: 'medium',
          message: 'Add DKIM records for email authentication',
          record: 'Generate DKIM keys and add public key to DNS'
        });
      }

      if (!verification.details.dmarc.valid) {
        recommendations.push({
          type: 'DMARC',
          priority: 'medium',
          message: 'Add DMARC record for email policy',
          record: `_dmarc.${domain} TXT "${this.generateDMARCRecord(domain)}"`
        });
      }

      return {
        domain,
        score: this.calculateDNSScore(verification.details),
        recommendations
      };

    } catch (error) {
      logger.error('Error generating DNS recommendations:', error);
      throw error;
    }
  }

  calculateDNSScore(details) {
    let score = 0;
    let maxScore = 0;

    // MX record (30 points)
    maxScore += 30;
    if (details.mx.valid) score += 30;

    // SPF record (25 points)
    maxScore += 25;
    if (details.spf.valid) score += 25;

    // DKIM records (25 points)
    maxScore += 25;
    if (details.dkim.valid) score += 25;

    // DMARC record (20 points)
    maxScore += 20;
    if (details.dmarc.valid) score += 20;

    return Math.round((score / maxScore) * 100);
  }

  async monitorDNSChanges(domain = this.domain) {
    // This would set up monitoring for DNS record changes
    logger.info('DNS monitoring started', { domain });
    
    // In a real implementation, this would:
    // 1. Periodically check DNS records
    // 2. Alert on changes
    // 3. Validate mail server accessibility
    // 4. Check blacklist status
  }

  async generateDNSReport(domain = this.domain) {
    try {
      const verification = await this.verifyDNSRecords(domain);
      const recommendations = await this.getDNSRecommendations(domain);
      
      return {
        domain,
        timestamp: new Date(),
        verification,
        recommendations,
        summary: {
          score: recommendations.score,
          criticalIssues: recommendations.recommendations.filter(r => r.priority === 'high').length,
          totalRecommendations: recommendations.recommendations.length
        }
      };

    } catch (error) {
      logger.error('Error generating DNS report:', error);
      throw error;
    }
  }
}

module.exports = QuantumDNSManager;
