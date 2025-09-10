const mongoose = require('mongoose');

const domainComputerSchema = new mongoose.Schema({
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
  
  // Security Account Manager Account Name (ends with $)
  sAMAccountName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Computer Information
  displayName: String,
  description: String,
  
  // Network Information
  dNSHostName: {
    type: String,
    index: true
  },
  servicePrincipalName: [String],
  
  // Operating System Information
  operatingSystem: String,
  operatingSystemVersion: String,
  operatingSystemServicePack: String,
  operatingSystemHotfix: String,
  
  // Hardware Information
  serialNumber: String,
  
  // Account Information
  userAccountControl: {
    type: Number,
    default: 4096 // Workstation trust account
  },
  
  // Password Information
  password: {
    type: String,
    required: true,
    select: false
  },
  pwdLastSet: {
    type: Date,
    default: Date.now
  },
  
  // Logon Information
  lastLogon: Date,
  lastLogonTimestamp: Date,
  logonCount: {
    type: Number,
    default: 0
  },
  
  // Group Membership
  memberOf: [String],
  primaryGroupID: {
    type: Number,
    default: 515 // Domain Computers
  },
  
  // Location Information
  location: String,
  managedBy: String, // DN of manager
  
  // Object Class and Category
  objectClass: {
    type: [String],
    default: ['top', 'person', 'organizationalPerson', 'user', 'computer']
  },
  objectCategory: String,
  objectGUID: {
    type: String,
    default: () => require('uuid').v4()
  },
  objectSid: String,
  
  // Certificate Information
  userCertificate: [Buffer],
  
  // Extended Attributes
  extensionAttribute1: String,
  extensionAttribute2: String,
  extensionAttribute3: String,
  extensionAttribute4: String,
  extensionAttribute5: String,
  
  // Custom Attributes for QuantumMint
  quantumMintComputerId: {
    type: String,
    index: true
  },
  quantumMintRoles: [String],
  quantumMintServices: [String],
  
  // Computer Type
  computerType: {
    type: String,
    enum: ['Workstation', 'Server', 'DomainController', 'MemberServer'],
    default: 'Workstation'
  },
  
  // Trust Information
  trustType: {
    type: String,
    enum: ['Workstation', 'Server', 'DomainController'],
    default: 'Workstation'
  },
  
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
  collection: 'domainComputers'
});

// Indexes for performance
domainComputerSchema.index({ dn: 1 });
domainComputerSchema.index({ sAMAccountName: 1 });
domainComputerSchema.index({ dNSHostName: 1 });
domainComputerSchema.index({ objectGUID: 1 });
domainComputerSchema.index({ quantumMintComputerId: 1 });

// Method to check if computer account is disabled
domainComputerSchema.methods.isDisabled = function() {
  return (this.userAccountControl & 2) !== 0;
};

// Method to check if computer is domain controller
domainComputerSchema.methods.isDomainController = function() {
  return (this.userAccountControl & 8192) !== 0;
};

// Method to check if computer is server
domainComputerSchema.methods.isServer = function() {
  return (this.userAccountControl & 8192) !== 0 || this.computerType === 'Server';
};

// Method to check if computer is workstation
domainComputerSchema.methods.isWorkstation = function() {
  return (this.userAccountControl & 4096) !== 0;
};

// Method to get computer's groups
domainComputerSchema.methods.getGroups = async function() {
  const DomainGroup = require('./DomainGroup');
  return await DomainGroup.find({ dn: { $in: this.memberOf } });
};

// Method to add service principal name
domainComputerSchema.methods.addSPN = function(spn) {
  if (!this.servicePrincipalName.includes(spn)) {
    this.servicePrincipalName.push(spn);
  }
};

// Method to remove service principal name
domainComputerSchema.methods.removeSPN = function(spn) {
  const index = this.servicePrincipalName.indexOf(spn);
  if (index > -1) {
    this.servicePrincipalName.splice(index, 1);
  }
};

// Pre-save middleware
domainComputerSchema.pre('save', function(next) {
  this.whenChanged = new Date();
  
  // Ensure objectGUID is set
  if (!this.objectGUID) {
    this.objectGUID = require('uuid').v4();
  }
  
  // Ensure sAMAccountName ends with $
  if (!this.sAMAccountName.endsWith('$')) {
    this.sAMAccountName += '$';
  }
  
  // Set display name if not provided
  if (!this.displayName) {
    this.displayName = this.cn;
  }
  
  // Set computer type based on user account control
  if (this.userAccountControl & 8192) {
    this.computerType = 'DomainController';
    this.trustType = 'DomainController';
  } else if (this.userAccountControl & 8192) {
    this.computerType = 'Server';
    this.trustType = 'Server';
  } else {
    this.computerType = 'Workstation';
    this.trustType = 'Workstation';
  }
  
  next();
});

// Static method to find by SAM account name
domainComputerSchema.statics.findBySAM = function(sAMAccountName) {
  return this.findOne({ sAMAccountName });
};

// Static method to find by DNS hostname
domainComputerSchema.statics.findByHostname = function(dNSHostName) {
  return this.findOne({ dNSHostName });
};

// Static method to find domain controllers
domainComputerSchema.statics.findDomainControllers = function() {
  return this.find({ 
    $or: [
      { userAccountControl: { $bitsAllSet: 8192 } },
      { computerType: 'DomainController' }
    ]
  });
};

// Static method to find servers
domainComputerSchema.statics.findServers = function() {
  return this.find({ 
    $or: [
      { computerType: 'Server' },
      { computerType: 'MemberServer' },
      { computerType: 'DomainController' }
    ]
  });
};

// Static method to find workstations
domainComputerSchema.statics.findWorkstations = function() {
  return this.find({ computerType: 'Workstation' });
};

module.exports = mongoose.model('DomainComputer', domainComputerSchema);
