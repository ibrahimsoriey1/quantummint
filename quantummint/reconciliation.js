/**
 * Transaction Reconciliation for Payment Integration
 * Ensures consistency between our system and payment providers
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger.util');
const CashOutRequest = require('../models/cash-out-request.model');
const { publishEvent } = require('../utils/event.util');
const paymentService = require('./payment-integration.service');

/**
 * Reconciliation Service
 * Handles reconciliation of transactions with payment providers
 */
class ReconciliationService {
  /**
   * Initialize reconciliation service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.batchSize = options.batchSize || 100;
    this.maxAgeDays = options.maxAgeDays || 7;
    this.auditLogger = options.auditLogger;
  }
  
  /**
   * Reconcile pending cash out requests
   * @param {Object} options - Reconciliation options
   * @returns {Promise<Object>} Reconciliation results
   */
  async reconcilePendingCashOuts(options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const provider = options.provider;
      const maxAge = options.maxAgeDays || this.maxAgeDays;
      const batchSize = options.batchSize || this.batchSize;
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      // Build query
      const query = {
        status: { $in: ['pending', 'processing'] },
        createdAt: { $gte: cutoffDate }
      };
      
      if (provider) {
        query.provider = provider;
      }
      
      // Get pending cash outs
      const pendingCashOuts = await CashOutRequest.find(query)
        .limit(batchSize)
        .session(session);
      
      logger.info(`Found ${pendingCashOuts.length} pending cash outs to reconcile`);
      
      // Track results
      const results = {
        total: pendingCashOuts.length,
        processed: 0,
        updated: 0,
        failed: 0,
        unchanged: 0,
        details: []
      };
      
      // Process each cash out
      for (const cashOut of pendingCashOuts) {
        try {
          results.processed++;
          
          // Skip if no provider transaction ID
          if (!cashOut.providerTransactionId) {
            results.unchanged++;
            results.details.push({
              cashOutId: cashOut._id.toString(),
              result: 'skipped',
              reason: 'no_provider_transaction_id'
            });
            continue;
          }
          
          // Check status with provider
          const statusCheck = await this._checkProviderStatus(
            cashOut.provider,
            cashOut.providerTransactionId
          );
          
          // Update if status changed
          if (statusCheck.status !== cashOut.status) {
            const previousStatus = cashOut.status;
            cashOut.status = statusCheck.status;
            cashOut.providerResponse = statusCheck.providerResponse;
            
            if (statusCheck.status === 'completed') {
              cashOut.completedAt = new Date();
              
              // Publish cash out completed event
              await publishEvent('cash_out.completed', {
                cashOutId: cashOut._id.toString(),
                userId: cashOut.userId.toString(),
                walletId: cashOut.walletId.toString(),
                amount: cashOut.amount,
                currency: cashOut.currency,
                fee: cashOut.fee,
                provider: cashOut.provider,
                providerTransactionId: cashOut.providerTransactionId,
                reference: cashOut.reference
              });
            } else if (statusCheck.status === 'failed') {
              cashOut.failureReason = statusCheck.failureReason || 'Unknown error';
              
              // Publish cash out failed event
              await publishEvent('cash_out.failed', {
                cashOutId: cashOut._id.toString(),
                userId: cashOut.userId.toString(),
                walletId: cashOut.walletId.toString(),
                amount: cashOut.amount,
                currency: cashOut.currency,
                fee: cashOut.fee,
                provider: cashOut.provider,
                failureReason: cashOut.failureReason,
                reference: cashOut.reference
              });
            }
            
            await cashOut.save({ session });
            
            results.updated++;
            results.details.push({
              cashOutId: cashOut._id.toString(),
              result: 'updated',
              previousStatus,
              newStatus: statusCheck.status
            });
            
            logger.info(`Reconciliation: Updated cash out ${cashOut._id} status from ${previousStatus} to ${statusCheck.status}`);
            
            // Log reconciliation update
            if (this.auditLogger) {
              await this.auditLogger.log({
                action: 'payment.reconciliation.updated',
                resourceType: 'cash_out',
                resourceId: cashOut._id.toString(),
                description: `Reconciliation updated cash out status`,
                metadata: {
                  provider: cashOut.provider,
                  previousStatus,
                  newStatus: statusCheck.status,
                  providerTransactionId: cashOut.providerTransactionId
                },
                status: 'success',
                severity: 'medium'
              });
            }
          } else {
            results.unchanged++;
            results.details.push({
              cashOutId: cashOut._id.toString(),
              result: 'unchanged',
              status: cashOut.status
            });
          }
        } catch (error) {
          results.failed++;
          results.details.push({
            cashOutId: cashOut._id.toString(),
            result: 'failed',
            error: error.message
          });
          
          logger.error(`Reconciliation error for cash out ${cashOut._id}: ${error.message}`);
        }
      }
      
      await session.commitTransaction();
      
      logger.info(`Reconciliation completed: ${results.processed} processed, ${results.updated} updated, ${results.unchanged} unchanged, ${results.failed} failed`);
      
      // Log reconciliation completion
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'payment.reconciliation.completed',
          resourceType: 'cash_out',
          description: `Completed cash out reconciliation`,
          metadata: {
            provider: provider || 'all',
            total: results.total,
            processed: results.processed,
            updated: results.updated,
            unchanged: results.unchanged,
            failed: results.failed
          },
          status: 'success',
          severity: 'low'
        });
      }
      
      return results;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error(`Reconciliation process error: ${error.message}`);
      
      // Log reconciliation failure
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'payment.reconciliation.failed',
          resourceType: 'cash_out',
          description: `Failed to complete cash out reconciliation`,
          metadata: {
            provider: options.provider || 'all',
            error: error.message
          },
          status: 'failure',
          severity: 'high'
        });
      }
      
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Check provider status
   * @param {string} provider - Provider name
   * @param {string} transactionId - Provider transaction ID
   * @returns {Promise<Object>} Transaction status
   * @private
   */
  async _checkProviderStatus(provider, transactionId) {
    switch (provider) {
      case 'orange_money':
        return await this._checkOrangeMoneyStatus(transactionId);
      
      case 'afrimoney':
        return await this._checkAfriMoneyStatus(transactionId);
      
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }
  
  /**
   * Check Orange Money transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction status
   * @private
   */
  async _checkOrangeMoneyStatus(transactionId) {
    try {
      return await paymentService._checkOrangeMoneyStatus(transactionId);
    } catch (error) {
      logger.error(`Orange Money status check error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check AfriMoney transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction status
   * @private
   */
  async _checkAfriMoneyStatus(transactionId) {
    try {
      return await paymentService._checkAfriMoneyStatus(transactionId);
    } catch (error) {
      logger.error(`AfriMoney status check error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate reconciliation report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Reconciliation report
   */
  async generateReconciliationReport(options = {}) {
    try {
      const provider = options.provider;
      const startDate = options.startDate ? new Date(options.startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = options.endDate ? new Date(options.endDate) : new Date();
      
      // Build query
      const query = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (provider) {
        query.provider = provider;
      }
      
      // Get cash outs
      const cashOuts = await CashOutRequest.find(query);
      
      // Group by status
      const statusGroups = {};
      let totalAmount = 0;
      let totalFees = 0;
      
      for (const cashOut of cashOuts) {
        const status = cashOut.status;
        
        if (!statusGroups[status]) {
          statusGroups[status] = {
            count: 0,
            amount: 0,
            fees: 0
          };
        }
        
        statusGroups[status].count++;
        statusGroups[status].amount += cashOut.amount;
        statusGroups[status].fees += cashOut.fee;
        
        totalAmount += cashOut.amount;
        totalFees += cashOut.fee;
      }
      
      // Generate report
      const report = {
        period: {
          startDate,
          endDate
        },
        provider: provider || 'all',
        total: {
          count: cashOuts.length,
          amount: totalAmount,
          fees: totalFees
        },
        byStatus: statusGroups
      };
      
      logger.info(`Generated reconciliation report for ${provider || 'all'} providers from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      return report;
    } catch (error) {
      logger.error(`Error generating reconciliation report: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start reconciliation scheduler
   * @param {number} intervalMs - Interval in milliseconds
   * @returns {Object} Scheduler
   */
  startScheduler(intervalMs = 3600000) { // Default: 1 hour
    logger.info(`Starting reconciliation scheduler with interval ${intervalMs}ms`);
    
    const scheduler = setInterval(async () => {
      try {
        // Run reconciliation for each provider
        for (const provider of ['orange_money', 'afrimoney']) {
          try {
            await this.reconcilePendingCashOuts({ provider });
          } catch (error) {
            logger.error(`Scheduled reconciliation error for ${provider}: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Reconciliation scheduler error: ${error.message}`);
      }
    }, intervalMs);
    
    return scheduler;
  }
}

module.exports = ReconciliationService;