const { redisClient } = require('../config/redis');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Fraud Detection Service
 * Implements various fraud detection mechanisms:
 * 1. Velocity checks - monitors transaction frequency and amounts
 * 2. Pattern recognition - identifies suspicious patterns
 * 3. Anomaly detection - detects unusual behavior
 * 4. Device fingerprinting - tracks device information
 */
class FraudDetectionService {
  constructor() {
    // Configuration
    this.velocityThresholds = {
      maxTransactionsPerMinute: parseInt(process.env.FRAUD_MAX_TRANSACTIONS_PER_MINUTE) || 5,
      maxTransactionsPerHour: parseInt(process.env.FRAUD_MAX_TRANSACTIONS_PER_HOUR) || 20,
      maxAmountPerTransaction: parseFloat(process.env.FRAUD_MAX_AMOUNT_PER_TRANSACTION) || 10000,
      maxAmountPerDay: parseFloat(process.env.FRAUD_MAX_AMOUNT_PER_DAY) || 50000
    };
    
    // Suspicious patterns
    this.suspiciousPatterns = {
      multipleFailedAttempts: parseInt(process.env.FRAUD_MAX_FAILED_ATTEMPTS) || 5,
      multipleAccountsPerIp: parseInt(process.env.FRAUD_MAX_ACCOUNTS_PER_IP) || 3,
      multipleCardsPerAccount: parseInt(process.env.FRAUD_MAX_CARDS_PER_ACCOUNT) || 5,
      multipleDevicesPerAccount: parseInt(process.env.FRAUD_MAX_DEVICES_PER_ACCOUNT) || 5
    };
    
    // Risk scoring thresholds
    this.riskThresholds = {
      low: parseInt(process.env.FRAUD_RISK_THRESHOLD_LOW) || 30,
      medium: parseInt(process.env.FRAUD_RISK_THRESHOLD_MEDIUM) || 60,
      high: parseInt(process.env.FRAUD_RISK_THRESHOLD_HIGH) || 80
    };
    
    logger.info('Fraud detection service initialized');
  }

  /**
   * Check transaction velocity
   * @param {String} userId - User ID
   * @param {Number} amount - Transaction amount
   * @returns {Promise<Object>} - Velocity check result
   */
  async checkTransactionVelocity(userId, amount) {
    try {
      const now = Date.now();
      const minuteKey = `fraud:velocity:${userId}:minute`;
      const hourKey = `fraud:velocity:${userId}:hour`;
      const dayKey = `fraud:velocity:${userId}:day`;
      const dayAmountKey = `fraud:amount:${userId}:day`;
      
      // Get current counts
      const [minuteCount, hourCount, dayAmount] = await Promise.all([
        redisClient.get(minuteKey),
        redisClient.get(hourKey),
        redisClient.get(dayAmountKey)
      ]);
      
      // Check transaction amount
      if (amount > this.velocityThresholds.maxAmountPerTransaction) {
        return {
          passed: false,
          reason: 'Transaction amount exceeds maximum allowed',
          riskScore: 85
        };
      }
      
      // Check minute velocity
      if (minuteCount && parseInt(minuteCount) >= this.velocityThresholds.maxTransactionsPerMinute) {
        return {
          passed: false,
          reason: 'Too many transactions in a short period',
          riskScore: 90
        };
      }
      
      // Check hour velocity
      if (hourCount && parseInt(hourCount) >= this.velocityThresholds.maxTransactionsPerHour) {
        return {
          passed: false,
          reason: 'Too many transactions in the last hour',
          riskScore: 80
        };
      }
      
      // Check daily amount
      const newDayAmount = (dayAmount ? parseFloat(dayAmount) : 0) + amount;
      if (newDayAmount > this.velocityThresholds.maxAmountPerDay) {
        return {
          passed: false,
          reason: 'Daily transaction amount limit exceeded',
          riskScore: 75
        };
      }
      
      // Update counters
      await Promise.all([
        redisClient.incr(minuteKey),
        redisClient.expire(minuteKey, 60), // 1 minute
        redisClient.incr(hourKey),
        redisClient.expire(hourKey, 3600), // 1 hour
        redisClient.setEx(dayAmountKey, 86400, newDayAmount.toString()) // 1 day
      ]);
      
      return {
        passed: true,
        riskScore: 0
      };
    } catch (error) {
      logger.error(`Transaction velocity check error: ${error.message}`);
      return {
        passed: true, // Allow on error
        riskScore: 20,
        error: error.message
      };
    }
  }

  /**
   * Check for suspicious patterns
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Pattern check result
   */
  async checkSuspiciousPatterns(data) {
    try {
      const { userId, ip, deviceId, paymentMethod } = data;
      let riskScore = 0;
      const reasons = [];
      
      // Check for multiple failed attempts
      const failedAttemptsKey = `fraud:failed:${userId}`;
      const failedAttempts = await redisClient.get(failedAttemptsKey);
      
      if (failedAttempts && parseInt(failedAttempts) >= this.suspiciousPatterns.multipleFailedAttempts) {
        riskScore += 40;
        reasons.push('Multiple failed payment attempts');
      }
      
      // Check for multiple accounts per IP
      if (ip) {
        const ipAccountsKey = `fraud:ip:${ip}:accounts`;
        const ipAccounts = await redisClient.sMembers(ipAccountsKey);
        
        if (!ipAccounts.includes(userId)) {
          await redisClient.sAdd(ipAccountsKey, userId);
          await redisClient.expire(ipAccountsKey, 86400 * 30); // 30 days
        }
        
        if (ipAccounts.length >= this.suspiciousPatterns.multipleAccountsPerIp) {
          riskScore += 30;
          reasons.push('Multiple accounts from same IP');
        }
      }
      
      // Check for multiple payment methods per account
      if (paymentMethod) {
        const paymentMethodsKey = `fraud:user:${userId}:payment_methods`;
        const paymentMethods = await redisClient.sMembers(paymentMethodsKey);
        
        if (!paymentMethods.includes(paymentMethod)) {
          await redisClient.sAdd(paymentMethodsKey, paymentMethod);
          await redisClient.expire(paymentMethodsKey, 86400 * 90); // 90 days
        }
        
        if (paymentMethods.length >= this.suspiciousPatterns.multipleCardsPerAccount) {
          riskScore += 25;
          reasons.push('Multiple payment methods for same account');
        }
      }
      
      // Check for multiple devices per account
      if (deviceId) {
        const devicesKey = `fraud:user:${userId}:devices`;
        const devices = await redisClient.sMembers(devicesKey);
        
        if (!devices.includes(deviceId)) {
          await redisClient.sAdd(devicesKey, deviceId);
          await redisClient.expire(devicesKey, 86400 * 90); // 90 days
        }
        
        if (devices.length >= this.suspiciousPatterns.multipleDevicesPerAccount) {
          riskScore += 20;
          reasons.push('Multiple devices for same account');
        }
      }
      
      // Determine result based on risk score
      let riskLevel = 'low';
      if (riskScore >= this.riskThresholds.high) {
        riskLevel = 'high';
      } else if (riskScore >= this.riskThresholds.medium) {
        riskLevel = 'medium';
      }
      
      return {
        passed: riskScore < this.riskThresholds.high,
        riskScore,
        riskLevel,
        reasons
      };
    } catch (error) {
      logger.error(`Suspicious pattern check error: ${error.message}`);
      return {
        passed: true, // Allow on error
        riskScore: 10,
        riskLevel: 'low',
        error: error.message
      };
    }
  }

  /**
   * Detect anomalies in user behavior
   * @param {String} userId - User ID
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Anomaly detection result
   */
  async detectAnomalies(userId, data) {
    try {
      const { amount, currency, ip, deviceId, transactionType } = data;
      let riskScore = 0;
      const reasons = [];
      
      // Check for unusual transaction amount
      const userAvgAmountKey = `fraud:user:${userId}:avg_amount`;
      const userAvgAmount = await redisClient.get(userAvgAmountKey);
      
      if (userAvgAmount) {
        const avgAmount = parseFloat(userAvgAmount);
        const amountRatio = amount / avgAmount;
        
        // If transaction amount is 3x the average, flag it
        if (amountRatio > 3) {
          riskScore += 30;
          reasons.push('Unusually large transaction amount');
        }
        
        // Update average amount
        const newAvgAmount = (avgAmount * 0.7) + (amount * 0.3); // Weighted average
        await redisClient.setEx(userAvgAmountKey, 86400 * 90, newAvgAmount.toString());
      } else {
        // First transaction, set initial average
        await redisClient.setEx(userAvgAmountKey, 86400 * 90, amount.toString());
      }
      
      // Check for unusual location
      if (ip) {
        const userLocationsKey = `fraud:user:${userId}:locations`;
        const userLocations = await redisClient.sMembers(userLocationsKey);
        
        // For demo purposes, we're just checking if the IP is new
        // In a real implementation, you would check the geolocation distance
        if (!userLocations.includes(ip)) {
          await redisClient.sAdd(userLocationsKey, ip);
          await redisClient.expire(userLocationsKey, 86400 * 90); // 90 days
          
          if (userLocations.length > 0) {
            riskScore += 25;
            reasons.push('Transaction from new location');
          }
        }
      }
      
      // Check for unusual device
      if (deviceId) {
        const userDevicesKey = `fraud:user:${userId}:known_devices`;
        const userDevices = await redisClient.sMembers(userDevicesKey);
        
        if (!userDevices.includes(deviceId)) {
          await redisClient.sAdd(userDevicesKey, deviceId);
          await redisClient.expire(userDevicesKey, 86400 * 90); // 90 days
          
          if (userDevices.length > 0) {
            riskScore += 20;
            reasons.push('Transaction from new device');
          }
        }
      }
      
      // Check for unusual transaction type
      const userTransactionTypesKey = `fraud:user:${userId}:transaction_types`;
      const userTransactionTypes = await redisClient.sMembers(userTransactionTypesKey);
      
      if (transactionType && !userTransactionTypes.includes(transactionType)) {
        await redisClient.sAdd(userTransactionTypesKey, transactionType);
        await redisClient.expire(userTransactionTypesKey, 86400 * 90); // 90 days
        
        if (userTransactionTypes.length > 0) {
          riskScore += 15;
          reasons.push('Unusual transaction type');
        }
      }
      
      // Determine result based on risk score
      let riskLevel = 'low';
      if (riskScore >= this.riskThresholds.high) {
        riskLevel = 'high';
      } else if (riskScore >= this.riskThresholds.medium) {
        riskLevel = 'medium';
      }
      
      return {
        passed: riskScore < this.riskThresholds.high,
        riskScore,
        riskLevel,
        reasons
      };
    } catch (error) {
      logger.error(`Anomaly detection error: ${error.message}`);
      return {
        passed: true, // Allow on error
        riskScore: 10,
        riskLevel: 'low',
        error: error.message
      };
    }
  }

  /**
   * Record failed transaction attempt
   * @param {String} userId - User ID
   * @returns {Promise<void>}
   */
  async recordFailedAttempt(userId) {
    try {
      const failedAttemptsKey = `fraud:failed:${userId}`;
      await redisClient.incr(failedAttemptsKey);
      await redisClient.expire(failedAttemptsKey, 3600); // 1 hour
    } catch (error) {
      logger.error(`Record failed attempt error: ${error.message}`);
    }
  }

  /**
   * Reset failed attempts counter
   * @param {String} userId - User ID
   * @returns {Promise<void>}
   */
  async resetFailedAttempts(userId) {
    try {
      const failedAttemptsKey = `fraud:failed:${userId}`;
      await redisClient.del(failedAttemptsKey);
    } catch (error) {
      logger.error(`Reset failed attempts error: ${error.message}`);
    }
  }

  /**
   * Evaluate transaction risk
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} - Risk evaluation result
   */
  async evaluateTransactionRisk(data) {
    try {
      const { userId, amount, currency, ip, deviceId, transactionType, paymentMethod } = data;
      
      // Run all checks in parallel
      const [velocityResult, patternsResult, anomalyResult] = await Promise.all([
        this.checkTransactionVelocity(userId, amount),
        this.checkSuspiciousPatterns({ userId, ip, deviceId, paymentMethod }),
        this.detectAnomalies(userId, { amount, currency, ip, deviceId, transactionType })
      ]);
      
      // Combine risk scores and reasons
      const totalRiskScore = Math.min(
        100,
        velocityResult.riskScore + patternsResult.riskScore + anomalyResult.riskScore
      );
      
      const allReasons = [
        ...(velocityResult.reason ? [velocityResult.reason] : []),
        ...(patternsResult.reasons || []),
        ...(anomalyResult.reasons || [])
      ];
      
      // Determine overall risk level
      let riskLevel = 'low';
      if (totalRiskScore >= this.riskThresholds.high) {
        riskLevel = 'high';
      } else if (totalRiskScore >= this.riskThresholds.medium) {
        riskLevel = 'medium';
      }
      
      // Determine if transaction should be allowed
      const passed = velocityResult.passed && patternsResult.passed && anomalyResult.passed;
      
      // Log high-risk transactions
      if (riskLevel === 'high' || !passed) {
        logger.warn(`High-risk transaction detected: userId=${userId}, amount=${amount}, riskScore=${totalRiskScore}, reasons=${allReasons.join(', ')}`);
        
        // Store high-risk transaction for review
        const alertKey = `fraud:alert:${Date.now()}:${userId}`;
        await redisClient.hSet(alertKey, {
          userId,
          amount: amount.toString(),
          currency,
          ip: ip || 'unknown',
          deviceId: deviceId || 'unknown',
          transactionType: transactionType || 'unknown',
          riskScore: totalRiskScore.toString(),
          reasons: JSON.stringify(allReasons),
          timestamp: Date.now().toString()
        });
        await redisClient.expire(alertKey, 86400 * 30); // 30 days
      }
      
      return {
        passed,
        riskScore: totalRiskScore,
        riskLevel,
        reasons: allReasons,
        requiresReview: riskLevel === 'high' && passed,
        details: {
          velocity: velocityResult,
          patterns: patternsResult,
          anomaly: anomalyResult
        }
      };
    } catch (error) {
      logger.error(`Transaction risk evaluation error: ${error.message}`);
      return {
        passed: true, // Allow on error
        riskScore: 10,
        riskLevel: 'low',
        error: error.message
      };
    }
  }
}

// Create singleton instance
const fraudDetectionService = new FraudDetectionService();

module.exports = fraudDetectionService;