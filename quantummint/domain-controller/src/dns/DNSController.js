const dgram = require('dgram');
const dns2 = require('dns2');
const { dns: logger } = require('../utils/logger');

class DNSController {
  constructor(config) {
    this.config = config;
    this.domain = config.domain;
    this.directoryService = config.directoryService;
    
    this.server = null;
    this.zones = new Map();
    this.forwarders = config.forwarders || ['8.8.8.8', '1.1.1.1'];
    this.isRunning = false;
    
    // DNS record types
    this.recordTypes = {
      A: 1,
      NS: 2,
      CNAME: 5,
      SOA: 6,
      PTR: 12,
      MX: 15,
      TXT: 16,
      AAAA: 28,
      SRV: 33
    };
  }

  async start() {
    try {
      // Initialize DNS zones
      await this.initializeZones();
      
      // Create DNS server
      this.server = dns2.createServer({
        udp: true,
        tcp: true,
        handle: (request, send, rinfo) => {
          this.handleDNSRequest(request, send, rinfo);
        }
      });

      // Start DNS server
      await new Promise((resolve, reject) => {
        this.server.listen({
          udp: this.config.port,
          tcp: this.config.port
        }, (err) => {
          if (err) {
            reject(err);
          } else {
            this.isRunning = true;
            logger.info(`DNS server listening on port ${this.config.port}`);
            resolve();
          }
        });
      });

    } catch (error) {
      logger.error('Failed to start DNS server:', error);
      throw error;
    }
  }

  async initializeZones() {
    try {
      // Create forward lookup zone for domain
      await this.createForwardZone(this.domain.name);
      
      // Create reverse lookup zones
      await this.createReverseZones();
      
      // Create service records
      await this.createServiceRecords();
      
      logger.info('DNS zones initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DNS zones:', error);
      throw error;
    }
  }

  async createForwardZone(zoneName) {
    const zone = {
      name: zoneName,
      type: 'forward',
      records: new Map(),
      serial: this.generateSerial(),
      refresh: 3600,
      retry: 600,
      expire: 604800,
      minimum: 86400
    };

    // SOA record
    zone.records.set(`${zoneName}.`, [{
      type: 'SOA',
      ttl: 3600,
      data: {
        mname: `dc1.${zoneName}.`,
        rname: `hostmaster.${zoneName}.`,
        serial: zone.serial,
        refresh: zone.refresh,
        retry: zone.retry,
        expire: zone.expire,
        minimum: zone.minimum
      }
    }]);

    // NS records
    zone.records.set(`${zoneName}.`, [
      ...(zone.records.get(`${zoneName}.`) || []),
      {
        type: 'NS',
        ttl: 3600,
        data: `dc1.${zoneName}.`
      }
    ]);

    // A record for domain controller
    zone.records.set(`dc1.${zoneName}.`, [{
      type: 'A',
      ttl: 3600,
      data: '192.168.1.10' // Default DC IP
    }]);

    // MX record for mail
    zone.records.set(`${zoneName}.`, [
      ...(zone.records.get(`${zoneName}.`) || []),
      {
        type: 'MX',
        ttl: 3600,
        data: {
          priority: 10,
          exchange: `mail.${zoneName}.`
        }
      }
    ]);

    // A record for mail server
    zone.records.set(`mail.${zoneName}.`, [{
      type: 'A',
      ttl: 3600,
      data: '192.168.1.20' // Default mail server IP
    }]);

    this.zones.set(zoneName, zone);
    logger.info(`Created forward zone: ${zoneName}`);
  }

  async createReverseZones() {
    // Create reverse lookup zone for 192.168.1.0/24
    const reverseZone = {
      name: '1.168.192.in-addr.arpa',
      type: 'reverse',
      records: new Map(),
      serial: this.generateSerial(),
      refresh: 3600,
      retry: 600,
      expire: 604800,
      minimum: 86400
    };

    // SOA record
    reverseZone.records.set('1.168.192.in-addr.arpa.', [{
      type: 'SOA',
      ttl: 3600,
      data: {
        mname: `dc1.${this.domain.name}.`,
        rname: `hostmaster.${this.domain.name}.`,
        serial: reverseZone.serial,
        refresh: reverseZone.refresh,
        retry: reverseZone.retry,
        expire: reverseZone.expire,
        minimum: reverseZone.minimum
      }
    }]);

    // NS record
    reverseZone.records.set('1.168.192.in-addr.arpa.', [
      ...(reverseZone.records.get('1.168.192.in-addr.arpa.') || []),
      {
        type: 'NS',
        ttl: 3600,
        data: `dc1.${this.domain.name}.`
      }
    ]);

    // PTR records
    reverseZone.records.set('10.1.168.192.in-addr.arpa.', [{
      type: 'PTR',
      ttl: 3600,
      data: `dc1.${this.domain.name}.`
    }]);

    reverseZone.records.set('20.1.168.192.in-addr.arpa.', [{
      type: 'PTR',
      ttl: 3600,
      data: `mail.${this.domain.name}.`
    }]);

    this.zones.set('1.168.192.in-addr.arpa', reverseZone);
    logger.info('Created reverse lookup zone: 1.168.192.in-addr.arpa');
  }

  async createServiceRecords() {
    const zoneName = this.domain.name;
    const zone = this.zones.get(zoneName);
    
    if (!zone) return;

    // Kerberos service records
    const kerberosRecords = [
      {
        name: `_kerberos._tcp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 88,
          target: `dc1.${zoneName}.`
        }
      },
      {
        name: `_kerberos._udp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 88,
          target: `dc1.${zoneName}.`
        }
      },
      {
        name: `_kpasswd._tcp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 464,
          target: `dc1.${zoneName}.`
        }
      },
      {
        name: `_kpasswd._udp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 464,
          target: `dc1.${zoneName}.`
        }
      }
    ];

    // LDAP service records
    const ldapRecords = [
      {
        name: `_ldap._tcp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 389,
          target: `dc1.${zoneName}.`
        }
      },
      {
        name: `_ldaps._tcp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 636,
          target: `dc1.${zoneName}.`
        }
      }
    ];

    // Global Catalog service records
    const gcRecords = [
      {
        name: `_gc._tcp.${zoneName}.`,
        type: 'SRV',
        ttl: 600,
        data: {
          priority: 0,
          weight: 100,
          port: 3268,
          target: `dc1.${zoneName}.`
        }
      }
    ];

    // Add all service records
    const allServiceRecords = [...kerberosRecords, ...ldapRecords, ...gcRecords];
    
    for (const record of allServiceRecords) {
      const existing = zone.records.get(record.name) || [];
      existing.push({
        type: record.type,
        ttl: record.ttl,
        data: record.data
      });
      zone.records.set(record.name, existing);
    }

    logger.info('Created service records for domain services');
  }

  async handleDNSRequest(request, send, rinfo) {
    try {
      const response = dns2.Packet.createResponseFromRequest(request);
      let answered = false;

      for (const question of request.questions) {
        const { name, type } = question;
        
        logger.debug('DNS query received', {
          name,
          type: this.getTypeName(type),
          client: rinfo.address
        });

        // Try to resolve from local zones first
        const answer = await this.resolveFromZones(name, type);
        
        if (answer) {
          response.answers.push(answer);
          answered = true;
        } else {
          // Forward to upstream DNS servers
          const forwardedAnswer = await this.forwardQuery(name, type);
          if (forwardedAnswer) {
            response.answers.push(forwardedAnswer);
            answered = true;
          }
        }
      }

      if (!answered) {
        response.header.rcode = dns2.Packet.RCODE.NXDOMAIN;
      }

      send(response);

    } catch (error) {
      logger.error('DNS request handling error:', error);
      
      // Send server failure response
      const errorResponse = dns2.Packet.createResponseFromRequest(request);
      errorResponse.header.rcode = dns2.Packet.RCODE.SERVFAIL;
      send(errorResponse);
    }
  }

  async resolveFromZones(name, type) {
    // Normalize name
    const queryName = name.endsWith('.') ? name : `${name}.`;
    
    // Check all zones
    for (const [zoneName, zone] of this.zones) {
      if (queryName.endsWith(`.${zoneName}.`) || queryName === `${zoneName}.`) {
        const records = zone.records.get(queryName);
        
        if (records) {
          for (const record of records) {
            if (record.type === this.getTypeName(type)) {
              return {
                name: queryName,
                type,
                class: dns2.Packet.CLASS.IN,
                ttl: record.ttl,
                data: this.formatRecordData(record.type, record.data)
              };
            }
          }
        }
      }
    }

    // Check for dynamic records from directory service
    return await this.resolveDynamicRecord(queryName, type);
  }

  async resolveDynamicRecord(name, type) {
    try {
      if (!this.directoryService) return null;

      const typeName = this.getTypeName(type);
      
      if (typeName === 'A') {
        // Try to resolve computer names
        const computerName = name.replace(`.${this.domain.name}.`, '').replace('.', '');
        const computer = await this.directoryService.directoryService?.findOne({
          collection: 'domainComputers',
          query: { cn: computerName }
        });
        
        if (computer && computer.dNSHostName) {
          // Return a default IP or lookup from network
          return {
            name,
            type,
            class: dns2.Packet.CLASS.IN,
            ttl: 300,
            data: '192.168.1.100' // Default IP for dynamic records
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Dynamic record resolution error:', error);
      return null;
    }
  }

  async forwardQuery(name, type) {
    try {
      const resolver = new dns2.TCPClient({
        dns: this.forwarders[0]
      });

      const response = await resolver.resolveA(name);
      
      if (response.answers && response.answers.length > 0) {
        return response.answers[0];
      }

      return null;
    } catch (error) {
      logger.debug('Forward query failed:', error);
      return null;
    }
  }

  formatRecordData(type, data) {
    switch (type) {
      case 'A':
        return data;
      case 'AAAA':
        return data;
      case 'CNAME':
        return data;
      case 'MX':
        return data;
      case 'NS':
        return data;
      case 'PTR':
        return data;
      case 'SRV':
        return data;
      case 'TXT':
        return Array.isArray(data) ? data : [data];
      case 'SOA':
        return data;
      default:
        return data;
    }
  }

  getTypeName(typeNumber) {
    const typeMap = {
      1: 'A',
      2: 'NS',
      5: 'CNAME',
      6: 'SOA',
      12: 'PTR',
      15: 'MX',
      16: 'TXT',
      28: 'AAAA',
      33: 'SRV'
    };
    return typeMap[typeNumber] || 'UNKNOWN';
  }

  generateSerial() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    return parseInt(`${year}${month}${day}${hour}`);
  }

  async addRecord(zoneName, name, type, ttl, data) {
    const zone = this.zones.get(zoneName);
    if (!zone) {
      throw new Error(`Zone ${zoneName} not found`);
    }

    const records = zone.records.get(name) || [];
    records.push({ type, ttl, data });
    zone.records.set(name, records);

    logger.info(`Added DNS record: ${name} ${type}`, { zoneName, data });
  }

  async removeRecord(zoneName, name, type) {
    const zone = this.zones.get(zoneName);
    if (!zone) {
      throw new Error(`Zone ${zoneName} not found`);
    }

    const records = zone.records.get(name) || [];
    const filteredRecords = records.filter(r => r.type !== type);
    
    if (filteredRecords.length === 0) {
      zone.records.delete(name);
    } else {
      zone.records.set(name, filteredRecords);
    }

    logger.info(`Removed DNS record: ${name} ${type}`, { zoneName });
  }

  async updateSerial(zoneName) {
    const zone = this.zones.get(zoneName);
    if (zone) {
      zone.serial = this.generateSerial();
      
      // Update SOA record
      const soaRecords = zone.records.get(`${zoneName}.`) || [];
      for (const record of soaRecords) {
        if (record.type === 'SOA') {
          record.data.serial = zone.serial;
        }
      }
    }
  }

  getZoneInfo(zoneName) {
    const zone = this.zones.get(zoneName);
    if (!zone) return null;

    return {
      name: zone.name,
      type: zone.type,
      serial: zone.serial,
      recordCount: zone.records.size,
      records: Array.from(zone.records.entries()).map(([name, records]) => ({
        name,
        records: records.map(r => ({ type: r.type, ttl: r.ttl, data: r.data }))
      }))
    };
  }

  async stop() {
    try {
      if (this.server) {
        await new Promise(resolve => this.server.close(resolve));
      }
      
      this.isRunning = false;
      logger.info('DNS server stopped');
    } catch (error) {
      logger.error('Error stopping DNS server:', error);
    }
  }
}

module.exports = DNSController;
