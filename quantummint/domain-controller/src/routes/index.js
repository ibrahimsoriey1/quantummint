const express = require('express');
const router = express.Router();

// Import route modules
const directoryRoutes = require('./directory');
const userRoutes = require('./users');
const groupRoutes = require('./groups');
const computerRoutes = require('./computers');
const policyRoutes = require('./policies');
const auditRoutes = require('./audit');
const replicationRoutes = require('./replication');
const integrationRoutes = require('./integration');

// Mount routes
router.use('/directory', directoryRoutes);
router.use('/users', userRoutes);
router.use('/groups', groupRoutes);
router.use('/computers', computerRoutes);
router.use('/policies', policyRoutes);
router.use('/audit', auditRoutes);
router.use('/replication', replicationRoutes);
router.use('/integration', integrationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  const services = req.app.get('services') || {};
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      ldap: services.ldapServer?.isRunning || false,
      kerberos: services.kerberosServer?.isRunning || false,
      dns: services.dnsController?.isRunning || false,
      directory: !!services.directoryService,
      security: !!services.securityManager,
      audit: !!services.auditService,
      policy: !!services.policyManager,
      replication: !!services.replicationManager
    },
    version: process.env.npm_package_version || '1.0.0'
  };

  // Check if any critical services are down
  const criticalServices = ['ldap', 'kerberos', 'directory', 'security'];
  const downServices = criticalServices.filter(service => !health.services[service]);
  
  if (downServices.length > 0) {
    health.status = 'degraded';
    health.downServices = downServices;
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API information endpoint
router.get('/info', (req, res) => {
  const info = {
    name: 'QuantumMint Domain Controller API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Enterprise-grade domain controller with LDAP, Kerberos, DNS, and policy management',
    endpoints: {
      directory: '/api/directory',
      users: '/api/users',
      groups: '/api/groups',
      computers: '/api/computers',
      policies: '/api/policies',
      audit: '/api/audit',
      replication: '/api/replication'
    },
    protocols: {
      ldap: {
        port: process.env.LDAP_PORT || 389,
        securePort: process.env.LDAPS_PORT || 636
      },
      kerberos: {
        port: process.env.KERBEROS_PORT || 88
      },
      dns: {
        port: process.env.DNS_PORT || 53
      }
    },
    domain: {
      name: process.env.DOMAIN_NAME || 'quantummint.local',
      forest: process.env.FOREST_NAME || 'quantummint.local'
    }
  };

  res.json(info);
});

module.exports = router;
