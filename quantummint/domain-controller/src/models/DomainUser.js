const mongoose = require('mongoose');

const domainUserSchema = new mongoose.Schema({
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
  
  // User Principal Name
  userPrincipalName: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Display Name
  displayName: String,
  
  // Personal Information
  givenName: String,
  sn: String, // surname
  initials: String,
  description: String,
  
  // Contact Information
  mail: String,
  telephoneNumber: String,
  mobile: String,
  facsimileTelephoneNumber: String,
  homePhone: String,
  pager: String,
  
  // Address Information
  streetAddress: String,
  l: String, // locality/city
  st: String, // state/province
  postalCode: String,
  c: String, // country
  co: String, // country name
  
  // Organization Information
  title: String,
  department: String,
  company: String,
  manager: String,
  directReports: [String],
  
  // Account Information
  userAccountControl: {
    type: Number,
    default: 512 // Normal account
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
  accountExpires: Date,
  
  // Logon Information
  lastLogon: Date,
  lastLogonTimestamp: Date,
  logonCount: {
    type: Number,
    default: 0
  },
  badPwdCount: {
    type: Number,
    default: 0
  },
  badPasswordTime: Date,
  
  // Group Membership
  memberOf: [String],
  primaryGroupID: {
    type: Number,
    default: 513 // Domain Users
  },
  
  // Profile Information
  profilePath: String,
  scriptPath: String,
  homeDirectory: String,
  homeDrive: String,
  
  // Object Class and Category
  objectClass: {
    type: [String],
    default: ['top', 'person', 'organizationalPerson', 'user']
  },
  objectCategory: String,
  objectGUID: {
    type: String,
    default: () => require('uuid').v4()
  },
  objectSid: String,
  
  // Security Identifiers
  tokenGroups: [String],
  tokenGroupsGlobalAndUniversal: [String],
  
  // Certificate Information
  userCertificate: [Buffer],
  userSMIMECertificate: [Buffer],
  
  // Extended Attributes
  extensionAttribute1: String,
  extensionAttribute2: String,
  extensionAttribute3: String,
  extensionAttribute4: String,
  extensionAttribute5: String,
  
  // Custom Attributes for QuantumMint
  quantumMintUserId: {
    type: String,
    index: true
  },
  quantumMintRoles: [String],
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
  collection: 'domainUsers'
});

// Indexes for performance
domainUserSchema.index({ dn: 1 });
domainUserSchema.index({ sAMAccountName: 1 });
domainUserSchema.index({ userPrincipalName: 1 });
domainUserSchema.index({ mail: 1 });
domainUserSchema.index({ objectGUID: 1 });
domainUserSchema.index({ quantumMintUserId: 1 });

// Virtual for full name
domainUserSchema.virtual('fullName').get(function() {
  if (this.givenName && this.sn) {
    return `${this.givenName} ${this.sn}`;
  }
  return this.displayName || this.cn;
});

// Method to check if account is disabled
domainUserSchema.methods.isDisabled = function() {
  return (this.userAccountControl & 2) !== 0;
};

// Method to check if account is locked
domainUserSchema.methods.isLocked = function() {
  return (this.userAccountControl & 16) !== 0;
};

// Method to check if password never expires
domainUserSchema.methods.passwordNeverExpires = function() {
  return (this.userAccountControl & 65536) !== 0;
};

// Method to check if user must change password at next logon
domainUserSchema.methods.mustChangePassword = function() {
  return this.pwdLastSet && this.pwdLastSet.getTime() === 0;
};

// Method to get user's groups
domainUserSchema.methods.getGroups = async function() {
  const DomainGroup = require('./DomainGroup');
  return await DomainGroup.find({ dn: { $in: this.memberOf } });
};

// Pre-save middleware
domainUserSchema.pre('save', function(next) {
  this.whenChanged = new Date();
  
  // Ensure objectGUID is set
  if (!this.objectGUID) {
    this.objectGUID = require('uuid').v4();
  }
  
  // Set display name if not provided
  if (!this.displayName && this.givenName && this.sn) {
    this.displayName = `${this.givenName} ${this.sn}`;
  }
  
  next();
});

// Static method to find by SAM account name
domainUserSchema.statics.findBySAM = function(sAMAccountName) {
  return this.findOne({ sAMAccountName });
};

// Static method to find by UPN
domainUserSchema.statics.findByUPN = function(userPrincipalName) {
  return this.findOne({ userPrincipalName });
};

// Static method to find by email
domainUserSchema.statics.findByEmail = function(mail) {
  return this.findOne({ mail });
};

module.exports = mongoose.model('DomainUser', domainUserSchema);
