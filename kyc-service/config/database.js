const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    let mongoURI;

    // Select database based on environment
    if (process.env.NODE_ENV === 'test') {
      mongoURI = process.env.MONGODB_URI_TEST;
    } else if (process.env.NODE_ENV === 'production') {
      mongoURI = process.env.MONGODB_URI_PROD;
    } else {
      mongoURI = process.env.MONGODB_URI_DEV;
    }

    if (!mongoURI) {
      throw new Error('MongoDB URI not configured');
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error during MongoDB disconnection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

module.exports = connectDB;
