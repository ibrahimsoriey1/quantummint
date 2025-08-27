/**
 * Retry Mechanism for Payment Integration
 * Handles retries for failed payment requests
 */

const logger = require('../utils/logger.util');
const CashOutRequest = require('../models/cash-out-request.model');
const paymentService = require('./payment-integration.service');

/**
 * Retry Manager Service
 * Manages retries for failed payment requests
 */
class RetryManagerService {
  /**
   * Initialize retry manager service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelayMs = options.initialDelayMs || 30000; // 30 seconds
    this.maxDelayMs = options.maxDelayMs || 3600000; // 1 hour
    this.retryableErrors = options.retryableErrors || [
      'NETWORK_ERROR',
      'TIMEOUT',
      'PROVIDER_UNAVAILABLE',
      'TEMPORARY_FAILURE',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE'
    ];
    
    this.auditLogger = options.auditLogger;
  }
  
  /**
   * Schedule a retry for a failed cash out request
   * @param {Object} cashOutRequest - Cash out request
   * @param {Error} error - Error that occurred
   * @returns {Promise<boolean>} Whether retry was scheduled
   */
  async scheduleRetry(cashOutRequest, error) {
    try {
      // Check if we should retry
      if (!this._shouldRetry(cashOutRequest, error)) {
        logger.info(`Not scheduling retry for cash out ${cashOutRequest._id}: max retries reached or non-retryable error`);
        return false;
      }
      
      // Calculate delay based on retry count (exponential backoff)
      const retryCount = cashOutRequest.retryCount || 0;
      const delayMs = Math.min(
        this.initialDelayMs * Math.pow(2, retryCount),
        this.maxDelayMs
      );
      
      // Update cash out request
      cashOutRequest.retryCount = retryCount + 1;
      cashOutRequest.lastRetryAt = new Date();
      cashOutRequest.nextRetryAt = new Date(Date.now() + delayMs);
      cashOutRequest.status = 'processing';
      
      await cashOutRequest.save();
      
      logger.info(`Scheduled retry ${cashOutRequest.retryCount} for cash out ${cashOutRequest._id} in ${delayMs}ms`);
      
      // Log retry scheduling
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'payment.retry.scheduled',
          resourceType: 'cash_out',
          resourceId: cashOutRequest._id.toString(),
          description: `Scheduled retry ${cashOutRequest.retryCount} for cash out`,
          metadata: {
            provider: cashOutRequest.provider,
            retryCount: cashOutRequest.retryCount,
            delayMs,
            nextRetryAt: cashOutRequest.nextRetryAt,
            error: error.message
          },
          status: 'success',
          severity: 'medium'
        });
      }
      
      // Schedule retry
      setTimeout(async () => {
        await this._executeRetry(cashOutRequest._id);
      }, delayMs);
      
      return true;
    } catch (error) {
      logger.error(`Error scheduling retry for cash out ${cashOutRequest._id}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Execute a retry for a cash out request
   * @param {string} cashOutId - Cash out request ID
   * @returns {Promise<Object>} Retry result
   * @private
   */
  async _executeRetry(cashOutId) {
    try {
      // Get fresh copy of cash out request
      const cashOutRequest = await CashOutRequest.findById(cashOutId);
      
      if (!cashOutRequest) {
        logger.warn(`Cash out request ${cashOutId} not found for retry`);
        return { success: false, reason: 'not_found' };
      }
      
      // Check if still in processing status
      if (cashOutRequest.status !== 'processing') {
        logger.info(`Skipping retry for cash out ${cashOutId}: status is ${cashOutRequest.status}`);
        return { success: false, reason: 'invalid_status' };
      }
      
      logger.info(`Executing retry ${cashOutRequest.retryCount} for cash out ${cashOutId}`);
      
      // Log retry execution
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'payment.retry.executing',
          resourceType: 'cash_out',
          resourceId: cashOutId,
          description: `Executing retry ${cashOutRequest.retryCount} for cash out`,
          metadata: {
            provider: cashOutRequest.provider,
            retryCount: cashOutRequest.retryCount
          },
          status: 'success',
          severity: 'medium'
        });
      }
      
      // Process cash out again
      let result;
      try {
        // Determine which provider to use
        switch (cashOutRequest.provider) {
          case 'orange_money':
            result = await paymentService._processOrangeMoneyRequest(cashOutRequest);
            break;
          
          case 'afrimoney':
            result = await paymentService._processAfriMoneyRequest(cashOutRequest);
            break;
          
          default:
            throw new Error(`Unsupported payment provider: ${cashOutRequest.provider}`);
        }
        
        // Update cash out request with provider response
        cashOutRequest.providerTransactionId = result.providerTransactionId;
        cashOutRequest.status = result.status;
        cashOutRequest.providerResponse = result.providerResponse;
        
        if (result.status === 'completed') {
          cashOutRequest.completedAt = new Date();
        } else if (result.status === 'failed') {
          cashOutRequest.failureReason = result.failureReason || 'Unknown error';
        }
        
        await cashOutRequest.save();
        
        logger.info(`Retry successful for cash out ${cashOutId}: new status ${result.status}`);
        
        // Log retry success
        if (this.auditLogger) {
          await this.auditLogger.log({
            action: 'payment.retry.success',
            resourceType: 'cash_out',
            resourceId: cashOutId,
            description: `Retry ${cashOutRequest.retryCount} successful for cash out`,
            metadata: {
              provider: cashOutRequest.provider,
              retryCount: cashOutRequest.retryCount,
              newStatus: result.status
            },
            status: 'success',
            severity: 'medium'
          });
        }
        
        return { success: true, status: result.status };
      } catch (error) {
        logger.error(`Retry failed for cash out ${cashOutId}: ${error.message}`);
        
        // Check if we should schedule another retry
        const shouldRetry = await this.scheduleRetry(cashOutRequest, error);
        
        if (!shouldRetry) {
          // Mark as failed if we shouldn't retry
          cashOutRequest.status = 'failed';
          cashOutRequest.failureReason = error.message || 'Retry failed';
          await cashOutRequest.save();
          
          logger.warn(`Cash out ${cashOutId} marked as failed after ${cashOutRequest.retryCount} retries`);
          
          // Log retry failure
          if (this.auditLogger) {
            await this.auditLogger.log({
              action: 'payment.retry.failed',
              resourceType: 'cash_out',
              resourceId: cashOutId,
              description: `Retry ${cashOutRequest.retryCount} failed for cash out`,
              metadata: {
                provider: cashOutRequest.provider,
                retryCount: cashOutRequest.retryCount,
                error: error.message
              },
              status: 'failure',
              severity: 'high'
            });
          }
        }
        
        return { success: false, reason: 'error', error: error.message };
      }
    } catch (error) {
      logger.error(`Error executing retry for cash out ${cashOutId}: ${error.message}`);
      return { success: false, reason: 'system_error', error: error.message };
    }
  }
  
  /**
   * Check if we should retry the cash out request
   * @param {Object} cashOutRequest - Cash out request
   * @param {Error} error - Error that occurred
   * @returns {boolean} Whether to retry
   * @private
   */
  _shouldRetry(cashOutRequest, error) {
    // Don't retry if max retries reached
    if ((cashOutRequest.retryCount || 0) >= this.maxRetries) {
      return false;
    }
    
    // Don't retry if already completed or cancelled
    if (['completed', 'cancelled'].includes(cashOutRequest.status)) {
      return false;
    }
    
    // Check if error is retryable
    if (error.code && !this.retryableErrors.includes(error.code)) {
      return false;
    }
    
    // Don't retry certain errors
    if (error.message && (
      error.message.includes('Invalid account') || 
      error.message.includes('Insufficient funds') ||
      error.message.includes('Account not found') ||
      error.message.includes('Invalid amount') ||
      error.message.includes('Validation failed')
    )) {
      return false;
    }
    
    // Retry network errors, timeouts, and temporary provider issues
    return true;
  }
  
  /**
   * Process pending retries
   * @returns {Promise<Object>} Processing result
   */
  async processPendingRetries() {
    try {
      const now = new Date();
      
      // Find cash out requests that need retry
      const pendingRetries = await CashOutRequest.find({
        status: 'processing',
        nextRetryAt: { $lte: now },
        retryCount: { $gt: 0, $lte: this.maxRetries }
      });
      
      logger.info(`Found ${pendingRetries.length} pending retries to process`);
      
      // Process each retry
      const results = {
        total: pendingRetries.length,
        processed: 0,
        succeeded: 0,
        failed: 0
      };
      
      for (const cashOutRequest of pendingRetries) {
        try {
          const result = await this._executeRetry(cashOutRequest._id);
          results.processed++;
          
          if (result.success) {
            results.succeeded++;
          } else {
            results.failed++;
          }
        } catch (error) {
          logger.error(`Error processing retry for cash out ${cashOutRequest._id}: ${error.message}`);
          results.failed++;
        }
      }
      
      logger.info(`Processed ${results.processed} pending retries: ${results.succeeded} succeeded, ${results.failed} failed`);
      
      return results;
    } catch (error) {
      logger.error(`Error processing pending retries: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start retry processing scheduler
   * @param {number} intervalMs - Interval in milliseconds
   * @returns {Object} Scheduler
   */
  startScheduler(intervalMs = 60000) {
    logger.info(`Starting retry scheduler with interval ${intervalMs}ms`);
    
    const scheduler = setInterval(async () => {
      try {
        await this.processPendingRetries();
      } catch (error) {
        logger.error(`Scheduler error: ${error.message}`);
      }
    }, intervalMs);
    
    return scheduler;
  }
}

module.exports = RetryManagerService;