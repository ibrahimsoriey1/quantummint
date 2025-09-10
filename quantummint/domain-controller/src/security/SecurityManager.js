const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { security: logger } = require('../utils/logger');

class SecurityManager {
  constructor(config) {
    this.config = config;
    this.auditService = config.auditService;
    
    // Security policies
    this.passwordPolicy = {
      minLength: config.passwordMinLength || 8,
      requireUppercase: config.passwordRequireUppercase !== false,
      requireLowercase: config.passwordRequireLowercase !== false,
      requireNumbers: config.passwordRequireNumbers !== false,
      requireSpecialChars: config.passwordRequireSpecialChars !== false,
      maxAge: config.passwordMaxAge || 90, // days
      historyCount: config.passwordHistoryCount || 12
    };
    
    this.accountLockoutPolicy = {
      threshold: config.lockoutThreshold || 5,
      duration: config.lockoutDuration || 30, // minutes
      resetCounterAfter: config.lockoutResetCounter || 30 // minutes
    };
    
    // Access control
    this.permissions = new Map();
    this.roleDefinitions = new Map();
    
    // Encryption keys
    this.encryptionKey = null;
    this.signingKey = null;
    
    this.isInitialized = false;
  }

  async start() {
    try {
      // Initialize encryption keys
      await this.initializeKeys();
      
      // Load default permissions and roles
      await this.initializeRBAC();
      
      // Start security monitoring
      this.startSecurityMonitoring();
      
      this.isInitialized = true;
      logger.info('Security Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Security Manager:', error);
      throw error;
    }
  }

  async initializeKeys() {
    // Generate or load encryption keys
    this.encryptionKey = crypto.randomBytes(32);
    this.signingKey = crypto.randomBytes(64);
    
    logger.info('Security keys initialized');
  }

  async initializeRBAC() {
    // Define default roles
    const defaultRoles = {
      'Domain Admins': {
        permissions: ['*'], // Full access
        description: 'Full administrative access to the domain'
      },
      'Enterprise Admins': {
        permissions: ['*'], // Full access
        description: 'Full administrative access to the enterprise'
      },
      'Account Operators': {
        permissions: [
          'user:create', 'user:modify', 'user:delete', 'user:read',
          'group:create', 'group:modify', 'group:delete', 'group:read'
        ],
        description: 'Manage user and group accounts'
      },
      'Server Operators': {
        permissions: [
          'computer:create', 'computer:modify', 'computer:delete', 'computer:read',
          'service:start', 'service:stop', 'service:restart'
        ],
        description: 'Manage servers and services'
      },
      'Backup Operators': {
        permissions: [
          'backup:create', 'backup:restore', 'file:read'
        ],
        description: 'Backup and restore operations'
      },
      'Domain Users': {
        permissions: [
          'user:read-self', 'user:modify-self-password'
        ],
        description: 'Standard domain user permissions'
      }
    };

    for (const [roleName, roleData] of Object.entries(defaultRoles)) {
      this.roleDefinitions.set(roleName, roleData);
    }

    // Define permission hierarchy
    const permissionHierarchy = {
      'ldap': {
        'search': ['user:read', 'group:read', 'computer:read'],
        'add': ['user:create', 'group:create', 'computer:create'],
        'modify': ['user:modify', 'group:modify', 'computer:modify'],
        'delete': ['user:delete', 'group:delete', 'computer:delete']
      },
      'kerberos': {
        'authenticate': ['auth:login'],
        'ticket': ['auth:ticket']
      }
    };

    this.permissions.set('hierarchy', permissionHierarchy);
    
    logger.info('RBAC system initialized with default roles and permissions');
  }

  startSecurityMonitoring() {
    // Monitor failed authentication attempts
    setInterval(() => {
      this.cleanupFailedAttempts();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    logger.info('Security monitoring started');
  }

  async validatePassword(password, userDN = null) {
    const errors = [];
    
    // Check minimum length
    if (password.length < this.passwordPolicy.minLength) {
      errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }
    
    // Check uppercase requirement
    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    // Check lowercase requirement
    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    // Check numbers requirement
    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    // Check special characters requirement
    if (this.passwordPolicy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Check password history (if user provided)
    if (userDN) {
      const isInHistory = await this.checkPasswordHistory(userDN, password);
      if (isInHistory) {
        errors.push(`Password cannot be one of the last ${this.passwordPolicy.historyCount} passwords`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async checkPasswordHistory(userDN, password) {
    // This would check against stored password history
    // For now, return false (not in history)
    return false;
  }

  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  async checkAccountLockout(userDN) {
    // Check if account is locked due to failed attempts
    const lockoutKey = `lockout:${userDN}`;
    // This would check Redis or database for lockout status
    return {
      isLocked: false,
      lockoutTime: null,
      failedAttempts: 0
    };
  }

  async recordFailedAttempt(userDN, ip) {
    const attemptKey = `failed:${userDN}`;
    // This would increment failed attempt counter in Redis
    
    // Audit failed attempt
    if (this.auditService) {
      await this.auditService.logEvent({
        type: 'AUTHENTICATION_FAILURE',
        user: userDN,
        ip,
        timestamp: new Date()
      });
    }
    
    logger.warn('Failed authentication attempt recorded', { userDN, ip });
  }

  async recordSuccessfulAuth(userDN, ip) {
    // Clear failed attempts on successful auth
    const attemptKey = `failed:${userDN}`;
    // This would clear the counter in Redis
    
    // Audit successful authentication
    if (this.auditService) {
      await this.auditService.logEvent({
        type: 'AUTHENTICATION_SUCCESS',
        user: userDN,
        ip,
        timestamp: new Date()
      });
    }
    
    logger.info('Successful authentication recorded', { userDN, ip });
  }

  async checkLDAPPermission(user, operation, targetDN) {
    try {
      // Check if user has required permissions
      const userPermissions = await this.getUserPermissions(user);
      
      // Admin users have full access
      if (userPermissions.includes('*')) {
        return true;
      }
      
      // Check specific LDAP permissions
      const requiredPermission = `ldap:${operation}`;
      if (userPermissions.includes(requiredPermission)) {
        return true;
      }
      
      // Check object-specific permissions
      const objectType = this.getObjectTypeFromDN(targetDN);
      const objectPermission = `${objectType}:${operation}`;
      if (userPermissions.includes(objectPermission)) {
        return true;
      }
      
      // Check if user can modify their own object
      if (operation === 'modify' && targetDN === user.dn) {
        return userPermissions.includes('user:modify-self');
      }
      
      return false;
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  async getUserPermissions(user) {
    const permissions = new Set();
    
    // Get permissions from user's groups
    if (user.memberOf) {
      for (const groupDN of user.memberOf) {
        const groupName = this.getGroupNameFromDN(groupDN);
        const role = this.roleDefinitions.get(groupName);
        if (role) {
          role.permissions.forEach(perm => permissions.add(perm));
        }
      }
    }
    
    // Add user-specific permissions
    if (user.quantumMintPermissions) {
      user.quantumMintPermissions.forEach(perm => permissions.add(perm));
    }
    
    return Array.from(permissions);
  }

  getObjectTypeFromDN(dn) {
    // Extract object type from DN structure
    if (dn.includes('cn=Users')) return 'user';
    if (dn.includes('cn=Groups')) return 'group';
    if (dn.includes('cn=Computers')) return 'computer';
    if (dn.includes('ou=')) return 'ou';
    return 'object';
  }

  getGroupNameFromDN(dn) {
    // Extract group name from DN
    const match = dn.match(/^cn=([^,]+)/);
    return match ? match[1] : '';
  }

  async generateJWT(user, expiresIn = '8h') {
    const payload = {
      sub: user.objectGUID,
      dn: user.dn,
      sam: user.sAMAccountName,
      upn: user.userPrincipalName,
      groups: user.memberOf || [],
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, this.signingKey, { 
      expiresIn,
      issuer: 'quantummint-dc',
      audience: 'quantummint-services'
    });
  }

  async verifyJWT(token) {
    try {
      return jwt.verify(token, this.signingKey, {
        issuer: 'quantummint-dc',
        audience: 'quantummint-services'
      });
    } catch (error) {
      logger.warn('JWT verification failed:', error.message);
      return null;
    }
  }

  async encryptData(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  async decryptData(encryptedData) {
    const { encrypted, iv, authTag } = encryptedData;
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async auditSecurityEvent(eventType, details) {
    if (this.auditService) {
      await this.auditService.logEvent({
        type: `SECURITY_${eventType}`,
        ...details,
        timestamp: new Date()
      });
    }
    
    logger.info(`Security event: ${eventType}`, details);
  }

  cleanupFailedAttempts() {
    // Clean up old failed attempt records
    // This would remove expired entries from Redis
    logger.debug('Cleaned up expired failed attempt records');
  }

  async createRole(roleName, permissions, description) {
    this.roleDefinitions.set(roleName, {
      permissions,
      description,
      created: new Date(),
      createdBy: 'system'
    });
    
    await this.auditSecurityEvent('ROLE_CREATED', {
      roleName,
      permissions,
      description
    });
    
    logger.info(`Created role: ${roleName}`, { permissions });
  }

  async deleteRole(roleName) {
    if (this.roleDefinitions.delete(roleName)) {
      await this.auditSecurityEvent('ROLE_DELETED', { roleName });
      logger.info(`Deleted role: ${roleName}`);
      return true;
    }
    return false;
  }

  async assignRole(userDN, roleName) {
    // This would add the user to the appropriate group
    await this.auditSecurityEvent('ROLE_ASSIGNED', {
      userDN,
      roleName
    });
    
    logger.info(`Assigned role ${roleName} to user ${userDN}`);
  }

  async revokeRole(userDN, roleName) {
    // This would remove the user from the appropriate group
    await this.auditSecurityEvent('ROLE_REVOKED', {
      userDN,
      roleName
    });
    
    logger.info(`Revoked role ${roleName} from user ${userDN}`);
  }

  getRoles() {
    return Array.from(this.roleDefinitions.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }

  getRole(roleName) {
    return this.roleDefinitions.get(roleName);
  }
}

module.exports = SecurityManager;
