// Migration script to update existing users from 'password' to 'passwordHash'
// Run this script once to migrate your existing data

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to your MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummint_auth';

async function migrateUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find all users that have 'password' field but no 'passwordHash'
    const usersToMigrate = await usersCollection.find({
      password: { $exists: true },
      passwordHash: { $exists: false }
    }).toArray();

    console.log(`Found ${usersToMigrate.length} users to migrate`);

    // Migrate each user
    for (const user of usersToMigrate) {
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: { passwordHash: user.password },
          $unset: { password: 1 }
        }
      );
      console.log(`Migrated user: ${user.email}`);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
