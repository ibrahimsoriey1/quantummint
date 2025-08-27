/**
 * Payment Integration Module for Digital Money Generation System
 * Main entry point for payment integration functionality
 */

const PaymentIntegrationService = require('./payment-integration.service');
const WebhookHandlerService = require('./webhook-handlers');
const RetryManagerService = require('./retry-mechanism');
const ReconciliationService = require('./reconciliation');
const { AuditLoggerService } = require('../security/audit-logger');
const logger = require('../utils/logger.util');

/**
 * Initialize payment integration module
 * @param {Object} options - Configuration options
 * @returns {Object} Payment integration module
 */
function initializePaymentIntegration(options = {}) {
  logger.info('Initializing payment integration module');
  
  // Create audit logger
  const auditLogger = new AuditLoggerService({
    enabled: true,
    logToConsole: true,
    logToDB: true
  });
  
  // Create services
  const paymentService = PaymentIntegrationService;
  
  const webhookHandler = new WebhookHandlerService({
    auditLogger
  });
  
  const retryManager = new RetryManagerService({
    maxRetries: options.maxRetries || 3,
    initialDelayMs: options.initialDelayMs || 30000,
    maxDelayMs: options.maxDelayMs || 3600000,
    auditLogger
  });
  
  const reconciliationService = new ReconciliationService({
    batchSize: options.reconciliationBatchSize || 100,
    maxAgeDays: options.reconciliationMaxAgeDays || 7,
    auditLogger
  });
  
  // Start schedulers if enabled
  let retryScheduler = null;
  let reconciliationScheduler = null;
  
  if (options.enableSchedulers !== false) {
    retryScheduler = retryManager.startScheduler(
      options.retryIntervalMs || 60000
    );
    
    reconciliationScheduler = reconciliationService.startScheduler(
      options.reconciliationIntervalMs || 3600000
    );
    
    logger.info('Payment integration schedulers started');
  }
  
  // Register event handlers
  if (options.eventEmitter) {
    options.eventEmitter.on('cash_out.initiated', async (data) => {
      logger.info(`Cash out initiated event received: ${data.cashOutId}`);
      // Additional handling if needed
    });
    
    options.eventEmitter.on('cash_out.completed', async (data) => {
      logger.info(`Cash out completed event received: ${data.cashOutId}`);
      // Additional handling if needed
    });
    
    options.eventEmitter.on('cash_out.failed', async (data) => {
      logger.info(`Cash out failed event received: ${data.cashOutId}`);
      // Additional handling if needed
    });
    
    logger.info('Payment integration event handlers registered');
  }
  
  // Return module interface
  return {
    // Core payment services
    paymentService,
    webhookHandler,
    retryManager,
    reconciliationService,
    
    // Schedulers
    retryScheduler,
    reconciliationScheduler,
    
    // Shutdown function
    shutdown: async () => {
      logger.info('Shutting down payment integration module');
      
      // Clear schedulers
      if (retryScheduler) {
        clearInterval(retryScheduler);
      }
      
      if (reconciliationScheduler) {
        clearInterval(reconciliationScheduler);
      }
      
      logger.info('Payment integration module shut down successfully');
    },
    
    // Process a cash out request
    processCashOut: async (cashOutData) => {
      try {
        const result = await paymentService.processCashOut(cashOutData);
        return result;
      } catch (error) {
        logger.error(`Cash out processing error: ${error.message}`);
        
        // Check if we should retry
        if (cashOutData.cashOutRequest) {
          await retryManager.scheduleRetry(cashOutData.cashOutRequest, error);
        }
        
        throw error;
      }
    },
    
    // Handle a webhook
    handleWebhook: async (provider, payload, headers) => {
      return await webhookHandler.processWebhook(provider, payload, headers);
    },
    
    // Run reconciliation
    reconcilePendingCashOuts: async (options = {}) => {
      return await reconciliationService.reconcilePendingCashOuts(options);
    },
    
    // Generate reconciliation report
    generateReconciliationReport: async (options = {}) => {
      return await reconciliationService.generateReconciliationReport(options);
    }
  };
}

module.exports = {
  initializePaymentIntegration
};