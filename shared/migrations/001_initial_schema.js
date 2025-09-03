const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Initial schema migration
 * Creates all required collections and indexes
 */
async function up() {
  try {
    logger.info('Starting initial schema migration...');
    
    // Create collections by ensuring models are registered
    const collections = [
      'users',
      'wallets', 
      'transactions',
      'generation_records',
      'cash_out_requests',
      'payment_providers',
      'audit_logs',
      'system_configurations',
      'kyc_verifications',
      'notification_templates',
      'notifications',
      'documents',
      'verifications'
    ];
    
    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.createCollection(collectionName);
        logger.info(`Created collection: ${collectionName}`);
      } catch (error) {
        if (error.code === 48) { // Collection already exists
          logger.info(`Collection ${collectionName} already exists`);
        } else {
          throw error;
        }
      }
    }
    
    // Create indexes for better performance
    await createIndexes();
    
    logger.info('Initial schema migration completed successfully');
  } catch (error) {
    logger.error('Initial schema migration failed:', error);
    throw error;
  }
}

async function down() {
  try {
    logger.info('Rolling back initial schema migration...');
    
    // Drop all collections
    const collections = [
      'users',
      'wallets',
      'transactions', 
      'generation_records',
      'cash_out_requests',
      'payment_providers',
      'audit_logs',
      'system_configurations',
      'kyc_verifications',
      'notification_templates',
      'notifications',
      'documents',
      'verifications'
    ];
    
    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.dropCollection(collectionName);
        logger.info(`Dropped collection: ${collectionName}`);
      } catch (error) {
        if (error.code === 26) { // Namespace not found
          logger.info(`Collection ${collectionName} does not exist`);
        } else {
          throw error;
        }
      }
    }
    
    logger.info('Initial schema migration rollback completed');
  } catch (error) {
    logger.error('Initial schema migration rollback failed:', error);
    throw error;
  }
}

async function createIndexes() {
  const db = mongoose.connection.db;
  
  // Users collection indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('users').createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });
  await db.collection('users').createIndex({ status: 1 });
  await db.collection('users').createIndex({ role: 1 });
  await db.collection('users').createIndex({ kycLevel: 1 });
  await db.collection('users').createIndex({ createdAt: -1 });
  
  // Wallets collection indexes
  await db.collection('wallets').createIndex({ userId: 1 }, { unique: true });
  await db.collection('wallets').createIndex({ status: 1 });
  await db.collection('wallets').createIndex({ currency: 1 });
  await db.collection('wallets').createIndex({ walletType: 1 });
  await db.collection('wallets').createIndex({ createdAt: -1 });
  
  // Transactions collection indexes
  await db.collection('transactions').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('transactions').createIndex({ sourceWalletId: 1 });
  await db.collection('transactions').createIndex({ destinationWalletId: 1 });
  await db.collection('transactions').createIndex({ transactionType: 1 });
  await db.collection('transactions').createIndex({ status: 1 });
  await db.collection('transactions').createIndex({ createdAt: -1 });
  await db.collection('transactions').createIndex({ reference: 1 });
  await db.collection('transactions').createIndex({ provider: 1 });
  await db.collection('transactions').createIndex({ currency: 1 });
  
  // Generation records collection indexes
  await db.collection('generation_records').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('generation_records').createIndex({ walletId: 1 });
  await db.collection('generation_records').createIndex({ status: 1 });
  await db.collection('generation_records').createIndex({ createdAt: -1 });
  
  // Cash out requests collection indexes
  await db.collection('cash_out_requests').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('cash_out_requests').createIndex({ walletId: 1 });
  await db.collection('cash_out_requests').createIndex({ status: 1 });
  await db.collection('cash_out_requests').createIndex({ provider: 1 });
  await db.collection('cash_out_requests').createIndex({ createdAt: -1 });
  
  // Payment providers collection indexes
  await db.collection('payment_providers').createIndex({ name: 1 }, { unique: true });
  await db.collection('payment_providers').createIndex({ status: 1 });
  await db.collection('payment_providers').createIndex({ type: 1 });
  await db.collection('payment_providers').createIndex({ supportedCurrencies: 1 });
  await db.collection('payment_providers').createIndex({ supportedCountries: 1 });
  
  // Audit logs collection indexes
  await db.collection('audit_logs').createIndex({ userId: 1, timestamp: -1 });
  await db.collection('audit_logs').createIndex({ action: 1, timestamp: -1 });
  await db.collection('audit_logs').createIndex({ resourceType: 1, resourceId: 1 });
  await db.collection('audit_logs').createIndex({ timestamp: -1 });
  await db.collection('audit_logs').createIndex({ ipAddress: 1, timestamp: -1 });
  // TTL index for automatic cleanup (5 years)
  await db.collection('audit_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 157680000 });
  
  // System configurations collection indexes
  await db.collection('system_configurations').createIndex({ key: 1 }, { unique: true });
  await db.collection('system_configurations').createIndex({ category: 1, key: 1 });
  await db.collection('system_configurations').createIndex({ isPublic: 1 });
  await db.collection('system_configurations').createIndex({ environment: 1 });
  await db.collection('system_configurations').createIndex({ tags: 1 });
  
  // KYC verifications collection indexes
  await db.collection('kyc_verifications').createIndex({ userId: 1 });
  await db.collection('kyc_verifications').createIndex({ status: 1 });
  await db.collection('kyc_verifications').createIndex({ currentTier: 1 });
  await db.collection('kyc_verifications').createIndex({ createdAt: -1 });
  
  // Notification templates collection indexes
  await db.collection('notification_templates').createIndex({ name: 1 }, { unique: true });
  await db.collection('notification_templates').createIndex({ type: 1, status: 1 });
  await db.collection('notification_templates').createIndex({ category: 1 });
  await db.collection('notification_templates').createIndex({ language: 1 });
  await db.collection('notification_templates').createIndex({ tags: 1 });
  
  // Notifications collection indexes
  await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('notifications').createIndex({ status: 1, scheduledAt: 1 });
  await db.collection('notifications').createIndex({ channel: 1, status: 1 });
  await db.collection('notifications').createIndex({ category: 1 });
  await db.collection('notifications').createIndex({ sentAt: -1 });
  await db.collection('notifications').createIndex({ readAt: -1 });
  await db.collection('notifications').createIndex({ providerMessageId: 1 });
  // TTL index for automatic cleanup (1 year)
  await db.collection('notifications').createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
  
  // Documents collection indexes
  await db.collection('documents').createIndex({ userId: 1, type: 1 });
  await db.collection('documents').createIndex({ status: 1 });
  await db.collection('documents').createIndex({ purpose: 1 });
  await db.collection('documents').createIndex({ tier: 1 });
  await db.collection('documents').createIndex({ createdAt: -1 });
  
  // Verifications collection indexes
  await db.collection('verifications').createIndex({ userId: 1, type: 1, tier: 1 });
  await db.collection('verifications').createIndex({ status: 1 });
  await db.collection('verifications').createIndex({ expiresAt: 1 });
  await db.collection('verifications').createIndex({ createdAt: -1 });
  
  logger.info('All indexes created successfully');
}

module.exports = { up, down };
