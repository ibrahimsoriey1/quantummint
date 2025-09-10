// MongoDB Initialization Script for QuantumMint Platform

// Switch to the quantummint database
db = db.getSiblingDB('quantummint');

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 8
        },
        firstName: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 50
        },
        lastName: {
          bsonType: 'string',
          minLength: 2,
          maxLength: 50
        },
        role: {
          bsonType: 'string',
          enum: ['user', 'admin', 'moderator']
        },
        isVerified: {
          bsonType: 'bool'
        },
        twoFactorEnabled: {
          bsonType: 'bool'
        }
      }
    }
  }
});

// Create indexes for better performance
print('Creating database indexes...');

// Users collection indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isVerified: 1 });

// Transactions collection indexes
db.transactions.createIndex({ userId: 1, createdAt: -1 });
db.transactions.createIndex({ transactionId: 1 }, { unique: true });
db.transactions.createIndex({ type: 1, status: 1 });
db.transactions.createIndex({ createdAt: -1 });

// Balances collection indexes
db.balances.createIndex({ userId: 1 }, { unique: true });
db.balances.createIndex({ updatedAt: -1 });

// Payments collection indexes
db.payments.createIndex({ userId: 1, createdAt: -1 });
db.payments.createIndex({ paymentId: 1 }, { unique: true });
db.payments.createIndex({ provider: 1, status: 1 });
db.payments.createIndex({ status: 1, createdAt: -1 });

// KYC Profiles collection indexes
db.kycprofiles.createIndex({ userId: 1 }, { unique: true });
db.kycprofiles.createIndex({ status: 1, level: 1 });
db.kycprofiles.createIndex({ createdAt: -1 });
db.kycprofiles.createIndex({ 'personalInfo.email': 1 });

// Documents collection indexes
db.documents.createIndex({ userId: 1, profileId: 1 });
db.documents.createIndex({ type: 1, status: 1 });
db.documents.createIndex({ createdAt: -1 });

// Verifications collection indexes
db.verifications.createIndex({ userId: 1, profileId: 1 });
db.verifications.createIndex({ type: 1, status: 1 });
db.verifications.createIndex({ createdAt: -1 });

// Money Generation collection indexes
db.moneygeneration.createIndex({ userId: 1, createdAt: -1 });
db.moneygeneration.createIndex({ status: 1, createdAt: -1 });
db.moneygeneration.createIndex({ algorithm: 1 });

// Providers collection indexes
db.providers.createIndex({ name: 1 }, { unique: true });
db.providers.createIndex({ isActive: 1 });
db.providers.createIndex({ type: 1 });

// Webhooks collection indexes
db.webhooks.createIndex({ provider: 1, createdAt: -1 });
db.webhooks.createIndex({ status: 1, retryCount: 1 });
db.webhooks.createIndex({ createdAt: -1 });

print('Database indexes created successfully');

// Insert default payment providers
print('Inserting default payment providers...');

db.providers.insertMany([
  {
    name: 'stripe',
    displayName: 'Stripe',
    type: 'credit_card',
    isActive: true,
    configuration: {
      apiVersion: '2022-11-15',
      supportedCurrencies: ['USD', 'EUR', 'GBP']
    },
    fees: {
      percentage: 2.9,
      fixed: 0.30
    },
    limits: {
      min: 0.50,
      max: 999999.99,
      daily: 100000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'orange_money',
    displayName: 'Orange Money',
    type: 'mobile_money',
    isActive: true,
    configuration: {
      apiVersion: 'v1',
      supportedCurrencies: ['XOF', 'XAF', 'USD']
    },
    fees: {
      percentage: 1.5,
      fixed: 0.00
    },
    limits: {
      min: 1.00,
      max: 50000.00,
      daily: 200000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'afrimoney',
    displayName: 'AfriMoney',
    type: 'mobile_money',
    isActive: true,
    configuration: {
      apiVersion: 'v2',
      supportedCurrencies: ['USD', 'XOF', 'GHS']
    },
    fees: {
      percentage: 1.8,
      fixed: 0.25
    },
    limits: {
      min: 1.00,
      max: 25000.00,
      daily: 100000.00
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Default payment providers inserted');

// Create admin user (you should change these credentials)
print('Creating default admin user...');

db.users.insertOne({
  email: 'admin@quantummint.com',
  password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3QJb9vKYPi', // password: admin123
  firstName: 'System',
  lastName: 'Administrator',
  role: 'admin',
  isVerified: true,
  twoFactorEnabled: false,
  phoneNumber: '+1234567890',
  createdAt: new Date(),
  updatedAt: new Date()
});

// Initialize admin balance
const adminUser = db.users.findOne({ email: 'admin@quantummint.com' });
if (adminUser) {
  db.balances.insertOne({
    userId: adminUser._id,
    available: 1000000.00,
    locked: 0.00,
    currency: 'USD',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

print('Default admin user created (email: admin@quantummint.com, password: admin123)');
print('WARNING: Please change the admin password after first login!');

// Create system configuration collection
db.systemconfig.insertOne({
  name: 'quantummint_config',
  version: '1.0.0',
  features: {
    moneyGeneration: true,
    kycVerification: true,
    paymentIntegration: true,
    twoFactorAuth: true
  },
  limits: {
    dailyGenerationLimit: 5000.00,
    maxTransactionAmount: 100000.00,
    maxFileSize: 10485760, // 10MB
    sessionTimeout: 3600000 // 1 hour
  },
  security: {
    passwordMinLength: 8,
    maxLoginAttempts: 5,
    lockoutDuration: 900000, // 15 minutes
    jwtExpiresIn: '24h'
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print('System configuration created');

print('MongoDB initialization completed successfully!');
print('Database: quantummint');
print('Collections created with indexes and validation schemas');
print('Default data inserted');
print('Ready for application startup!');
