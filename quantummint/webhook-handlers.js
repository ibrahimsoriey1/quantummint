/**
 * Webhook Handlers for QuantumMint Payment Integration
 * Handles callbacks from payment providers (Orange Money and AfriMoney)
 */

const crypto = require('crypto');
const logger = require('../utils/logger.util');
const CashOutRequest = require('../models/cash-out-request.model');
const { publishEvent } = require('../utils/event.util');
const { PaymentError } = require('../utils/errors.util');

/**
 * Webhook Handler Service
 * Processes webhooks from payment providers
 */
class WebhookHandlerService {
  /**
   * Initialize webhook handler service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.config = {
      orangeMoney: {
        webhookSecret: options.orangeMoneyWebhookSecret || process.env.ORANGE_MONEY_WEBHOOK_SECRET,
        signatureHeader: 'x-orange-signature'
      },
      afriMoney: {
        webhookSecret: options.afriMoneyWebhookSecret || process.env.AFRIMONEY_WEBHOOK_SECRET,
        signatureHeader: 'x-afrimoney-signature'
      }
    };
    
    this.logger = options.logger || logger;
    this.publishEvent = options.publishEvent || publishEvent;
  }

  /**
   * Handle Orange Money webhook
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @returns {Promise<void>}
   */
  async handleOrangeMoneyWebhook(req, res) {
    try {
      // Verify webhook signature
      this.verifySignature(
        req.body,
        req.headers[this.config.orangeMoney.signatureHeader],
        this.config.orangeMoney.webhookSecret
      );
      
      // Log webhook receipt
      this.logger.info('QuantumMint Orange Money Webhook Received', {
        eventType: req.body.eventType,
        transactionId: req.body.transactionId
      });
      
      // Process based on event type
      switch (req.body.eventType) {
        case 'payment.success':
          await this.processSuccessfulPayment('orange_money', req.body);
          break;
        case 'payment.failed':
          await this.processFailedPayment('orange_money', req.body);
          break;
        case 'payment.pending':
          await this.processPendingPayment('orange_money', req.body);
          break;
        default:
          this.logger.warn('QuantumMint Unknown Orange Money Event Type', {
            eventType: req.body.eventType
          });
      }
      
      // Acknowledge receipt
      res.status(200).json({ status: 'success' });
    } catch (error) {
      this.logger.error('QuantumMint Orange Money Webhook Error', {
        error: error.message,
        body: req.body
      });
      
      // Always return 200 to prevent retries, even on error
      // Internal processing will handle the error
      res.status(200).json({ status: 'received' });
      
      // Publish error event for monitoring
      this.publishEvent('webhook.error', {
        provider: 'orange_money',
        error: error.message,
        body: req.body
      });
    }
  }

  /**
   * Handle AfriMoney webhook
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @returns {Promise<void>}
   */
  async handleAfriMoneyWebhook(req, res) {
    try {
      // Verify webhook signature
      this.verifySignature(
        req.body,
        req.headers[this.config.afriMoney.signatureHeader],
        this.config.afriMoney.webhookSecret
      );
      
      // Log webhook receipt
      this.logger.info('QuantumMint AfriMoney Webhook Received', {
        eventType: req.body.event,
        referenceId: req.body.referenceId
      });
      
      // Process based on event type
      switch (req.body.event) {
        case 'transaction.completed':
          await this.processSuccessfulPayment('afrimoney', req.body);
          break;
        case 'transaction.failed':
          await this.processFailedPayment('afrimoney', req.body);
          break;
        case 'transaction.pending':
          await this.processPendingPayment('afrimoney', req.body);
          break;
        default:
          this.logger.warn('QuantumMint Unknown AfriMoney Event Type', {
            eventType: req.body.event
          });
      }
      
      // Acknowledge receipt
      res.status(200).json({ status: 'success' });
    } catch (error) {
      this.logger.error('QuantumMint AfriMoney Webhook Error', {
        error: error.message,
        body: req.body
      });
      
      // Always return 200 to prevent retries, even on error
      // Internal processing will handle the error
      res.status(200).json({ status: 'received' });
      
      // Publish error event for monitoring
      this.publishEvent('webhook.error', {
        provider: 'afrimoney',
        error: error.message,
        body: req.body
      });
    }
  }

  /**
   * Process successful payment
   * @param {String} provider - Payment provider name
   * @param {Object} data - Webhook data
   * @returns {Promise<void>}
   */
  async processSuccessfulPayment(provider, data) {
    try {
      // Extract reference ID based on provider
      const referenceId = provider === 'orange_money' ? 
        data.transactionId : 
        data.referenceId;
      
      // Find the cash out request
      const cashOutRequest = await CashOutRequest.findOne({
        providerReference: referenceId
      });
      
      if (!cashOutRequest) {
        throw new PaymentError(`Cash out request not found for reference: ${referenceId}`);
      }
      
      // Get user's country and apply appropriate currency conversion
      const userProfile = await this.db.collection('userProfiles').findOne({ 
        userId: cashOutRequest.userId 
      });
      
      // Determine country code and currency
      const countryCode = userProfile?.country || 'SL'; // Default to Sierra Leone if not specified
      const currencyMap = {
        'SL': 'SLL', // Sierra Leone - Leone
        'GH': 'GHS', // Ghana - Cedi
        'NG': 'NGN', // Nigeria - Naira
        'KE': 'KES'  // Kenya - Shilling
      };
      
      // Get exchange rates (in a real implementation, this would call an exchange rate API)
      const exchangeRates = {
        'SLL': 13.5,  // Example rate: 1 USD = 13.5 SLL
        'GHS': 12.2,  // Example rate: 1 USD = 12.2 GHS
        'NGN': 1500,  // Example rate: 1 USD = 1500 NGN
        'KES': 130.5  // Example rate: 1 USD = 130.5 KES
      };
      
      // Apply currency conversion
      const currency = currencyMap[countryCode] || 'SLL';
      const exchangeRate = exchangeRates[currency] || 1;
      const localAmount = cashOutRequest.amount * exchangeRate;
      
      // Update cash out request status with currency information
      cashOutRequest.status = 'completed';
      cashOutRequest.providerResponse = data;
      cashOutRequest.completedAt = new Date();
      cashOutRequest.localCurrency = currency;
      cashOutRequest.originalCurrency = cashOutRequest.currency || 'USD';
      cashOutRequest.exchangeRate = exchangeRate;
      cashOutRequest.localAmount = localAmount;
      await cashOutRequest.save();
      
      // Publish event
      this.publishEvent('cash_out.completed', {
        cashOutRequestId: cashOutRequest._id,
        userId: cashOutRequest.userId,
        walletId: cashOutRequest.walletId,
        amount: cashOutRequest.amount,
        originalCurrency: cashOutRequest.originalCurrency || 'USD',
        localCurrency: cashOutRequest.localCurrency,
        localAmount: cashOutRequest.localAmount,
        exchangeRate: cashOutRequest.exchangeRate,
        provider,
        referenceId
      });
      
      this.logger.info('QuantumMint Cash Out Completed', {
        cashOutRequestId: cashOutRequest._id,
        provider,
        referenceId
      });
    } catch (error) {
      this.logger.error('QuantumMint Process Successful Payment Error', {
        error: error.message,
        provider,
        data
      });
      
      // Re-throw error for handling
      throw error;
    }
  }

  /**
   * Process failed payment
   * @param {String} provider - Payment provider name
   * @param {Object} data - Webhook data
   * @returns {Promise<void>}
   */
  async processFailedPayment(provider, data) {
    try {
      // Extract reference ID based on provider
      const referenceId = provider === 'orange_money' ? 
        data.transactionId : 
        data.referenceId;
      
      // Find the cash out request
      const cashOutRequest = await CashOutRequest.findOne({
        providerReference: referenceId
      });
      
      if (!cashOutRequest) {
        throw new PaymentError(`Cash out request not found for reference: ${referenceId}`);
      }
      
      // Update cash out request status
      cashOutRequest.status = 'failed';
      cashOutRequest.providerResponse = data;
      cashOutRequest.failureReason = data.reason || 'Unknown error';
      cashOutRequest.updatedAt = new Date();
      await cashOutRequest.save();
      
      // Publish event
      this.publishEvent('cash_out.failed', {
        cashOutRequestId: cashOutRequest._id,
        userId: cashOutRequest.userId,
        walletId: cashOutRequest.walletId,
        amount: cashOutRequest.amount,
        provider,
        referenceId,
        reason: cashOutRequest.failureReason
      });
      
      this.logger.warn('QuantumMint Cash Out Failed', {
        cashOutRequestId: cashOutRequest._id,
        provider,
        referenceId,
        reason: cashOutRequest.failureReason
      });
    } catch (error) {
      this.logger.error('QuantumMint Process Failed Payment Error', {
        error: error.message,
        provider,
        data
      });
      
      // Re-throw error for handling
      throw error;
    }
  }

  /**
   * Process pending payment
   * @param {String} provider - Payment provider name
   * @param {Object} data - Webhook data
   * @returns {Promise<void>}
   */
  async processPendingPayment(provider, data) {
    try {
      // Extract reference ID based on provider
      const referenceId = provider === 'orange_money' ? 
        data.transactionId : 
        data.referenceId;
      
      // Find the cash out request
      const cashOutRequest = await CashOutRequest.findOne({
        providerReference: referenceId
      });
      
      if (!cashOutRequest) {
        throw new PaymentError(`Cash out request not found for reference: ${referenceId}`);
      }
      
      // Update cash out request status if not already completed or failed
      if (cashOutRequest.status !== 'completed' && cashOutRequest.status !== 'failed') {
        cashOutRequest.status = 'pending';
        cashOutRequest.providerResponse = data;
        cashOutRequest.updatedAt = new Date();
        await cashOutRequest.save();
        
        // Publish event
        this.publishEvent('cash_out.pending', {
          cashOutRequestId: cashOutRequest._id,
          userId: cashOutRequest.userId,
          walletId: cashOutRequest.walletId,
          amount: cashOutRequest.amount,
          provider,
          referenceId
        });
        
        this.logger.info('QuantumMint Cash Out Pending', {
          cashOutRequestId: cashOutRequest._id,
          provider,
          referenceId
        });
      }
    } catch (error) {
      this.logger.error('QuantumMint Process Pending Payment Error', {
        error: error.message,
        provider,
        data
      });
      
      // Re-throw error for handling
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @param {String} secret - Webhook secret
   * @returns {Boolean} True if signature is valid
   * @throws {Error} If signature is invalid
   */
  verifySignature(payload, signature, secret) {
    if (!signature) {
      throw new Error('Missing signature header');
    }
    
    if (!secret) {
      throw new Error('Missing webhook secret');
    }
    
    const payloadString = typeof payload === 'string' ? 
      payload : 
      JSON.stringify(payload);
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }
    
    return true;
  }
}

module.exports = WebhookHandlerService;