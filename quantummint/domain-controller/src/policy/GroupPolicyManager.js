const mongoose = require('mongoose');
const { policy: logger } = require('../utils/logger');

class GroupPolicyManager {
  constructor(config) {
    this.config = config;
    this.directoryService = config.directoryService;
    this.auditService = config.auditService;
    
    this.policies = new Map();
    this.policyTemplates = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Load default policy templates
      await this.loadDefaultTemplates();
      
      // Initialize policy storage
      await this.initializePolicyStorage();
      
      // Load existing policies
      await this.loadExistingPolicies();
      
      this.isInitialized = true;
      logger.info('Group Policy Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Group Policy Manager:', error);
      throw error;
    }
  }

  async loadDefaultTemplates() {
    const defaultTemplates = {
      'Default Domain Policy': {
        description: 'Default security settings for the domain',
        settings: {
          passwordPolicy: {
            minimumPasswordLength: 8,
            passwordComplexityEnabled: true,
            maximumPasswordAge: 90,
            minimumPasswordAge: 1,
            passwordHistoryCount: 12,
            lockoutThreshold: 5,
            lockoutDuration: 30,
            resetLockoutCounterAfter: 30
          },
          accountPolicy: {
            enforcePasswordHistory: 12,
            maximumPasswordAge: 90,
            minimumPasswordAge: 1,
            minimumPasswordLength: 8,
            passwordComplexity: true,
            reversibleEncryption: false
          },
          auditPolicy: {
            auditAccountLogon: 'Success,Failure',
            auditAccountManagement: 'Success,Failure',
            auditDirectoryServiceAccess: 'Success,Failure',
            auditLogonEvents: 'Success,Failure',
            auditObjectAccess: 'Success,Failure',
            auditPolicyChange: 'Success,Failure',
            auditPrivilegeUse: 'Success,Failure',
            auditProcessTracking: 'Success,Failure',
            auditSystemEvents: 'Success,Failure'
          },
          userRights: {
            logOnAsService: ['Domain Controllers', 'Service Accounts'],
            logOnAsABatchJob: ['Backup Operators'],
            logOnLocally: ['Domain Users', 'Domain Admins'],
            accessComputerFromNetwork: ['Domain Users', 'Domain Admins'],
            denyLogOnAsService: ['Guest'],
            denyLogOnLocally: ['Guest'],
            denyAccessComputerFromNetwork: ['Guest']
          }
        }
      },
      'Default Domain Controllers Policy': {
        description: 'Default security settings for domain controllers',
        settings: {
          passwordPolicy: {
            minimumPasswordLength: 12,
            passwordComplexityEnabled: true,
            maximumPasswordAge: 60,
            minimumPasswordAge: 1,
            passwordHistoryCount: 24
          },
          auditPolicy: {
            auditAccountLogon: 'Success,Failure',
            auditAccountManagement: 'Success,Failure',
            auditDirectoryServiceAccess: 'Success,Failure',
            auditLogonEvents: 'Success,Failure',
            auditObjectAccess: 'Success,Failure',
            auditPolicyChange: 'Success,Failure',
            auditPrivilegeUse: 'Success,Failure',
            auditProcessTracking: 'Success,Failure',
            auditSystemEvents: 'Success,Failure'
          },
          userRights: {
            logOnAsService: ['Domain Controllers'],
            logOnLocally: ['Domain Admins', 'Enterprise Admins'],
            accessComputerFromNetwork: ['Domain Admins', 'Enterprise Admins'],
            denyLogOnLocally: ['Guest', 'Domain Users'],
            denyAccessComputerFromNetwork: ['Guest']
          },
          securityOptions: {
            interactiveLogonRequireSmartCard: false,
            interactiveLogonSmartCardRemovalBehavior: 'Lock Workstation',
            networkSecurityLANManagerAuthenticationLevel: 'Send NTLMv2 response only',
            networkSecurityMinimumSessionSecurity: 'Require NTLMv2 session security'
          }
        }
      },
      'Workstation Security Policy': {
        description: 'Security settings for workstations',
        settings: {
          passwordPolicy: {
            minimumPasswordLength: 8,
            passwordComplexityEnabled: true,
            maximumPasswordAge: 90,
            lockoutThreshold: 3,
            lockoutDuration: 15
          },
          auditPolicy: {
            auditLogonEvents: 'Success,Failure',
            auditAccountLogon: 'Success,Failure',
            auditObjectAccess: 'Failure',
            auditPolicyChange: 'Success,Failure'
          },
          userRights: {
            logOnLocally: ['Domain Users', 'Local Administrators'],
            denyLogOnAsService: ['Guest', 'Domain Users'],
            denyLogOnLocally: ['Guest']
          },
          securityOptions: {
            interactiveLogonDisplayLastUserName: false,
            interactiveLogonPromptUserToChangePassword: 14,
            shutdownAllowSystemToBeShutDownWithoutLogon: false,
            systemObjectsRequireCaseInsensitivity: true
          },
          softwareRestriction: {
            defaultSecurityLevel: 'Unrestricted',
            enforcementUsers: 'All users except local administrators',
            enforcementApplications: 'All software files'
          }
        }
      }
    };

    for (const [name, template] of Object.entries(defaultTemplates)) {
      this.policyTemplates.set(name, {
        ...template,
        id: this.generatePolicyId(),
        created: new Date(),
        version: 1
      });
    }

    logger.info(`Loaded ${Object.keys(defaultTemplates).length} default policy templates`);
  }

  async initializePolicyStorage() {
    // Initialize MongoDB collections for policy storage
    const policySchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      description: String,
      type: { type: String, enum: ['Domain', 'OU', 'Site'], default: 'Domain' },
      linkedTo: [String], // DNs of containers this policy is linked to
      settings: mongoose.Schema.Types.Mixed,
      version: { type: Number, default: 1 },
      enabled: { type: Boolean, default: true },
      created: { type: Date, default: Date.now },
      modified: { type: Date, default: Date.now },
      createdBy: String,
      modifiedBy: String
    });

    this.PolicyModel = mongoose.model('GroupPolicy', policySchema);
    logger.info('Policy storage initialized');
  }

  async loadExistingPolicies() {
    try {
      const policies = await this.PolicyModel.find({ enabled: true });
      
      for (const policy of policies) {
        this.policies.set(policy.id, policy);
      }
      
      logger.info(`Loaded ${policies.length} existing policies`);
    } catch (error) {
      logger.warn('No existing policies found or error loading:', error.message);
    }
  }

  async createPolicy(policyData) {
    try {
      const policy = {
        id: this.generatePolicyId(),
        name: policyData.name,
        description: policyData.description || '',
        type: policyData.type || 'Domain',
        linkedTo: policyData.linkedTo || [],
        settings: policyData.settings || {},
        version: 1,
        enabled: true,
        created: new Date(),
        modified: new Date(),
        createdBy: policyData.createdBy || 'system'
      };

      // Save to database
      const policyDoc = new this.PolicyModel(policy);
      await policyDoc.save();

      // Cache in memory
      this.policies.set(policy.id, policy);

      // Audit policy creation
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'POLICY_CREATED',
          user: policy.createdBy,
          details: {
            policyId: policy.id,
            policyName: policy.name,
            linkedTo: policy.linkedTo
          }
        });
      }

      logger.info(`Created policy: ${policy.name}`, { id: policy.id });
      return policy;
    } catch (error) {
      logger.error('Failed to create policy:', error);
      throw error;
    }
  }

  async updatePolicy(policyId, updates) {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Update policy
      const updatedPolicy = {
        ...policy,
        ...updates,
        version: policy.version + 1,
        modified: new Date(),
        modifiedBy: updates.modifiedBy || 'system'
      };

      // Save to database
      await this.PolicyModel.findOneAndUpdate(
        { id: policyId },
        updatedPolicy,
        { new: true }
      );

      // Update cache
      this.policies.set(policyId, updatedPolicy);

      // Audit policy update
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'POLICY_UPDATED',
          user: updatedPolicy.modifiedBy,
          details: {
            policyId,
            policyName: updatedPolicy.name,
            changes: Object.keys(updates)
          }
        });
      }

      logger.info(`Updated policy: ${updatedPolicy.name}`, { id: policyId });
      return updatedPolicy;
    } catch (error) {
      logger.error('Failed to update policy:', error);
      throw error;
    }
  }

  async deletePolicy(policyId, deletedBy = 'system') {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Remove from database
      await this.PolicyModel.deleteOne({ id: policyId });

      // Remove from cache
      this.policies.delete(policyId);

      // Audit policy deletion
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'POLICY_DELETED',
          user: deletedBy,
          details: {
            policyId,
            policyName: policy.name
          }
        });
      }

      logger.info(`Deleted policy: ${policy.name}`, { id: policyId });
      return true;
    } catch (error) {
      logger.error('Failed to delete policy:', error);
      throw error;
    }
  }

  async linkPolicy(policyId, containerDN, linkedBy = 'system') {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      if (!policy.linkedTo.includes(containerDN)) {
        policy.linkedTo.push(containerDN);
        
        await this.updatePolicy(policyId, {
          linkedTo: policy.linkedTo,
          modifiedBy: linkedBy
        });

        // Audit policy link
        if (this.auditService) {
          await this.auditService.logEvent({
            type: 'POLICY_LINKED',
            user: linkedBy,
            details: {
              policyId,
              policyName: policy.name,
              containerDN
            }
          });
        }

        logger.info(`Linked policy ${policy.name} to ${containerDN}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to link policy:', error);
      throw error;
    }
  }

  async unlinkPolicy(policyId, containerDN, unlinkedBy = 'system') {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      const index = policy.linkedTo.indexOf(containerDN);
      if (index > -1) {
        policy.linkedTo.splice(index, 1);
        
        await this.updatePolicy(policyId, {
          linkedTo: policy.linkedTo,
          modifiedBy: unlinkedBy
        });

        // Audit policy unlink
        if (this.auditService) {
          await this.auditService.logEvent({
            type: 'POLICY_UNLINKED',
            user: unlinkedBy,
            details: {
              policyId,
              policyName: policy.name,
              containerDN
            }
          });
        }

        logger.info(`Unlinked policy ${policy.name} from ${containerDN}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to unlink policy:', error);
      throw error;
    }
  }

  async getEffectivePolicies(objectDN) {
    try {
      const effectivePolicies = [];
      
      // Get all policies that apply to this object's container hierarchy
      const containerHierarchy = this.getContainerHierarchy(objectDN);
      
      for (const [policyId, policy] of this.policies) {
        if (!policy.enabled) continue;
        
        // Check if policy is linked to any container in the hierarchy
        for (const container of containerHierarchy) {
          if (policy.linkedTo.includes(container)) {
            effectivePolicies.push({
              ...policy,
              appliedFrom: container,
              precedence: containerHierarchy.indexOf(container)
            });
            break;
          }
        }
      }
      
      // Sort by precedence (closest container wins)
      effectivePolicies.sort((a, b) => a.precedence - b.precedence);
      
      return effectivePolicies;
    } catch (error) {
      logger.error('Failed to get effective policies:', error);
      return [];
    }
  }

  getContainerHierarchy(objectDN) {
    const hierarchy = [];
    let currentDN = objectDN;
    
    // Walk up the DN hierarchy
    while (currentDN.includes(',')) {
      const parentDN = currentDN.substring(currentDN.indexOf(',') + 1);
      hierarchy.push(parentDN);
      currentDN = parentDN;
    }
    
    return hierarchy;
  }

  async applyPolicy(policyId, targetDN) {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        throw new Error('Policy not found');
      }

      // Apply policy settings based on target type
      const targetType = this.getObjectTypeFromDN(targetDN);
      
      switch (targetType) {
        case 'user':
          await this.applyUserPolicy(policy, targetDN);
          break;
        case 'computer':
          await this.applyComputerPolicy(policy, targetDN);
          break;
        case 'ou':
          await this.applyOUPolicy(policy, targetDN);
          break;
        default:
          logger.warn(`Unknown target type for policy application: ${targetType}`);
      }

      logger.info(`Applied policy ${policy.name} to ${targetDN}`);
    } catch (error) {
      logger.error('Failed to apply policy:', error);
      throw error;
    }
  }

  async applyUserPolicy(policy, userDN) {
    // Apply user-specific policy settings
    const settings = policy.settings;
    
    if (settings.passwordPolicy) {
      // Apply password policy to user
      // This would integrate with the SecurityManager
    }
    
    if (settings.userRights) {
      // Apply user rights
      // This would modify user's group memberships
    }
  }

  async applyComputerPolicy(policy, computerDN) {
    // Apply computer-specific policy settings
    const settings = policy.settings;
    
    if (settings.securityOptions) {
      // Apply security options to computer
    }
    
    if (settings.softwareRestriction) {
      // Apply software restriction policies
    }
  }

  async applyOUPolicy(policy, ouDN) {
    // Apply policy to all objects in the OU
    if (this.directoryService) {
      const objects = await this.directoryService.getObjects();
      
      for (const user of objects.users) {
        await this.applyUserPolicy(policy, user.dn);
      }
      
      for (const computer of objects.computers) {
        await this.applyComputerPolicy(policy, computer.dn);
      }
    }
  }

  getObjectTypeFromDN(dn) {
    if (dn.includes('cn=Users') || dn.match(/^cn=[^,]+,cn=Users/)) return 'user';
    if (dn.includes('cn=Computers') || dn.match(/^cn=[^,]+,cn=Computers/)) return 'computer';
    if (dn.match(/^ou=/)) return 'ou';
    return 'unknown';
  }

  generatePolicyId() {
    return `gpo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getPolicy(policyId) {
    return this.policies.get(policyId);
  }

  getAllPolicies() {
    return Array.from(this.policies.values());
  }

  getPolicyTemplates() {
    return Array.from(this.policyTemplates.values());
  }

  async createPolicyFromTemplate(templateName, policyName, linkedTo = []) {
    const template = this.policyTemplates.get(templateName);
    if (!template) {
      throw new Error('Template not found');
    }

    return await this.createPolicy({
      name: policyName,
      description: `Policy created from template: ${templateName}`,
      settings: { ...template.settings },
      linkedTo,
      createdBy: 'system'
    });
  }

  async exportPolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    return {
      exportDate: new Date(),
      policy: {
        name: policy.name,
        description: policy.description,
        settings: policy.settings,
        version: policy.version
      }
    };
  }

  async importPolicy(policyData, importedBy = 'system') {
    return await this.createPolicy({
      ...policyData.policy,
      createdBy: importedBy
    });
  }
}

module.exports = GroupPolicyManager;
