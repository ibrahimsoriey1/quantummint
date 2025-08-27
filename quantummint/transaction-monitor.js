/**
 * Transaction Monitoring System for QuantumMint
 * Detects suspicious activities and potential fraud in transactions
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger.util');

/**
 * Transaction Monitor Service
 * Monitors transactions for suspicious activities
 */
class TransactionMonitorService {
  /**
   * Initialize transaction monitor service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.thresholds = {
      // Large transaction threshold
      largeTransaction: options.largeTransaction || 5000,
      
      // Rapid transaction threshold (number of transactions)
      rapidTransactionCount: options.rapidTransactionCount || 5,
      
      // Rapid transaction time window (in minutes)
      rapidTransactionWindow: options.rapidTransactionWindow || 5,
      
      // Unusual location threshold (distance in km)
      unusualLocationDistance: options.unusualLocationDistance || 500,
      
      // Multiple failed attempts threshold
      failedAttemptsThreshold: options.failedAttemptsThreshold || 3,
      
      // Failed attempts time window (in minutes)
      failedAttemptsWindow: options.failedAttemptsWindow || 10,
    };
    
    this.alertHandlers = options.alertHandlers || [this.defaultAlertHandler];
    this.db = options.db || mongoose.connection;
    this.logger = options.logger || logger;
  }

  /**
   * Monitor a transaction for suspicious activity
   * @param {Object} transaction - Transaction data
   * @param {Object} context - Additional context data
   * @returns {Promise<Object>} Monitoring result
   */
  async monitorTransaction(transaction, context = {}) {
    try {
      const userId = transaction.userId || context.userId;
      const walletId = transaction.walletId || context.walletId;
      
      if (!userId) {
        throw new Error('User ID is required for transaction monitoring');
      }
      
      // Run all checks in parallel
      const [
        isLargeTransaction,
        isRapidTransaction,
        isUnusualLocation,
        hasRecentFailedAttempts,
        isKnownFraudPattern
      ] = await Promise.all([
        this.checkLargeTransaction(transaction),
        this.checkRapidTransactions(userId, transaction),
        this.checkUnusualLocation(userId, transaction, context),
        this.checkFailedAttempts(userId),
        this.checkFraudPatterns(transaction)
      ]);
      
      // Calculate risk score (0-100)
      const riskScore = this.calculateRiskScore({
        isLargeTransaction,
        isRapidTransaction,
        isUnusualLocation,
        hasRecentFailedAttempts,
        isKnownFraudPattern,
        transaction,
        context
      });
      
      // Determine if transaction is suspicious
      const isSuspicious = riskScore >= 70;
      
      // Log monitoring result
      this.logger.info('QuantumMint Transaction Monitored', {
        transactionId: transaction.id,
        userId,
        walletId,
        riskScore,
        isSuspicious,
        flags: {
          isLargeTransaction,
          isRapidTransaction,
          isUnusualLocation,
          hasRecentFailedAttempts,
          isKnownFraudPattern
        }
      });
      
      // Handle alerts if suspicious
      if (isSuspicious) {
        this.triggerAlerts({
          transaction,
          context,
          riskScore,
          flags: {
            isLargeTransaction,
            isRapidTransaction,
            isUnusualLocation,
            hasRecentFailedAttempts,
            isKnownFraudPattern
          }
        });
      }
      
      return {
        transactionId: transaction.id,
        riskScore,
        isSuspicious,
        flags: {
          isLargeTransaction,
          isRapidTransaction,
          isUnusualLocation,
          hasRecentFailedAttempts,
          isKnownFraudPattern
        }
      };
    } catch (error) {
      this.logger.error('QuantumMint Transaction Monitoring Error', {
        error: error.message,
        transactionId: transaction.id,
        stack: error.stack
      });
      
      // Return a safe result with high risk score due to error
      return {
        transactionId: transaction.id,
        riskScore: 80,
        isSuspicious: true,
        error: error.message,
        flags: {
          monitoringError: true
        }
      };
    }
  }

  /**
   * Check if transaction amount exceeds large transaction threshold
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Boolean>} True if transaction is large
   */
  async checkLargeTransaction(transaction) {
    return transaction.amount >= this.thresholds.largeTransaction;
  }

  /**
   * Check if user has made multiple transactions in a short time period
   * @param {String} userId - User ID
   * @param {Object} transaction - Current transaction
   * @returns {Promise<Boolean>} True if rapid transactions detected
   */
  async checkRapidTransactions(userId, transaction) {
    try {
      const windowMinutes = this.thresholds.rapidTransactionWindow;
      const windowStart = new Date(Date.now() - (windowMinutes * 60 * 1000));
      
      const recentTransactionsCount = await this.db.collection('transactions').countDocuments({
        userId,
        createdAt: { $gte: windowStart },
        _id: { $ne: transaction._id } // Exclude current transaction
      });
      
      return recentTransactionsCount >= this.thresholds.rapidTransactionCount;
    } catch (error) {
      this.logger.error('QuantumMint Rapid Transaction Check Error', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Check if transaction location is unusual for the user
   * @param {String} userId - User ID
   * @param {Object} transaction - Transaction data
   * @param {Object} context - Additional context
   * @returns {Promise<Boolean>} True if location is unusual
   */
  async checkUnusualLocation(userId, transaction, context) {
    try {
      // Skip if no location data
      if (!context.location || !context.location.coordinates) {
        return false;
      }
      
      // Get user's common locations
      const userProfile = await this.db.collection('userProfiles').findOne({ userId });
      
      if (!userProfile || !userProfile.commonLocations || userProfile.commonLocations.length === 0) {
        // No location history, can't determine if unusual
        return false;
      }
      
      // Calculate minimum distance to any common location
      const currentLocation = context.location.coordinates;
      let minDistance = Infinity;
      
      for (const location of userProfile.commonLocations) {
        const distance = this.calculateDistance(
          currentLocation[1], // latitude
          currentLocation[0], // longitude
          location.coordinates[1], // latitude
          location.coordinates[0] // longitude
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      return minDistance > this.thresholds.unusualLocationDistance;
    } catch (error) {
      this.logger.error('QuantumMint Unusual Location Check Error', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Check if user has recent failed transaction attempts
   * @param {String} userId - User ID
   * @returns {Promise<Boolean>} True if recent failed attempts exceed threshold
   */
  async checkFailedAttempts(userId) {
    try {
      const windowMinutes = this.thresholds.failedAttemptsWindow;
      const windowStart = new Date(Date.now() - (windowMinutes * 60 * 1000));
      
      const failedAttemptsCount = await this.db.collection('transactionAttempts').countDocuments({
        userId,
        status: 'failed',
        createdAt: { $gte: windowStart }
      });
      
      return failedAttemptsCount >= this.thresholds.failedAttemptsThreshold;
    } catch (error) {
      this.logger.error('QuantumMint Failed Attempts Check Error', {
        error: error.message,
        userId
      });
      return false;
    }
  }

  /**
   * Check if transaction matches known fraud patterns
   * @param {Object} transaction - Transaction data
   * @returns {Promise<Boolean>} True if matches fraud pattern
   */
  async checkFraudPatterns(transaction) {
    try {
      // Check against known fraud patterns in database
      const matchingPatterns = await this.db.collection('fraudPatterns').findOne({
        active: true,
        $or: [
          { 'patterns.amount': transaction.amount },
          { 'patterns.destinationPattern': { $regex: transaction.destination || '' } },
          { 'patterns.metadata': transaction.metadata }
        ]
      });
      
      return !!matchingPatterns;
    } catch (error) {
      this.logger.error('QuantumMint Fraud Pattern Check Error', {
        error: error.message,
        transactionId: transaction.id
      });
      return false;
    }
  }

  /**
   * Calculate risk score based on various factors
   * @param {Object} params - Risk factors
   * @returns {Number} Risk score (0-100)
   */
  calculateRiskScore(params) {
    let score = 0;
    
    // Base weights for different factors
    const weights = {
      largeTransaction: 20,
      rapidTransaction: 15,
      unusualLocation: 25,
      failedAttempts: 15,
      fraudPattern: 30,
      userHistory: 10,
      transactionType: 5
    };
    
    // Add score for each flag
    if (params.isLargeTransaction) score += weights.largeTransaction;
    if (params.isRapidTransaction) score += weights.rapidTransaction;
    if (params.isUnusualLocation) score += weights.unusualLocation;
    if (params.hasRecentFailedAttempts) score += weights.failedAttempts;
    if (params.isKnownFraudPattern) score += weights.fraudPattern;
    
    // Adjust based on transaction type
    if (params.transaction.type === 'cash-out') {
      score += weights.transactionType;
    }
    
    // Adjust based on user history if available
    if (params.context.userRiskScore) {
      score += params.context.userRiskScore * (weights.userHistory / 100);
    }
    
    // Cap score at 100
    return Math.min(100, score);
  }

  /**
   * Trigger alerts for suspicious transactions
   * @param {Object} alertData - Alert data
   */
  triggerAlerts(alertData) {
    for (const handler of this.alertHandlers) {
      try {
        handler(alertData);
      } catch (error) {
        this.logger.error('QuantumMint Alert Handler Error', {
          error: error.message,
          transactionId: alertData.transaction.id
        });
      }
    }
  }

  /**
   * Default alert handler
   * @param {Object} alertData - Alert data
   */
  defaultAlertHandler(alertData) {
    logger.warn('QuantumMint Suspicious Transaction Alert', {
      transactionId: alertData.transaction.id,
      userId: alertData.transaction.userId,
      riskScore: alertData.riskScore,
      flags: alertData.flags
    });
    
    // In a real implementation, this would send alerts to security team
    // via email, SMS, or integration with security systems
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Number} lat1 - Latitude 1
   * @param {Number} lon1 - Longitude 1
   * @param {Number} lat2 - Latitude 2
   * @param {Number} lon2 - Longitude 2
   * @returns {Number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {Number} deg - Degrees
   * @returns {Number} Radians
   */
  deg2rad(deg) {
    return deg * (Math.PI/180);
  }
}

module.exports = TransactionMonitorService;