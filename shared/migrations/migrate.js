const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { connectDB } = require('../config/database');

// Import all migrations
const migrations = [
  require('./001_initial_schema')
];

class MigrationRunner {
  constructor() {
    this.migrations = migrations;
  }
  
  async run() {
    try {
      await connectDB();
      
      // Create migrations collection if it doesn't exist
      await this.ensureMigrationsCollection();
      
      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Run pending migrations
      for (let i = 0; i < this.migrations.length; i++) {
        const migration = this.migrations[i];
        const migrationName = `00${i + 1}_${migration.name || 'migration'}`;
        
        if (!appliedMigrations.includes(migrationName)) {
          logger.info(`Running migration: ${migrationName}`);
          
          try {
            await migration.up();
            await this.recordMigration(migrationName, 'up');
            logger.info(`Migration ${migrationName} completed successfully`);
          } catch (error) {
            logger.error(`Migration ${migrationName} failed:`, error);
            throw error;
          }
        } else {
          logger.info(`Migration ${migrationName} already applied, skipping`);
        }
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    } finally {
      await mongoose.connection.close();
    }
  }
  
  async rollback(migrationIndex) {
    try {
      await connectDB();
      
      if (migrationIndex < 0 || migrationIndex >= this.migrations.length) {
        throw new Error('Invalid migration index');
      }
      
      const migration = this.migrations[migrationIndex];
      const migrationName = `00${migrationIndex + 1}_${migration.name || 'migration'}`;
      
      logger.info(`Rolling back migration: ${migrationName}`);
      
      try {
        await migration.down();
        await this.recordMigration(migrationName, 'down');
        logger.info(`Migration ${migrationName} rolled back successfully`);
      } catch (error) {
        logger.error(`Migration ${migrationName} rollback failed:`, error);
        throw error;
      }
    } catch (error) {
      logger.error('Migration rollback process failed:', error);
      throw error;
    } finally {
      await mongoose.connection.close();
    }
  }
  
  async ensureMigrationsCollection() {
    try {
      await mongoose.connection.db.createCollection('migrations');
    } catch (error) {
      if (error.code !== 48) { // Collection already exists
        throw error;
      }
    }
  }
  
  async getAppliedMigrations() {
    try {
      const migrations = await mongoose.connection.db
        .collection('migrations')
        .find({ direction: 'up' })
        .toArray();
      
      return migrations.map(m => m.name);
    } catch (error) {
      logger.error('Error getting applied migrations:', error);
      return [];
    }
  }
  
  async recordMigration(name, direction) {
    await mongoose.connection.db.collection('migrations').insertOne({
      name,
      direction,
      timestamp: new Date()
    });
  }
  
  async status() {
    try {
      await connectDB();
      
      const appliedMigrations = await this.getAppliedMigrations();
      
      logger.info('Migration Status:');
      logger.info('================');
      
      for (let i = 0; i < this.migrations.length; i++) {
        const migration = this.migrations[i];
        const migrationName = `00${i + 1}_${migration.name || 'migration'}`;
        const status = appliedMigrations.includes(migrationName) ? 'APPLIED' : 'PENDING';
        
        logger.info(`${migrationName}: ${status}`);
      }
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    } finally {
      await mongoose.connection.close();
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();
  
  switch (command) {
    case 'up':
      migrationRunner.run().catch(console.error);
      break;
    case 'down':
      const migrationIndex = parseInt(process.argv[3]);
      if (isNaN(migrationIndex)) {
        console.error('Please provide a valid migration index');
        process.exit(1);
      }
      migrationRunner.rollback(migrationIndex).catch(console.error);
      break;
    case 'status':
      migrationRunner.status().catch(console.error);
      break;
    default:
      console.log('Usage: node migrate.js [up|down|status] [migration_index]');
      console.log('  up: Run all pending migrations');
      console.log('  down <index>: Rollback migration at index');
      console.log('  status: Show migration status');
      process.exit(1);
  }
}

module.exports = MigrationRunner;
