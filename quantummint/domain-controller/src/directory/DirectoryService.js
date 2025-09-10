const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { directory: logger } = require('../utils/logger');
const DomainUser = require('../models/DomainUser');
const DomainGroup = require('../models/DomainGroup');
const DomainComputer = require('../models/DomainComputer');
const OrganizationalUnit = require('../models/OrganizationalUnit');

class DirectoryService {
  constructor(config) {
    this.config = config;
    this.baseDN = config.baseDN;
    this.domain = config.domain;
    this.securityManager = config.securityManager;
    this.auditService = config.auditService;
    this.isInitialized = false;
    
    // Schema cache for performance
    this.schemaCache = new Map();
    this.objectCache = new Map();
  }

  async initialize() {
    try {
      // Create default directory structure
      await this.createDefaultStructure();
      
      // Initialize schema
      await this.initializeSchema();
      
      // Create default objects
      await this.createDefaultObjects();
      
      this.isInitialized = true;
      logger.info('Directory Service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Directory Service:', error);
      throw error;
    }
  }

  async createDefaultStructure() {
    const defaultOUs = [
      {
        name: 'Users',
        dn: `cn=Users,${this.baseDN}`,
        description: 'Default container for user accounts'
      },
      {
        name: 'Computers',
        dn: `cn=Computers,${this.baseDN}`,
        description: 'Default container for computer accounts'
      },
      {
        name: 'Groups',
        dn: `cn=Groups,${this.baseDN}`,
        description: 'Default container for security groups'
      },
      {
        name: 'Domain Controllers',
        dn: `ou=Domain Controllers,${this.baseDN}`,
        description: 'Container for domain controller computer accounts'
      },
      {
        name: 'Builtin',
        dn: `cn=Builtin,${this.baseDN}`,
        description: 'Built-in security principals'
      }
    ];

    for (const ou of defaultOUs) {
      try {
        const existing = await OrganizationalUnit.findOne({ dn: ou.dn });
        if (!existing) {
          await OrganizationalUnit.create(ou);
          logger.info(`Created organizational unit: ${ou.dn}`);
        }
      } catch (error) {
        logger.warn(`Failed to create OU ${ou.dn}:`, error);
      }
    }
  }

  async createDefaultObjects() {
    // Create Administrator account
    await this.createDefaultAdministrator();
    
    // Create default groups
    await this.createDefaultGroups();
    
    // Create service accounts
    await this.createServiceAccounts();
  }

  async createDefaultAdministrator() {
    const adminDN = `cn=Administrator,cn=Users,${this.baseDN}`;
    
    try {
      const existing = await DomainUser.findOne({ dn: adminDN });
      if (!existing) {
        const hashedPassword = await bcrypt.hash('QuantumMint123!', 12);
        
        await DomainUser.create({
          dn: adminDN,
          cn: 'Administrator',
          sAMAccountName: 'Administrator',
          userPrincipalName: `Administrator@${this.domain.name}`,
          displayName: 'Administrator',
          description: 'Built-in account for administering the computer/domain',
          userAccountControl: 512, // Normal account
          pwdLastSet: new Date(),
          password: hashedPassword,
          memberOf: [
            `cn=Domain Admins,cn=Groups,${this.baseDN}`,
            `cn=Enterprise Admins,cn=Groups,${this.baseDN}`,
            `cn=Administrators,cn=Builtin,${this.baseDN}`
          ],
          objectClass: ['top', 'person', 'organizationalPerson', 'user'],
          objectCategory: `cn=Person,cn=Schema,cn=Configuration,${this.baseDN}`
        });
        
        logger.info('Created default Administrator account');
      }
    } catch (error) {
      logger.error('Failed to create Administrator account:', error);
    }
  }

  async createDefaultGroups() {
    const defaultGroups = [
      {
        dn: `cn=Domain Admins,cn=Groups,${this.baseDN}`,
        cn: 'Domain Admins',
        sAMAccountName: 'Domain Admins',
        description: 'Designated administrators of the domain',
        groupType: -2147483646, // Global security group
        objectClass: ['top', 'group']
      },
      {
        dn: `cn=Enterprise Admins,cn=Groups,${this.baseDN}`,
        cn: 'Enterprise Admins',
        sAMAccountName: 'Enterprise Admins',
        description: 'Designated administrators of the enterprise',
        groupType: -2147483640, // Universal security group
        objectClass: ['top', 'group']
      },
      {
        dn: `cn=Domain Users,cn=Groups,${this.baseDN}`,
        cn: 'Domain Users',
        sAMAccountName: 'Domain Users',
        description: 'All domain users',
        groupType: -2147483646, // Global security group
        objectClass: ['top', 'group']
      },
      {
        dn: `cn=Domain Computers,cn=Groups,${this.baseDN}`,
        cn: 'Domain Computers',
        sAMAccountName: 'Domain Computers',
        description: 'All workstations and servers joined to the domain',
        groupType: -2147483646, // Global security group
        objectClass: ['top', 'group']
      },
      {
        dn: `cn=Administrators,cn=Builtin,${this.baseDN}`,
        cn: 'Administrators',
        sAMAccountName: 'Administrators',
        description: 'Members can fully administer the computer/domain',
        groupType: -2147483643, // Domain local security group
        objectClass: ['top', 'group']
      }
    ];

    for (const group of defaultGroups) {
      try {
        const existing = await DomainGroup.findOne({ dn: group.dn });
        if (!existing) {
          await DomainGroup.create(group);
          logger.info(`Created default group: ${group.dn}`);
        }
      } catch (error) {
        logger.warn(`Failed to create group ${group.dn}:`, error);
      }
    }
  }

  async createServiceAccounts() {
    const serviceAccounts = [
      {
        name: 'krbtgt',
        description: 'Key Distribution Center Service Account',
        disabled: false
      },
      {
        name: 'QUANTUMMINT$',
        description: 'Domain Controller Computer Account',
        disabled: false
      }
    ];

    for (const account of serviceAccounts) {
      try {
        const dn = `cn=${account.name},cn=Users,${this.baseDN}`;
        const existing = await DomainUser.findOne({ dn });
        
        if (!existing) {
          const hashedPassword = await bcrypt.hash(this.generateRandomPassword(), 12);
          
          await DomainUser.create({
            dn,
            cn: account.name,
            sAMAccountName: account.name,
            userPrincipalName: `${account.name}@${this.domain.name}`,
            description: account.description,
            userAccountControl: account.disabled ? 514 : 512,
            password: hashedPassword,
            objectClass: ['top', 'person', 'organizationalPerson', 'user'],
            objectCategory: `cn=Person,cn=Schema,cn=Configuration,${this.baseDN}`
          });
          
          logger.info(`Created service account: ${account.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to create service account ${account.name}:`, error);
      }
    }
  }

  async initializeSchema() {
    // Initialize basic schema definitions
    const schemaDefinitions = {
      user: {
        objectClass: ['top', 'person', 'organizationalPerson', 'user'],
        requiredAttributes: ['cn', 'sAMAccountName'],
        optionalAttributes: ['userPrincipalName', 'displayName', 'mail', 'telephoneNumber', 'description']
      },
      group: {
        objectClass: ['top', 'group'],
        requiredAttributes: ['cn', 'sAMAccountName'],
        optionalAttributes: ['description', 'member', 'memberOf']
      },
      computer: {
        objectClass: ['top', 'person', 'organizationalPerson', 'user', 'computer'],
        requiredAttributes: ['cn', 'sAMAccountName'],
        optionalAttributes: ['dNSHostName', 'operatingSystem', 'operatingSystemVersion']
      },
      organizationalUnit: {
        objectClass: ['top', 'organizationalUnit'],
        requiredAttributes: ['ou'],
        optionalAttributes: ['description', 'managedBy']
      }
    };

    for (const [type, schema] of Object.entries(schemaDefinitions)) {
      this.schemaCache.set(type, schema);
    }
  }

  async authenticateUser(dn, password) {
    try {
      const user = await DomainUser.findOne({ 
        $or: [
          { dn },
          { sAMAccountName: dn.split(',')[0].replace('cn=', '') },
          { userPrincipalName: dn }
        ]
      }).select('+password');

      if (!user) {
        logger.warn('Authentication failed: user not found', { dn });
        return null;
      }

      // Check if account is disabled
      if (user.userAccountControl & 2) {
        logger.warn('Authentication failed: account disabled', { dn: user.dn });
        return null;
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        logger.warn('Authentication failed: invalid password', { dn: user.dn });
        return null;
      }

      // Update last logon
      user.lastLogon = new Date();
      await user.save();

      logger.info('User authenticated successfully', { dn: user.dn });
      return user;
    } catch (error) {
      logger.error('Authentication error:', error);
      return null;
    }
  }

  async search(options) {
    try {
      const { baseDN, scope, filter, attributes } = options;
      const results = [];

      // Parse LDAP filter and convert to MongoDB query
      const mongoQuery = this.parseFilter(filter);
      
      // Determine search scope
      let searchBase = baseDN;
      if (scope === 'base') {
        // Search only the base object
        searchBase = baseDN;
      } else if (scope === 'one') {
        // Search immediate children only
        mongoQuery.dn = new RegExp(`^[^,]+,${this.escapeDN(baseDN)}$`);
      } else if (scope === 'sub') {
        // Search entire subtree
        mongoQuery.dn = new RegExp(`,${this.escapeDN(baseDN)}$`);
      }

      // Search all object types
      const collections = [DomainUser, DomainGroup, DomainComputer, OrganizationalUnit];
      
      for (const Collection of collections) {
        const objects = await Collection.find(mongoQuery);
        
        for (const obj of objects) {
          const entry = this.formatLDAPEntry(obj, attributes);
          results.push(entry);
        }
      }

      return results;
    } catch (error) {
      logger.error('Search error:', error);
      throw error;
    }
  }

  parseFilter(filter) {
    // Simple LDAP filter parser - convert to MongoDB query
    const mongoQuery = {};
    
    if (filter === '(objectClass=*)') {
      // Return all objects
      return {};
    }
    
    // Handle simple equality filters
    const equalityMatch = filter.match(/^\((\w+)=([^)]+)\)$/);
    if (equalityMatch) {
      const [, attr, value] = equalityMatch;
      mongoQuery[attr] = value === '*' ? { $exists: true } : value;
    }
    
    // Handle presence filters
    const presenceMatch = filter.match(/^\((\w+)=\*\)$/);
    if (presenceMatch) {
      mongoQuery[presenceMatch[1]] = { $exists: true };
    }
    
    return mongoQuery;
  }

  formatLDAPEntry(obj, attributes) {
    const entry = {
      dn: obj.dn,
      attributes: {}
    };

    // If no specific attributes requested, return all
    const attrs = attributes && attributes.length > 0 ? attributes : Object.keys(obj.toObject());
    
    for (const attr of attrs) {
      if (obj[attr] !== undefined && attr !== '_id' && attr !== '__v' && attr !== 'password') {
        entry.attributes[attr] = Array.isArray(obj[attr]) ? obj[attr] : [obj[attr]];
      }
    }

    return entry;
  }

  async addEntry(dn, attributes) {
    try {
      // Determine object type from objectClass
      const objectClass = attributes.objectClass || [];
      let Collection;
      
      if (objectClass.includes('user')) {
        Collection = DomainUser;
      } else if (objectClass.includes('group')) {
        Collection = DomainGroup;
      } else if (objectClass.includes('computer')) {
        Collection = DomainComputer;
      } else if (objectClass.includes('organizationalUnit')) {
        Collection = OrganizationalUnit;
      } else {
        throw new Error('Unknown object class');
      }

      // Hash password if present
      if (attributes.password) {
        attributes.password = await bcrypt.hash(attributes.password, 12);
      }

      // Create object
      const obj = new Collection({ dn, ...attributes });
      await obj.save();

      logger.info('Entry added successfully', { dn });
      return obj;
    } catch (error) {
      logger.error('Add entry error:', error);
      throw error;
    }
  }

  async modifyEntry(dn, changes) {
    try {
      // Find the object in all collections
      const collections = [DomainUser, DomainGroup, DomainComputer, OrganizationalUnit];
      let obj = null;
      
      for (const Collection of collections) {
        obj = await Collection.findOne({ dn });
        if (obj) break;
      }

      if (!obj) {
        throw new Error('Object not found');
      }

      // Apply changes
      for (const change of changes) {
        const { operation, modification } = change;
        const { type: attr, vals: values } = modification;

        switch (operation) {
          case 'add':
            if (Array.isArray(obj[attr])) {
              obj[attr].push(...values);
            } else {
              obj[attr] = values[0];
            }
            break;
          case 'delete':
            if (values && values.length > 0) {
              if (Array.isArray(obj[attr])) {
                obj[attr] = obj[attr].filter(v => !values.includes(v));
              }
            } else {
              delete obj[attr];
            }
            break;
          case 'replace':
            if (attr === 'password' && values[0]) {
              obj[attr] = await bcrypt.hash(values[0], 12);
            } else {
              obj[attr] = values.length === 1 ? values[0] : values;
            }
            break;
        }
      }

      await obj.save();
      logger.info('Entry modified successfully', { dn });
      return obj;
    } catch (error) {
      logger.error('Modify entry error:', error);
      throw error;
    }
  }

  async deleteEntry(dn) {
    try {
      // Find and delete the object from all collections
      const collections = [DomainUser, DomainGroup, DomainComputer, OrganizationalUnit];
      let deleted = false;
      
      for (const Collection of collections) {
        const result = await Collection.deleteOne({ dn });
        if (result.deletedCount > 0) {
          deleted = true;
          break;
        }
      }

      if (!deleted) {
        throw new Error('Object not found');
      }

      logger.info('Entry deleted successfully', { dn });
    } catch (error) {
      logger.error('Delete entry error:', error);
      throw error;
    }
  }

  escapeDN(dn) {
    return dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  generateRandomPassword(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async getUserByPrincipal(userPrincipalName) {
    return await DomainUser.findOne({ userPrincipalName });
  }

  async getGroupMembers(groupDN) {
    const group = await DomainGroup.findOne({ dn: groupDN });
    if (!group || !group.member) return [];
    
    const members = [];
    for (const memberDN of group.member) {
      const user = await DomainUser.findOne({ dn: memberDN });
      if (user) members.push(user);
    }
    
    return members;
  }

  async getUserGroups(userDN) {
    const user = await DomainUser.findOne({ dn: userDN });
    if (!user || !user.memberOf) return [];
    
    const groups = [];
    for (const groupDN of user.memberOf) {
      const group = await DomainGroup.findOne({ dn: groupDN });
      if (group) groups.push(group);
    }
    
    return groups;
  }
}

module.exports = DirectoryService;
