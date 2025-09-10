const mongoose = require('mongoose');

const organizationalUnitSchema = new mongoose.Schema({
  // Distinguished Name (unique identifier)
  dn: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Organizational Unit Name
  ou: {
    type: String,
    required: true
  },
  
  // Common Name (alternative)
  cn: String,
  
  // Display Information
  name: String,
  displayName: String,
  description: String,
  
  // Management
  managedBy: String, // DN of manager
  
  // Contact Information
  street: String,
  l: String, // locality/city
  st: String, // state/province
  postalCode: String,
  c: String, // country
  telephoneNumber: String,
  facsimileTelephoneNumber: String,
  
  // Object Class and Category
  objectClass: {
    type: [String],
    default: ['top', 'organizationalUnit']
  },
  objectCategory: String,
  objectGUID: {
    type: String,
    default: () => require('uuid').v4()
  },
  
  // Group Policy
  gPLink: String, // Group Policy links
  gPOptions: Number,
  
  // Extended Attributes
  extensionAttribute1: String,
  extensionAttribute2: String,
  extensionAttribute3: String,
  extensionAttribute4: String,
  extensionAttribute5: String,
  
  // Custom Attributes for QuantumMint
  quantumMintOUId: {
    type: String,
    index: true
  },
  quantumMintPermissions: [String],
  
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
  collection: 'organizationalUnits'
});

// Indexes for performance
organizationalUnitSchema.index({ dn: 1 });
organizationalUnitSchema.index({ ou: 1 });
organizationalUnitSchema.index({ objectGUID: 1 });
organizationalUnitSchema.index({ quantumMintOUId: 1 });

// Method to get parent OU
organizationalUnitSchema.methods.getParent = async function() {
  const parentDN = this.dn.substring(this.dn.indexOf(',') + 1);
  return await this.constructor.findOne({ dn: parentDN });
};

// Method to get child OUs
organizationalUnitSchema.methods.getChildren = async function() {
  const childPattern = new RegExp(`^[^,]+,${this.dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  return await this.constructor.find({ dn: childPattern });
};

// Method to get all descendants (recursive)
organizationalUnitSchema.methods.getDescendants = async function() {
  const descendants = [];
  const children = await this.getChildren();
  
  for (const child of children) {
    descendants.push(child);
    const grandChildren = await child.getDescendants();
    descendants.push(...grandChildren);
  }
  
  return descendants;
};

// Method to get all objects in this OU
organizationalUnitSchema.methods.getObjects = async function() {
  const DomainUser = require('./DomainUser');
  const DomainGroup = require('./DomainGroup');
  const DomainComputer = require('./DomainComputer');
  
  const objectPattern = new RegExp(`^[^,]+,${this.dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  
  const users = await DomainUser.find({ dn: objectPattern });
  const groups = await DomainGroup.find({ dn: objectPattern });
  const computers = await DomainComputer.find({ dn: objectPattern });
  
  return {
    users,
    groups,
    computers,
    total: users.length + groups.length + computers.length
  };
};

// Method to check if OU is empty
organizationalUnitSchema.methods.isEmpty = async function() {
  const objects = await this.getObjects();
  const children = await this.getChildren();
  return objects.total === 0 && children.length === 0;
};

// Pre-save middleware
organizationalUnitSchema.pre('save', function(next) {
  this.whenChanged = new Date();
  
  // Ensure objectGUID is set
  if (!this.objectGUID) {
    this.objectGUID = require('uuid').v4();
  }
  
  // Set name if not provided
  if (!this.name) {
    this.name = this.ou;
  }
  
  // Set display name if not provided
  if (!this.displayName) {
    this.displayName = this.ou;
  }
  
  next();
});

// Static method to find by OU name
organizationalUnitSchema.statics.findByOU = function(ou) {
  return this.findOne({ ou });
};

// Static method to find root OUs (direct children of domain)
organizationalUnitSchema.statics.findRootOUs = function(baseDN) {
  const rootPattern = new RegExp(`^ou=[^,]+,${baseDN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  return this.find({ dn: rootPattern });
};

module.exports = mongoose.model('OrganizationalUnit', organizationalUnitSchema);
