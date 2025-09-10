// MongoDB initialization script for QuantumMint Domain Controller

// Switch to the domain database
db = db.getSiblingDB('quantummint-domain');

// Create collections with proper indexes
db.createCollection('domainusers');
db.createCollection('domaingroups');
db.createCollection('domaincomputers');
db.createCollection('organizationalunits');
db.createCollection('grouppolicies');
db.createCollection('auditevents');

// Create indexes for DomainUsers
db.domainusers.createIndex({ "sAMAccountName": 1 }, { unique: true });
db.domainusers.createIndex({ "userPrincipalName": 1 }, { unique: true, sparse: true });
db.domainusers.createIndex({ "mail": 1 }, { sparse: true });
db.domainusers.createIndex({ "dn": 1 }, { unique: true });
db.domainusers.createIndex({ "memberOf": 1 });
db.domainusers.createIndex({ "objectClass": 1 });

// Create indexes for DomainGroups
db.domaingroups.createIndex({ "sAMAccountName": 1 }, { unique: true });
db.domaingroups.createIndex({ "dn": 1 }, { unique: true });
db.domaingroups.createIndex({ "member": 1 });
db.domaingroups.createIndex({ "groupType": 1 });
db.domaingroups.createIndex({ "objectClass": 1 });

// Create indexes for DomainComputers
db.domaincomputers.createIndex({ "sAMAccountName": 1 }, { unique: true });
db.domaincomputers.createIndex({ "dNSHostName": 1 }, { unique: true, sparse: true });
db.domaincomputers.createIndex({ "dn": 1 }, { unique: true });
db.domaincomputers.createIndex({ "servicePrincipalName": 1 });
db.domaincomputers.createIndex({ "objectClass": 1 });

// Create indexes for OrganizationalUnits
db.organizationalunits.createIndex({ "dn": 1 }, { unique: true });
db.organizationalunits.createIndex({ "ou": 1 });
db.organizationalunits.createIndex({ "objectClass": 1 });

// Create indexes for GroupPolicies
db.grouppolicies.createIndex({ "name": 1 });
db.grouppolicies.createIndex({ "type": 1 });
db.grouppolicies.createIndex({ "links.targetDN": 1 });

// Create indexes for AuditEvents (TTL index for automatic cleanup)
db.auditevents.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 31536000 }); // 1 year
db.auditevents.createIndex({ "type": 1 });
db.auditevents.createIndex({ "user": 1 });
db.auditevents.createIndex({ "severity": 1 });

// Create default domain structure
const baseDN = 'dc=quantummint,dc=local';

// Create default Organizational Units
const defaultOUs = [
  {
    dn: `cn=Users,${baseDN}`,
    ou: 'Users',
    objectClass: ['top', 'organizationalUnit'],
    description: 'Default container for user accounts'
  },
  {
    dn: `cn=Groups,${baseDN}`,
    ou: 'Groups',
    objectClass: ['top', 'organizationalUnit'],
    description: 'Default container for security groups'
  },
  {
    dn: `cn=Computers,${baseDN}`,
    ou: 'Computers',
    objectClass: ['top', 'organizationalUnit'],
    description: 'Default container for computer accounts'
  },
  {
    dn: `cn=Domain Controllers,${baseDN}`,
    ou: 'Domain Controllers',
    objectClass: ['top', 'organizationalUnit'],
    description: 'Default container for domain controllers'
  }
];

defaultOUs.forEach(ou => {
  try {
    db.organizationalunits.insertOne(ou);
    print(`Created OU: ${ou.dn}`);
  } catch (e) {
    if (e.code !== 11000) { // Ignore duplicate key errors
      print(`Error creating OU ${ou.dn}: ${e.message}`);
    }
  }
});

// Create default groups
const defaultGroups = [
  {
    dn: `cn=Domain Admins,cn=Groups,${baseDN}`,
    cn: 'Domain Admins',
    sAMAccountName: 'Domain Admins',
    displayName: 'Domain Admins',
    description: 'Designated administrators of the domain',
    groupType: -2147483646, // Global Security Group
    groupScope: 'Global',
    groupCategory: 'Security',
    objectClass: ['top', 'group'],
    objectCategory: `cn=Group,cn=Schema,cn=Configuration,${baseDN}`,
    member: []
  },
  {
    dn: `cn=Domain Users,cn=Groups,${baseDN}`,
    cn: 'Domain Users',
    sAMAccountName: 'Domain Users',
    displayName: 'Domain Users',
    description: 'All domain users',
    groupType: -2147483646, // Global Security Group
    groupScope: 'Global',
    groupCategory: 'Security',
    objectClass: ['top', 'group'],
    objectCategory: `cn=Group,cn=Schema,cn=Configuration,${baseDN}`,
    member: []
  },
  {
    dn: `cn=Domain Computers,cn=Groups,${baseDN}`,
    cn: 'Domain Computers',
    sAMAccountName: 'Domain Computers',
    displayName: 'Domain Computers',
    description: 'All workstations and servers joined to the domain',
    groupType: -2147483646, // Global Security Group
    groupScope: 'Global',
    groupCategory: 'Security',
    objectClass: ['top', 'group'],
    objectCategory: `cn=Group,cn=Schema,cn=Configuration,${baseDN}`,
    member: []
  },
  {
    dn: `cn=Enterprise Admins,cn=Groups,${baseDN}`,
    cn: 'Enterprise Admins',
    sAMAccountName: 'Enterprise Admins',
    displayName: 'Enterprise Admins',
    description: 'Designated administrators of the enterprise',
    groupType: -2147483640, // Universal Security Group
    groupScope: 'Universal',
    groupCategory: 'Security',
    objectClass: ['top', 'group'],
    objectCategory: `cn=Group,cn=Schema,cn=Configuration,${baseDN}`,
    member: []
  }
];

defaultGroups.forEach(group => {
  try {
    db.domaingroups.insertOne(group);
    print(`Created group: ${group.sAMAccountName}`);
  } catch (e) {
    if (e.code !== 11000) { // Ignore duplicate key errors
      print(`Error creating group ${group.sAMAccountName}: ${e.message}`);
    }
  }
});

// Create default Administrator user
const adminUser = {
  dn: `cn=Administrator,cn=Users,${baseDN}`,
  cn: 'Administrator',
  sAMAccountName: 'Administrator',
  userPrincipalName: `Administrator@quantummint.local`,
  displayName: 'Administrator',
  description: 'Built-in account for administering the computer/domain',
  // Password: Admin123! (hashed with bcrypt)
  password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO8G',
  userAccountControl: 512, // Normal account
  pwdLastSet: new Date(),
  memberOf: [
    `cn=Domain Admins,cn=Groups,${baseDN}`,
    `cn=Enterprise Admins,cn=Groups,${baseDN}`,
    `cn=Domain Users,cn=Groups,${baseDN}`
  ],
  objectClass: ['top', 'person', 'organizationalPerson', 'user'],
  objectCategory: `cn=Person,cn=Schema,cn=Configuration,${baseDN}`,
  whenCreated: new Date(),
  whenChanged: new Date()
};

try {
  db.domainusers.insertOne(adminUser);
  print('Created Administrator user (password: Admin123!)');
  
  // Add Administrator to groups
  db.domaingroups.updateOne(
    { sAMAccountName: 'Domain Admins' },
    { $addToSet: { member: adminUser.dn } }
  );
  db.domaingroups.updateOne(
    { sAMAccountName: 'Enterprise Admins' },
    { $addToSet: { member: adminUser.dn } }
  );
  db.domaingroups.updateOne(
    { sAMAccountName: 'Domain Users' },
    { $addToSet: { member: adminUser.dn } }
  );
  
} catch (e) {
  if (e.code !== 11000) { // Ignore duplicate key errors
    print(`Error creating Administrator user: ${e.message}`);
  }
}

print('MongoDB initialization completed for QuantumMint Domain Controller');
