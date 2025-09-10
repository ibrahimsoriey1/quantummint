const axios = require('axios');
const { integration: logger } = require('../utils/logger');

class QuantumMintIntegration {
  constructor(config) {
    this.config = {
      apiGateway: config.apiGateway || 'http://localhost:3000',
      authService: config.authService || 'http://localhost:3001',
      mailServer: config.mailServer || 'http://localhost:3002',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.directoryService = config.directoryService;
    this.securityManager = config.securityManager;
    this.auditService = config.auditService;
  }

  async initialize() {
    try {
      logger.info('Initializing QuantumMint integration...');
      
      // Test connectivity to QuantumMint services
      await this.testConnectivity();
      
      // Register domain controller with API Gateway
      await this.registerWithApiGateway();
      
      // Setup authentication integration
      await this.setupAuthIntegration();
      
      // Setup mail server integration
      await this.setupMailIntegration();
      
      logger.info('QuantumMint integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize QuantumMint integration:', error);
      throw error;
    }
  }

  async testConnectivity() {
    const services = [
      { name: 'API Gateway', url: this.config.apiGateway },
      { name: 'Auth Service', url: this.config.authService },
      { name: 'Mail Server', url: this.config.mailServer }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(`${service.url}/health`, {
          timeout: this.config.timeout
        });
        
        if (response.status === 200) {
          logger.info(`✓ ${service.name} is accessible`);
        } else {
          logger.warn(`⚠ ${service.name} returned status ${response.status}`);
        }
      } catch (error) {
        logger.warn(`✗ ${service.name} is not accessible: ${error.message}`);
      }
    }
  }

  async registerWithApiGateway() {
    try {
      const registrationData = {
        serviceName: 'domain-controller',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          api: '/api',
          ldap: { port: process.env.LDAP_PORT || 389 },
          kerberos: { port: process.env.KERBEROS_PORT || 88 },
          dns: { port: process.env.DNS_PORT || 53 }
        },
        capabilities: [
          'user-authentication',
          'directory-services',
          'group-policy',
          'dns-resolution',
          'audit-logging'
        ]
      };

      const response = await this.makeRequest('POST', `${this.config.apiGateway}/api/services/register`, registrationData);
      
      if (response.success) {
        logger.info('Successfully registered with API Gateway');
      } else {
        logger.warn('Failed to register with API Gateway:', response.error);
      }
    } catch (error) {
      logger.error('Error registering with API Gateway:', error);
    }
  }

  async setupAuthIntegration() {
    try {
      // Configure auth service to use domain controller for authentication
      const authConfig = {
        ldapServer: `ldap://localhost:${process.env.LDAP_PORT || 389}`,
        baseDN: process.env.LDAP_BASE_DN || 'dc=quantummint,dc=local',
        bindDN: process.env.LDAP_BIND_DN || 'cn=Administrator,cn=Users,dc=quantummint,dc=local',
        kerberosRealm: process.env.KERBEROS_REALM || 'QUANTUMMINT.LOCAL',
        domainController: `http://localhost:${process.env.WEB_PORT || 8080}`
      };

      const response = await this.makeRequest('POST', `${this.config.authService}/api/config/domain`, authConfig);
      
      if (response.success) {
        logger.info('Auth service integration configured');
      } else {
        logger.warn('Failed to configure auth service integration:', response.error);
      }
    } catch (error) {
      logger.error('Error setting up auth integration:', error);
    }
  }

  async setupMailIntegration() {
    try {
      // Configure mail server to use domain controller for user lookup
      const mailConfig = {
        directoryService: `http://localhost:${process.env.WEB_PORT || 8080}/api/directory`,
        userLookupEndpoint: `http://localhost:${process.env.WEB_PORT || 8080}/api/users`,
        domainName: process.env.DOMAIN_NAME || 'quantummint.local',
        authenticationMethod: 'ldap'
      };

      const response = await this.makeRequest('POST', `${this.config.mailServer}/api/config/directory`, mailConfig);
      
      if (response.success) {
        logger.info('Mail server integration configured');
      } else {
        logger.warn('Failed to configure mail server integration:', response.error);
      }
    } catch (error) {
      logger.error('Error setting up mail integration:', error);
    }
  }

  async syncUserToQuantumMint(user) {
    try {
      const userData = {
        username: user.sAMAccountName,
        email: user.mail,
        displayName: user.displayName,
        firstName: user.givenName,
        lastName: user.sn,
        enabled: !user.isDisabled(),
        groups: user.memberOf || [],
        domainUser: true,
        dn: user.dn
      };

      // Sync to auth service
      await this.makeRequest('POST', `${this.config.authService}/api/users/sync`, userData);
      
      // Sync to mail server if user has email
      if (user.mail) {
        await this.makeRequest('POST', `${this.config.mailServer}/api/users/sync`, userData);
      }

      logger.info(`User ${user.sAMAccountName} synced to QuantumMint services`);
    } catch (error) {
      logger.error(`Failed to sync user ${user.sAMAccountName}:`, error);
    }
  }

  async removeUserFromQuantumMint(sAMAccountName) {
    try {
      // Remove from auth service
      await this.makeRequest('DELETE', `${this.config.authService}/api/users/${sAMAccountName}`);
      
      // Remove from mail server
      await this.makeRequest('DELETE', `${this.config.mailServer}/api/users/${sAMAccountName}`);

      logger.info(`User ${sAMAccountName} removed from QuantumMint services`);
    } catch (error) {
      logger.error(`Failed to remove user ${sAMAccountName}:`, error);
    }
  }

  async authenticateUser(username, password) {
    try {
      // First try LDAP authentication through directory service
      const ldapAuth = await this.directoryService.authenticate(username, password);
      
      if (ldapAuth.success) {
        // Get user details
        const user = await this.directoryService.getUser(username);
        
        if (user && !user.isDisabled()) {
          // Generate JWT token for QuantumMint services
          const token = await this.securityManager.generateJWT({
            username: user.sAMAccountName,
            displayName: user.displayName,
            email: user.mail,
            groups: user.memberOf || [],
            domainUser: true
          });

          // Audit successful authentication
          if (this.auditService) {
            await this.auditService.logEvent({
              type: 'USER_LOGIN_SUCCESS',
              user: username,
              details: {
                method: 'ldap',
                ip: ldapAuth.clientIP
              }
            });
          }

          return {
            success: true,
            user: {
              username: user.sAMAccountName,
              displayName: user.displayName,
              email: user.mail,
              groups: user.memberOf || []
            },
            token
          };
        }
      }

      // Audit failed authentication
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'USER_LOGIN_FAILED',
          user: username,
          details: {
            method: 'ldap',
            reason: 'invalid_credentials'
          }
        });
      }

      return {
        success: false,
        error: 'Invalid credentials'
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  async validateToken(token) {
    try {
      const decoded = await this.securityManager.validateJWT(token);
      
      if (decoded && decoded.username) {
        // Check if user still exists and is enabled
        const user = await this.directoryService.getUser(decoded.username);
        
        if (user && !user.isDisabled()) {
          return {
            success: true,
            user: decoded
          };
        }
      }

      return {
        success: false,
        error: 'Invalid or expired token'
      };
    } catch (error) {
      logger.error('Token validation error:', error);
      return {
        success: false,
        error: 'Token validation failed'
      };
    }
  }

  async getUserByEmail(email) {
    try {
      const users = await this.directoryService.search({
        baseDN: process.env.LDAP_BASE_DN || 'dc=quantummint,dc=local',
        scope: 'sub',
        filter: `(mail=${email})`,
        attributes: ['sAMAccountName', 'displayName', 'mail', 'memberOf']
      });

      if (users.length > 0) {
        return {
          success: true,
          user: users[0]
        };
      }

      return {
        success: false,
        error: 'User not found'
      };
    } catch (error) {
      logger.error('User lookup error:', error);
      return {
        success: false,
        error: 'User lookup failed'
      };
    }
  }

  async makeRequest(method, url, data = null, retryCount = 0) {
    try {
      const config = {
        method,
        url,
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'QuantumMint-DomainController/1.0.0'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (retryCount < this.config.retryAttempts) {
        logger.warn(`Request failed, retrying (${retryCount + 1}/${this.config.retryAttempts}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.makeRequest(method, url, data, retryCount + 1);
      }
      
      throw error;
    }
  }

  async getHealthStatus() {
    const status = {
      integration: 'healthy',
      services: {},
      lastSync: new Date().toISOString()
    };

    // Check each service
    const services = [
      { name: 'apiGateway', url: this.config.apiGateway },
      { name: 'authService', url: this.config.authService },
      { name: 'mailServer', url: this.config.mailServer }
    ];

    for (const service of services) {
      try {
        const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
        status.services[service.name] = {
          status: response.status === 200 ? 'healthy' : 'degraded',
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        status.services[service.name] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
        status.integration = 'degraded';
      }
    }

    return status;
  }
}

module.exports = QuantumMintIntegration;
