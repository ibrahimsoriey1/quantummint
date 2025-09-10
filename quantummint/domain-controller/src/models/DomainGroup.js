const mongoose = require('mongoose');

const domainGroupSchema = new mongoose.Schema({
  // Distinguished Name (unique identifier)
  dn: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Common Name
  cn: {
    type: String,
    required: true
  },
  
  // Security Account Manager Account Name
  sAMAccountName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Group Information
  displayName: String,
  description: String,
  info: String,
  
  // Group Type
  groupType: {
    type: Number,
    required: true,
    // -2147483648: Global security group
    // -2147483646: Domain local security group
    // -2147483644: Local security group
    // -2147483640: Universal security group
    // 2: Global distribution group
    // 4: Domain local distribution group
    // 8: Universal distribution group
    default: -2147483646
  },
  
  // Group Scope
  groupScope: {
    type: String,
    enum: ['DomainLocal', 'Global', 'Universal'],
    default: 'Global'
  },
  
  // Group Category
  groupCategory: {
    type: String,
    enum: ['Security', 'Distribution'],
    default: 'Security'
  },
  
  // Membership
  member: [String], // DNs of group members
  memberOf: [String], // DNs of parent groups
  
  // Contact Information
  mail: String,
  
  // Management
  managedBy: String, // DN of manager
  
  // Object Class and Category
  objectClass: {
    type: [String],
    default: ['top', 'group']
  },
  objectCategory: String,
  objectGUID: {
    type: String,
    default: () => require('uuid').v4()
  },
  objectSid: String,
  
  // Security Identifiers
  primaryGroupToken: Number,
  
  // Extended Attributes
  extensionAttribute1: String,
  extensionAttribute2: String,
  extensionAttribute3: String,
  extensionAttribute4: String,
  extensionAttribute5: String,
  
  // Custom Attributes for QuantumMint
  quantumMintGroupId: {
    type: String,
    index: true
  },
  quantumMintPermissions: [String],
  quantumMintRoles: [String],
  
  // Group Policy
  gPLink: String, // Group Policy links
  gPOptions: Number,
  
  // Timestamps
  whenCreated: {
    type: Date,
    default: Date.now
  },
  whenChanged: {
    type: Date,
    default: Date.now
  },
  
  // Metadata
  createdBy: String,
  modifiedBy: String
}, {
  timestamps: true,
  collection: 'domainGroups'
});

// Indexes for performance
domainGroupSchema.index({ dn: 1 });
domainGroupSchema.index({ sAMAccountName: 1 });
domainGroupSchema.index({ objectGUID: 1 });
domainGroupSchema.index({ quantumMintGroupId: 1 });
domainGroupSchema.index({ member: 1 });
domainGroupSchema.index({ memberOf: 1 });

// Method to check if group is security group
domainGroupSchema.methods.isSecurityGroup = function() {
  return this.groupType < 0;
};

// Method to check if group is distribution group
domainGroupSchema.methods.isDistributionGroup = function() {
  return this.groupType > 0;
};

// Method to get group scope
domainGroupSchema.methods.getScope = function() {
  if (this.groupType & 2) return 'Global';
  if (this.groupType & 4) return 'DomainLocal';
  if (this.groupType & 8) return 'Universal';
  return 'Unknown';
};

// Method to add member
domainGroupSchema.methods.addMember = async function(memberDN) {
  if (!this.member.includes(memberDN)) {
    this.member.push(memberDN);
    await this.save();
    
    // Update member's memberOf
    const DomainUser = require('./DomainUser');
    const DomainGroup = require('./DomainGroup');
    
    let memberObject = await DomainUser.findOne({ dn: memberDN });
    if (!memberObject) {
      memberObject = await DomainGroup.findOne({ dn: memberDN });
    }
    
    if (memberObject && !memberObject.memberOf.includes(this.dn)) {
      memberObject.memberOf.push(this.dn);
      await memberObject.save();
    }
  }
};

// Method to remove member
domainGroupSchema.methods.removeMember = async function(memberDN) {
  const index = this.member.indexOf(memberDN);
  if (index > -1) {
    this.member.splice(index, 1);
    await this.save();
    
    // Update member's memberOf
    const DomainUser = require('./DomainUser');
    const DomainGroup = require('./DomainGroup');
    
    let memberObject = await DomainUser.findOne({ dn: memberDN });
    if (!memberObject) {
      memberObject = await DomainGroup.findOne({ dn: memberDN });
    }
    
    if (memberObject) {
      const memberOfIndex = memberObject.memberOf.indexOf(this.dn);
      if (memberOfIndex > -1) {
        memberObject.memberOf.splice(memberOfIndex, 1);
        await memberObject.save();
      }
    }
  }
};

// Method to get all members (recursive for nested groups)
domainGroupSchema.methods.getAllMembers = async function(visited = new Set()) {
  if (visited.has(this.dn)) {
    return []; // Prevent circular references
  }
  visited.add(this.dn);
  
  const allMembers = [];
  const DomainUser = require('./DomainUser');
  const DomainGroup = require('./DomainGroup');
  
  for (const memberDN of this.member) {
    // Check if member is a user
    const user = await DomainUser.findOne({ dn: memberDN });
    if (user) {
      allMembers.push(user);
      continue;
    }
    
    // Check if member is a group (nested group)
    const group = await DomainGroup.findOne({ dn: memberDN });
    if (group) {
      const nestedMembers = await group.getAllMembers(visited);
      allMembers.push(...nestedMembers);
    }
  }
  
  return allMembers;
};

// Method to check if user is member (direct or indirect)
domainGroupSchema.methods.isMember = async function(userDN) {
  // Direct membership
  if (this.member.includes(userDN)) {
    return true;
  }
  
  // Indirect membership through nested groups
  const allMembers = await this.getAllMembers();
  return allMembers.some(member => member.dn === userDN);
};

// Pre-save middleware
domainGroupSchema.pre('save', function(next) {
  this.whenChanged = new Date();
  
  // Ensure objectGUID is set
  if (!this.objectGUID) {
    this.objectGUID = require('uuid').v4();
  }
  
  // Set display name if not provided
  if (!this.displayName) {
    this.displayName = this.cn;
  }
  
  // Set group scope based on group type
  if (this.groupType & 2) this.groupScope = 'Global';
  else if (this.groupType & 4) this.groupScope = 'DomainLocal';
  else if (this.groupType & 8) this.groupScope = 'Universal';
  
  // Set group category based on group type
  this.groupCategory = this.groupType < 0 ? 'Security' : 'Distribution';
  
  next();
});

// Static method to find by SAM account name
domainGroupSchema.statics.findBySAM = function(sAMAccountName) {
  return this.findOne({ sAMAccountName });
};

// Static method to find security groups
domainGroupSchema.statics.findSecurityGroups = function() {
  return this.find({ groupType: { $lt: 0 } });
};

// Static method to find distribution groups
domainGroupSchema.statics.findDistributionGroups = function() {
  return this.find({ groupType: { $gt: 0 } });
};

// Static method to find groups by scope
domainGroupSchema.statics.findByScope = function(scope) {
  return this.find({ groupScope: scope });
};

module.exports = mongoose.model('DomainGroup', domainGroupSchema);
