#!/usr/bin/env node

const axios = require('axios');
const ldap = require('ldapjs');
const dgram = require('dgram');

const BASE_URL = process.env.DOMAIN_CONTROLLER_URL || 'http://localhost:8080';
const LDAP_URL = process.env.LDAP_URL || 'ldap://localhost:389';
const DNS_HOST = process.env.DNS_HOST || 'localhost';
const DNS_PORT = process.env.DNS_PORT || 53;

class DomainControllerTester {
  constructor() {
    this.results = {
      web: { passed: 0, failed: 0, tests: [] },
      ldap: { passed: 0, failed: 0, tests: [] },
      dns: { passed: 0, failed: 0, tests: [] },
      integration: { passed: 0, failed: 0, tests: [] }
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Domain Controller Tests...\n');

    try {
      await this.testWebAPI();
      await this.testLDAPServer();
      await this.testDNSServer();
      await this.testIntegration();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    }

    this.printResults();
  }

  async testWebAPI() {
    console.log('🌐 Testing Web API...');

    const tests = [
      {
        name: 'Health Check',
        test: () => this.makeRequest('GET', '/health')
      },
      {
        name: 'API Info',
        test: () => this.makeRequest('GET', '/api/info')
      },
      {
        name: 'Directory Stats',
        test: () => this.makeRequest('GET', '/api/directory/stats')
      },
      {
        name: 'Users List',
        test: () => this.makeRequest('GET', '/api/users?limit=10')
      },
      {
        name: 'Groups List',
        test: () => this.makeRequest('GET', '/api/groups?limit=10')
      },
      {
        name: 'Computers List',
        test: () => this.makeRequest('GET', '/api/computers?limit=10')
      },
      {
        name: 'Audit Events',
        test: () => this.makeRequest('GET', '/api/audit/events?limit=10')
      },
      {
        name: 'Replication Status',
        test: () => this.makeRequest('GET', '/api/replication/status')
      }
    ];

    for (const test of tests) {
      await this.runTest('web', test);
    }
  }

  async testLDAPServer() {
    console.log('📁 Testing LDAP Server...');

    const tests = [
      {
        name: 'LDAP Connection',
        test: () => this.testLDAPConnection()
      },
      {
        name: 'Anonymous Bind',
        test: () => this.testLDAPBind('', '')
      },
      {
        name: 'Root DSE Search',
        test: () => this.testLDAPSearch('', '(objectClass=*)', 'base')
      }
    ];

    for (const test of tests) {
      await this.runTest('ldap', test);
    }
  }

  async testDNSServer() {
    console.log('🌍 Testing DNS Server...');

    const tests = [
      {
        name: 'DNS Query - A Record',
        test: () => this.testDNSQuery('quantummint.local', 'A')
      },
      {
        name: 'DNS Query - SRV Record',
        test: () => this.testDNSQuery('_ldap._tcp.quantummint.local', 'SRV')
      },
      {
        name: 'DNS Query - Kerberos SRV',
        test: () => this.testDNSQuery('_kerberos._tcp.quantummint.local', 'SRV')
      }
    ];

    for (const test of tests) {
      await this.runTest('dns', test);
    }
  }

  async testIntegration() {
    console.log('🔗 Testing QuantumMint Integration...');

    const tests = [
      {
        name: 'Integration Status',
        test: () => this.makeRequest('GET', '/api/integration/status')
      },
      {
        name: 'Test Connectivity',
        test: () => this.makeRequest('POST', '/api/integration/test-connectivity')
      }
    ];

    for (const test of tests) {
      await this.runTest('integration', test);
    }
  }

  async runTest(category, test) {
    try {
      const result = await test.test();
      this.results[category].passed++;
      this.results[category].tests.push({
        name: test.name,
        status: 'PASS',
        result: result
      });
      console.log(`  ✅ ${test.name}`);
    } catch (error) {
      this.results[category].failed++;
      this.results[category].tests.push({
        name: test.name,
        status: 'FAIL',
        error: error.message
      });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }

  async makeRequest(method, path, data = null) {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async testLDAPConnection() {
    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: LDAP_URL,
        timeout: 5000
      });

      client.on('connect', () => {
        client.unbind();
        resolve({ connected: true });
      });

      client.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        client.unbind();
        reject(new Error('Connection timeout'));
      }, 5000);
    });
  }

  async testLDAPBind(dn, password) {
    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: LDAP_URL,
        timeout: 5000
      });

      client.bind(dn, password, (error) => {
        if (error) {
          client.unbind();
          reject(error);
          return;
        }

        client.unbind();
        resolve({ bound: true });
      });
    });
  }

  async testLDAPSearch(baseDN, filter, scope) {
    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: LDAP_URL,
        timeout: 5000
      });

      const opts = {
        filter: filter,
        scope: scope,
        attributes: ['objectClass']
      };

      client.search(baseDN, opts, (error, res) => {
        if (error) {
          client.unbind();
          reject(error);
          return;
        }

        const entries = [];
        res.on('searchEntry', (entry) => {
          entries.push(entry.object);
        });

        res.on('end', (result) => {
          client.unbind();
          resolve({ entries: entries.length, status: result.status });
        });

        res.on('error', (error) => {
          client.unbind();
          reject(error);
        });
      });
    });
  }

  async testDNSQuery(hostname, type) {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket('udp4');
      const query = this.createDNSQuery(hostname, type);

      client.send(query, 0, query.length, DNS_PORT, DNS_HOST, (error) => {
        if (error) {
          client.close();
          reject(error);
          return;
        }
      });

      client.on('message', (msg) => {
        client.close();
        resolve({ response: msg.length, type });
      });

      client.on('error', (error) => {
        client.close();
        reject(error);
      });

      setTimeout(() => {
        client.close();
        reject(new Error('DNS query timeout'));
      }, 5000);
    });
  }

  createDNSQuery(hostname, type) {
    // Simple DNS query packet creation
    const buffer = Buffer.alloc(512);
    let offset = 0;

    // Header
    buffer.writeUInt16BE(0x1234, offset); offset += 2; // ID
    buffer.writeUInt16BE(0x0100, offset); offset += 2; // Flags
    buffer.writeUInt16BE(0x0001, offset); offset += 2; // Questions
    buffer.writeUInt16BE(0x0000, offset); offset += 2; // Answers
    buffer.writeUInt16BE(0x0000, offset); offset += 2; // Authority
    buffer.writeUInt16BE(0x0000, offset); offset += 2; // Additional

    // Question
    const labels = hostname.split('.');
    for (const label of labels) {
      buffer.writeUInt8(label.length, offset++);
      buffer.write(label, offset);
      offset += label.length;
    }
    buffer.writeUInt8(0, offset++); // End of name

    // Type
    const typeCode = type === 'A' ? 1 : type === 'SRV' ? 33 : 1;
    buffer.writeUInt16BE(typeCode, offset); offset += 2;
    
    // Class (IN)
    buffer.writeUInt16BE(1, offset); offset += 2;

    return buffer.slice(0, offset);
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');

    let totalPassed = 0;
    let totalFailed = 0;

    for (const [category, results] of Object.entries(this.results)) {
      const total = results.passed + results.failed;
      const percentage = total > 0 ? Math.round((results.passed / total) * 100) : 0;
      
      console.log(`\n${category.toUpperCase()}:`);
      console.log(`  Passed: ${results.passed}`);
      console.log(`  Failed: ${results.failed}`);
      console.log(`  Success Rate: ${percentage}%`);

      totalPassed += results.passed;
      totalFailed += results.failed;

      if (results.failed > 0) {
        console.log('  Failed Tests:');
        results.tests
          .filter(test => test.status === 'FAIL')
          .forEach(test => {
            console.log(`    - ${test.name}: ${test.error}`);
          });
      }
    }

    const overallTotal = totalPassed + totalFailed;
    const overallPercentage = overallTotal > 0 ? Math.round((totalPassed / overallTotal) * 100) : 0;

    console.log('\n🎯 OVERALL RESULTS:');
    console.log(`Total Tests: ${overallTotal}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${overallPercentage}%`);

    if (overallPercentage >= 80) {
      console.log('\n🎉 Domain Controller is functioning well!');
    } else if (overallPercentage >= 60) {
      console.log('\n⚠️  Domain Controller has some issues that need attention.');
    } else {
      console.log('\n🚨 Domain Controller has significant issues that require immediate attention.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DomainControllerTester();
  tester.runAllTests().catch(console.error);
}

module.exports = DomainControllerTester;
