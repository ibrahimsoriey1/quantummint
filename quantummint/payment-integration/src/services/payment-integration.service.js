const axios = require('axios');
const crypto = require('crypto');
const { redisClient } = require('../config/redis.config');
const logger = require('../utils/logger.util');
const { PaymentError } = require('../utils/errors.util');
const { publishEvent } = require('../utils/event.util');
const CashOutRequest = require('../models/cash-out-request.model');

/**
 * Payment Integration Service
 * Handles integration with payment providers like Orange Money, AfriMoney, and Stripe
 */
class PaymentIntegrationService {
  /**
   * Initialize provider configurations
   */
  constructor() {
    this.providers = {
      orange_money: {
        name: 'Orange Money',
        baseUrl: process.env.ORANGE_MONEY_API_URL,
        clientId: process.env.ORANGE_MONEY_CLIENT_ID,
        clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET,
        tokenUrl: process.env.ORANGE_MONEY_TOKEN_URL,
        webhookSecret: process.env.ORANGE_MONEY_WEBHOOK_SECRET,
        supportedCountries: ['Cameroon', 'Côte d\'Ivoire', 'Mali', 'Senegal', 'Guinea', 'Madagascar', 'DRC']
      },
      afrimoney: {
        name: 'AfriMoney',
        baseUrl: process.env.AFRIMONEY_API_URL,
        apiKey: process.env.AFRIMONEY_API_KEY,
        apiSecret: process.env.AFRIMONEY_API_SECRET,
        webhookSecret: process.env.AFRIMONEY_WEBHOOK_SECRET,
        supportedCountries: ['Sierra Leone', 'DRC', 'Uganda', 'The Gambia']
      },
      stripe: {
        name: 'Stripe',
        apiKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        supportedCountries: ['United States', 'Canada', 'UK', 'Australia', 'European Union', 'and many more']
      }
    };
  }
  
  /**
   * Get available payment providers
   * @returns {Promise<Array>} Available providers
   */
  async getAvailableProviders() {
    try {
      const providers = Object.keys(this.providers).map(key => ({
        id: key,
        name: this.providers[key].name,
        supportedCountries: this.providers[key].supportedCountries,
        limits: this._getProviderLimits(key)
      }));
      
      return providers;
    } catch (error) {
      logger.error(`Get available providers error: ${error.message}`);
      throw new PaymentError('Failed to get available providers', 'PROVIDER_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Process cash out request
   * @param {Object} cashOutData - Cash out request data
   * @returns {Promise<Object>} Cash out result
   */
  async processCashOut(cashOutData) {
    try {
      const {
        userId,
        walletId,
        amount,
        currency,
        provider,
        providerAccountId,
        providerAccountName,
        reference = this._generateReference()
      } = cashOutData;
      
      // Validate provider
      if (!this.providers[provider]) {
        throw new PaymentError('Invalid payment provider', 'INVALID_PROVIDER');
      }
      
      // Validate amount
      if (!amount || amount <= 0) {
        throw new PaymentError('Invalid amount', 'INVALID_AMOUNT');
      }
      
      // Calculate fee
      const fee = this._calculateFee(provider, amount);
      
      // Create cash out request record
      const cashOutRequest = new CashOutRequest({
        userId,
        walletId,
        amount,
        currency,
        fee,
        provider,
        providerAccountId,
        providerAccountName,
        reference,
        status: 'pending'
      });
      
      await cashOutRequest.save();
      
      // Publish cash out initiated event
      await publishEvent('cash_out.initiated', {
        cashOutId: cashOutRequest._id.toString(),
        userId,
        walletId,
        amount,
        currency,
        fee,
        provider,
        providerAccountId,
        reference
      });
      
      // Process cash out with provider
      let providerResponse;
      
      switch (provider) {
        case 'orange_money':
          providerResponse = await this._processOrangeMoneyRequest(cashOutRequest);
          break;
        
        case 'afrimoney':
          providerResponse = await this._processAfriMoneyRequest(cashOutRequest);
          break;
          
        case 'stripe':
          providerResponse = await this._processStripeRequest(cashOutRequest);
          break;
        
        default:
          throw new PaymentError('Unsupported payment provider', 'UNSUPPORTED_PROVIDER');
      }
      
      // Update cash out request with provider response
      cashOutRequest.providerTransactionId = providerResponse.providerTransactionId;
      cashOutRequest.status = providerResponse.status;
      cashOutRequest.providerResponse = providerResponse.providerResponse;
      
      if (providerResponse.status === 'completed') {
        cashOutRequest.completedAt = new Date();
      }
      
      await cashOutRequest.save();
      
      // Publish appropriate event based on status
      if (providerResponse.status === 'completed') {
        await publishEvent('cash_out.completed', {
          cashOutId: cashOutRequest._id.toString(),
          userId,
          walletId,
          amount,
          currency,
          fee,
          provider,
          providerTransactionId: providerResponse.providerTransactionId,
          reference
        });
      } else if (providerResponse.status === 'failed') {
        await publishEvent('cash_out.failed', {
          cashOutId: cashOutRequest._id.toString(),
          userId,
          walletId,
          amount,
          currency,
          fee,
          provider,
          failureReason: providerResponse.failureReason || 'Unknown error',
          reference
        });
      }
      
      logger.info(`Cash out request processed: ${cashOutRequest._id} (${provider})`);
      
      return {
        cashOutId: cashOutRequest._id.toString(),
        reference,
        status: cashOutRequest.status,
        amount,
        fee,
        totalAmount: amount + fee,
        currency,
        provider,
        providerTransactionId: providerResponse.providerTransactionId,
        createdAt: cashOutRequest.createdAt
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      
      logger.error(`Cash out processing error: ${error.message}`);
      throw new PaymentError('Failed to process cash out request', 'PROCESSING_FAILED');
    }
  }
  
  /**
   * Get cash out status
   * @param {string} cashOutId - Cash out request ID
   * @returns {Promise<Object>} Cash out status
   */
  async getCashOutStatus(cashOutId) {
    try {
      const cashOutRequest = await CashOutRequest.findById(cashOutId);
      
      if (!cashOutRequest) {
        throw new PaymentError('Cash out request not found', 'NOT_FOUND');
      }
      
      // If status is pending or processing, check with provider
      if (['pending', 'processing'].includes(cashOutRequest.status) && cashOutRequest.providerTransactionId) {
        try {
          const providerStatus = await this._checkProviderStatus(
            cashOutRequest.provider,
            cashOutRequest.providerTransactionId
          );
          
          // Update status if changed
          if (providerStatus.status !== cashOutRequest.status) {
            cashOutRequest.status = providerStatus.status;
            cashOutRequest.providerResponse = providerStatus.providerResponse;
            
            if (providerStatus.status === 'completed') {
              cashOutRequest.completedAt = new Date();
              
              // Publish cash out completed event
              await publishEvent('cash_out.completed', {
                cashOutId: cashOutRequest._id.toString(),
                userId: cashOutRequest.userId,
                walletId: cashOutRequest.walletId,
                amount: cashOutRequest.amount,
                currency: cashOutRequest.currency,
                fee: cashOutRequest.fee,
                provider: cashOutRequest.provider,
                providerTransactionId: cashOutRequest.providerTransactionId,
                reference: cashOutRequest.reference
              });
            } else if (providerStatus.status === 'failed') {
              cashOutRequest.failureReason = providerStatus.failureReason || 'Unknown error';
              
              // Publish cash out failed event
              await publishEvent('cash_out.failed', {
                cashOutId: cashOutRequest._id.toString(),
                userId: cashOutRequest.userId,
                walletId: cashOutRequest.walletId,
                amount: cashOutRequest.amount,
                currency: cashOutRequest.currency,
                fee: cashOutRequest.fee,
                provider: cashOutRequest.provider,
                failureReason: cashOutRequest.failureReason,
                reference: cashOutRequest.reference
              });
            }
            
            await cashOutRequest.save();
          }
        } catch (error) {
          logger.error(`Provider status check error: ${error.message}`);
          // Continue with current status if provider check fails
        }
      }
      
      return {
        cashOutId: cashOutRequest._id.toString(),
        userId: cashOutRequest.userId.toString(),
        walletId: cashOutRequest.walletId.toString(),
        amount: cashOutRequest.amount,
        currency: cashOutRequest.currency,
        fee: cashOutRequest.fee,
        totalAmount: cashOutRequest.amount + cashOutRequest.fee,
        provider: cashOutRequest.provider,
        providerAccountId: cashOutRequest.providerAccountId,
        providerAccountName: cashOutRequest.providerAccountName,
        providerTransactionId: cashOutRequest.providerTransactionId,
        reference: cashOutRequest.reference,
        status: cashOutRequest.status,
        failureReason: cashOutRequest.failureReason,
        createdAt: cashOutRequest.createdAt,
        updatedAt: cashOutRequest.updatedAt,
        completedAt: cashOutRequest.completedAt
      };
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      
      logger.error(`Get cash out status error: ${error.message}`);
      throw new PaymentError('Failed to get cash out status', 'STATUS_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Get cash out history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Object>} Cash out history with pagination
   */
  async getCashOutHistory(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        provider,
        startDate,
        endDate,
        walletId
      } = options;
      
      const query = { userId };
      
      if (status) {
        query.status = status;
      }
      
      if (provider) {
        query.provider = provider;
      }
      
      if (walletId) {
        query.walletId = walletId;
      }
      
      if (startDate || endDate) {
        query.createdAt = {};
        
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }
      
      const skip = (page - 1) * limit;
      
      const [cashOuts, total] = await Promise.all([
        CashOutRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        CashOutRequest.countDocuments(query)
      ]);
      
      const formattedCashOuts = cashOuts.map(cashOut => ({
        cashOutId: cashOut._id.toString(),
        walletId: cashOut.walletId.toString(),
        amount: cashOut.amount,
        fee: cashOut.fee,
        currency: cashOut.currency,
        provider: cashOut.provider,
        providerAccountId: cashOut.providerAccountId,
        status: cashOut.status,
        reference: cashOut.reference,
        createdAt: cashOut.createdAt,
        completedAt: cashOut.completedAt
      }));
      
      return {
        cashOuts: formattedCashOuts,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      logger.error(`Get cash out history error: ${error.message}`);
      throw new PaymentError('Failed to get cash out history', 'HISTORY_RETRIEVAL_FAILED');
    }
  }
  
  /**
   * Handle webhook from payment provider
   * @param {string} provider - Provider name
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Webhook headers
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(provider, payload, headers) {
    try {
      // Validate provider
      if (!this.providers[provider]) {
        throw new PaymentError('Invalid payment provider', 'INVALID_PROVIDER');
      }
      
      // Process webhook based on provider
      switch (provider) {
        case 'orange_money':
          return await this._processOrangeMoneyWebhook(payload);
        
        case 'afrimoney':
          return await this._processAfriMoneyWebhook(payload);
          
        case 'stripe':
          return await this._processStripeWebhook(payload);
        
        default:
          throw new PaymentError('Unsupported payment provider', 'UNSUPPORTED_PROVIDER');
      }
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }
      
      logger.error(`Webhook processing error: ${error.message}`);
      throw new PaymentError('Failed to process webhook', 'WEBHOOK_PROCESSING_FAILED');
    }
  }
  
  /**
   * Process Orange Money cash out request
   * @param {Object} cashOutRequest - Cash out request
   * @returns {Promise<Object>} Provider response
   * @private
   */
  async _processOrangeMoneyRequest(cashOutRequest) {
    try {
      // Get access token
      const token = await this._getOrangeMoneyToken();
      
      // Prepare request payload
      const payload = {
        amount: {
          value: cashOutRequest.amount,
          currency: cashOutRequest.currency
        },
        payee: {
          partyIdType: 'MSISDN',
          partyId: cashOutRequest.providerAccountId
        },
        payerMessage: `Cash out to ${cashOutRequest.providerAccountName}`,
        payeeNote: 'QuantumMint cash out',
        externalId: cashOutRequest.reference
      };
      
      // Make API request
      const response = await axios.post(
        `${this.providers.orange_money.baseUrl}/v1/cash-out`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Reference-Id': cashOutRequest.reference
          }
        }
      );
      
      if (response.status !== 202) {
        logger.error(`Orange Money cash out failed: ${JSON.stringify(response.data)}`);
        throw new PaymentError('Cash out request failed', 'PROVIDER_REQUEST_FAILED');
      }
      
      // Map status
      const status = this._mapOrangeMoneyStatus(response.data.status || 'PENDING');
      
      return {
        providerTransactionId: response.data.transactionId || cashOutRequest.reference,
        status,
        providerResponse: response.data,
        failureReason: status === 'failed' ? response.data.reason || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`Orange Money request error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to process Orange Money request', 'PROVIDER_REQUEST_FAILED');
    }
  }
  
  /**
   * Process AfriMoney cash out request
   * @param {Object} cashOutRequest - Cash out request
   * @returns {Promise<Object>} Provider response
   * @private
   */
  async _processAfriMoneyRequest(cashOutRequest) {
    try {
      // Generate signature
      const timestamp = Date.now().toString();
      const signature = this._generateAfriMoneySignature(
        this.providers.afrimoney.apiKey,
        this.providers.afrimoney.apiSecret,
        timestamp,
        cashOutRequest.reference
      );
      
      // Prepare request payload
      const payload = {
        amount: cashOutRequest.amount,
        currency: cashOutRequest.currency,
        recipient: {
          phoneNumber: cashOutRequest.providerAccountId,
          name: cashOutRequest.providerAccountName
        },
        externalReference: cashOutRequest.reference,
        description: 'QuantumMint cash out'
      };
      
      // Make API request
      const response = await axios.post(
        `${this.providers.afrimoney.baseUrl}/api/v1/disbursements`,
        payload,
        {
          headers: {
            'X-API-Key': this.providers.afrimoney.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status !== 200 || response.data.status !== 'success') {
        logger.error(`AfriMoney cash out failed: ${JSON.stringify(response.data)}`);
        throw new PaymentError('Cash out request failed', 'PROVIDER_REQUEST_FAILED');
      }
      
      // Map status
      const status = this._mapAfriMoneyStatus(response.data.data.status);
      
      return {
        providerTransactionId: response.data.data.transactionId,
        status,
        providerResponse: response.data.data,
        failureReason: status === 'failed' ? response.data.data.failureReason || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`AfriMoney request error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to process AfriMoney request', 'PROVIDER_REQUEST_FAILED');
    }
  }
  
  /**
   * Process Stripe cash out request
   * @param {Object} cashOutRequest - Cash out request
   * @returns {Promise<Object>} Provider response
   * @private
   */
  async _processStripeRequest(cashOutRequest) {
    try {
      const stripe = require('stripe')(this.providers.stripe.apiKey);
      
      // Create a transfer to the connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(cashOutRequest.amount * 100), // Convert to cents
        currency: cashOutRequest.currency.toLowerCase(),
        destination: cashOutRequest.providerAccountId,
        transfer_group: cashOutRequest.reference,
        metadata: {
          reference: cashOutRequest.reference,
          cashOutId: cashOutRequest._id.toString(),
          userId: cashOutRequest.userId.toString()
        }
      });
      
      // Map status
      const status = this._mapStripeStatus(transfer.status);
      
      return {
        providerTransactionId: transfer.id,
        status,
        providerResponse: transfer,
        failureReason: status === 'failed' ? transfer.failure_message || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`Stripe request error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to process Stripe request', 'PROVIDER_REQUEST_FAILED');
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
        
      case 'stripe':
        return await this._checkStripeStatus(transactionId);
      
      default:
        throw new PaymentError('Unsupported payment provider', 'UNSUPPORTED_PROVIDER');
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
      // Get access token
      const token = await this._getOrangeMoneyToken();
      
      // Make API request
      const response = await axios.get(
        `${this.providers.orange_money.baseUrl}/v1/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status !== 200) {
        logger.error(`Orange Money status check failed: ${JSON.stringify(response.data)}`);
        throw new PaymentError('Status check failed', 'PROVIDER_REQUEST_FAILED');
      }
      
      // Map status
      const status = this._mapOrangeMoneyStatus(response.data.status);
      
      return {
        status,
        providerStatus: response.data.status,
        providerResponse: response.data,
        failureReason: status === 'failed' ? response.data.reason || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`Orange Money status check error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to check Orange Money status', 'STATUS_CHECK_FAILED');
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
      // Generate signature
      const timestamp = Date.now().toString();
      const signature = this._generateAfriMoneySignature(
        this.providers.afrimoney.apiKey,
        this.providers.afrimoney.apiSecret,
        timestamp,
        transactionId
      );
      
      // Make API request
      const response = await axios.get(
        `${this.providers.afrimoney.baseUrl}/api/v1/disbursements/${transactionId}`,
        {
          headers: {
            'X-API-Key': this.providers.afrimoney.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status !== 200 || response.data.status !== 'success') {
        logger.error(`AfriMoney status check failed: ${JSON.stringify(response.data)}`);
        throw new PaymentError('Status check failed', 'PROVIDER_REQUEST_FAILED');
      }
      
      // Map status
      const status = this._mapAfriMoneyStatus(response.data.data.status);
      
      return {
        status,
        providerStatus: response.data.data.status,
        providerResponse: response.data.data,
        failureReason: status === 'failed' ? response.data.data.failureReason || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`AfriMoney status check error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to check AfriMoney status', 'STATUS_CHECK_FAILED');
    }
  }
  
  /**
   * Check Stripe transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction status
   * @private
   */
  async _checkStripeStatus(transactionId) {
    try {
      const stripe = require('stripe')(this.providers.stripe.apiKey);
      
      // Get transfer details
      const transfer = await stripe.transfers.retrieve(transactionId);
      
      // Map status
      const status = this._mapStripeStatus(transfer.status);
      
      return {
        status,
        providerStatus: transfer.status,
        providerResponse: transfer,
        failureReason: status === 'failed' ? transfer.failure_message || 'Unknown error' : undefined
      };
    } catch (error) {
      logger.error(`Stripe status check error: ${error.message}`);
      
      if (error instanceof PaymentError) {
        throw error;
      }
      
      throw new PaymentError('Failed to check Stripe status', 'STATUS_CHECK_FAILED');
    }
  }
  
  /**
   * Process Orange Money webhook
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processOrangeMoneyWebhook(payload) {
    try {
      // Extract transaction details
      const { transactionId, status, externalId } = payload;
      
      if (!transactionId || !status || !externalId) {
        throw new PaymentError('Invalid webhook payload', 'INVALID_WEBHOOK');
      }
      
      // Find cash out request by reference
      const cashOutRequest = await CashOutRequest.findOne({
        reference: externalId,
        provider: 'orange_money'
      });
      
      if (!cashOutRequest) {
        throw new PaymentError('Cash out request not found', 'NOT_FOUND');
      }
      
      // Update provider transaction ID if not set
      if (!cashOutRequest.providerTransactionId) {
        cashOutRequest.providerTransactionId = transactionId;
      }
      
      // Map status
      const mappedStatus = this._mapOrangeMoneyStatus(status);
      
      // Update status if changed
      if (mappedStatus !== cashOutRequest.status) {
        cashOutRequest.status = mappedStatus;
        cashOutRequest.providerResponse = payload;
        
        if (mappedStatus === 'completed') {
          cashOutRequest.completedAt = new Date();
          
          // Publish cash out completed event
          await publishEvent('cash_out.completed', {
            cashOutId: cashOutRequest._id.toString(),
            userId: cashOutRequest.userId,
            walletId: cashOutRequest.walletId,
            amount: cashOutRequest.amount,
            currency: cashOutRequest.currency,
            fee: cashOutRequest.fee,
            provider: cashOutRequest.provider,
            providerTransactionId: transactionId,
            reference: externalId
          });
        } else if (mappedStatus === 'failed') {
          cashOutRequest.failureReason = payload.reason || 'Unknown error';
          
          // Publish cash out failed event
          await publishEvent('cash_out.failed', {
            cashOutId: cashOutRequest._id.toString(),
            userId: cashOutRequest.userId,
            walletId: cashOutRequest.walletId,
            amount: cashOutRequest.amount,
            currency: cashOutRequest.currency,
            fee: cashOutRequest.fee,
            provider: cashOutRequest.provider,
            failureReason: cashOutRequest.failureReason,
            reference: externalId
          });
        }
        
        await cashOutRequest.save();
      }
      
      logger.info(`Orange Money webhook processed: ${transactionId} (${mappedStatus})`);
      
      return {
        success: true,
        cashOutId: cashOutRequest._id.toString(),
        status: mappedStatus
      };
    } catch (error) {
      logger.error(`Orange Money webhook processing error: ${error.message}`);
      
      if (error instanceof PaymentError && error.code === 'NOT_FOUND') {
        // Return success for unknown transactions to avoid retries
        return {
          success: true,
          message: 'Transaction not found in system'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Process AfriMoney webhook
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processAfriMoneyWebhook(payload) {
    try {
      // Extract transaction details
      const { transactionId, status, externalReference } = payload;
      
      if (!transactionId || !status || !externalReference) {
        throw new PaymentError('Invalid webhook payload', 'INVALID_WEBHOOK');
      }
      
      // Find cash out request by reference
      const cashOutRequest = await CashOutRequest.findOne({
        reference: externalReference,
        provider: 'afrimoney'
      });
      
      if (!cashOutRequest) {
        throw new PaymentError('Cash out request not found', 'NOT_FOUND');
      }
      
      // Update provider transaction ID if not set
      if (!cashOutRequest.providerTransactionId) {
        cashOutRequest.providerTransactionId = transactionId;
      }
      
      // Map status
      const mappedStatus = this._mapAfriMoneyStatus(status);
      
      // Update status if changed
      if (mappedStatus !== cashOutRequest.status) {
        cashOutRequest.status = mappedStatus;
        cashOutRequest.providerResponse = payload;
        
        if (mappedStatus === 'completed') {
          cashOutRequest.completedAt = new Date();
          
          // Publish cash out completed event
          await publishEvent('cash_out.completed', {
            cashOutId: cashOutRequest._id.toString(),
            userId: cashOutRequest.userId,
            walletId: cashOutRequest.walletId,
            amount: cashOutRequest.amount,
            currency: cashOutRequest.currency,
            fee: cashOutRequest.fee,
            provider: cashOutRequest.provider,
            providerTransactionId: transactionId,
            reference: externalReference
          });
        } else if (mappedStatus === 'failed') {
          cashOutRequest.failureReason = payload.failureReason || 'Unknown error';
          
          // Publish cash out failed event
          await publishEvent('cash_out.failed', {
            cashOutId: cashOutRequest._id.toString(),
            userId: cashOutRequest.userId,
            walletId: cashOutRequest.walletId,
            amount: cashOutRequest.amount,
            currency: cashOutRequest.currency,
            fee: cashOutRequest.fee,
            provider: cashOutRequest.provider,
            failureReason: cashOutRequest.failureReason,
            reference: externalReference
          });
        }
        
        await cashOutRequest.save();
      }
      
      logger.info(`AfriMoney webhook processed: ${transactionId} (${mappedStatus})`);
      
      return {
        success: true,
        cashOutId: cashOutRequest._id.toString(),
        status: mappedStatus
      };
    } catch (error) {
      logger.error(`AfriMoney webhook processing error: ${error.message}`);
      
      if (error instanceof PaymentError && error.code === 'NOT_FOUND') {
        // Return success for unknown transactions to avoid retries
        return {
          success: true,
          message: 'Transaction not found in system'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Process Stripe webhook
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processStripeWebhook(payload) {
    try {
      // Extract event type and data
      const { type, data } = payload;
      
      // Handle different event types
      switch (type) {
        case 'transfer.created':
        case 'transfer.updated':
          return await this._processStripeTransferEvent(data.object);
          
        case 'transfer.failed':
          return await this._processStripeTransferFailedEvent(data.object);
          
        default:
          logger.info(`Ignoring unhandled Stripe event type: ${type}`);
          return {
            success: true,
            message: `Unhandled event type: ${type}`
          };
      }
    } catch (error) {
      logger.error(`Stripe webhook processing error: ${error.message}`);
      
      if (error instanceof PaymentError && error.code === 'NOT_FOUND') {
        // Return success for unknown transactions to avoid retries
        return {
          success: true,
          message: 'Transaction not found in system'
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Process Stripe transfer event
   * @param {Object} transfer - Transfer object
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processStripeTransferEvent(transfer) {
    // Extract reference from metadata
    const reference = transfer.metadata?.reference;
    
    if (!reference) {
      throw new PaymentError('Missing reference in transfer metadata', 'INVALID_WEBHOOK');
    }
    
    // Find cash out request by reference
    const cashOutRequest = await CashOutRequest.findOne({
      reference,
      provider: 'stripe'
    });
    
    if (!cashOutRequest) {
      throw new PaymentError('Cash out request not found', 'NOT_FOUND');
    }
    
    // Update provider transaction ID if not set
    if (!cashOutRequest.providerTransactionId) {
      cashOutRequest.providerTransactionId = transfer.id;
    }
    
    // Map status
    const mappedStatus = this._mapStripeStatus(transfer.status);
    
    // Update status if changed
    if (mappedStatus !== cashOutRequest.status) {
      cashOutRequest.status = mappedStatus;
      cashOutRequest.providerResponse = transfer;
      
      if (mappedStatus === 'completed') {
        cashOutRequest.completedAt = new Date();
        
        // Publish cash out completed event
        await publishEvent('cash_out.completed', {
          cashOutId: cashOutRequest._id.toString(),
          userId: cashOutRequest.userId,
          walletId: cashOutRequest.walletId,
          amount: cashOutRequest.amount,
          currency: cashOutRequest.currency,
          fee: cashOutRequest.fee,
          provider: cashOutRequest.provider,
          providerTransactionId: transfer.id,
          reference
        });
      }
      
      await cashOutRequest.save();
    }
    
    logger.info(`Stripe transfer event processed: ${transfer.id} (${mappedStatus})`);
    
    return {
      success: true,
      cashOutId: cashOutRequest._id.toString(),
      status: mappedStatus
    };
  }
  
  /**
   * Process Stripe transfer failed event
   * @param {Object} transfer - Transfer object
   * @returns {Promise<Object>} Processing result
   * @private
   */
  async _processStripeTransferFailedEvent(transfer) {
    // Extract reference from metadata
    const reference = transfer.metadata?.reference;
    
    if (!reference) {
      throw new PaymentError('Missing reference in transfer metadata', 'INVALID_WEBHOOK');
    }
    
    // Find cash out request by reference
    const cashOutRequest = await CashOutRequest.findOne({
      reference,
      provider: 'stripe'
    });
    
    if (!cashOutRequest) {
      throw new PaymentError('Cash out request not found', 'NOT_FOUND');
    }
    
    // Update provider transaction ID if not set
    if (!cashOutRequest.providerTransactionId) {
      cashOutRequest.providerTransactionId = transfer.id;
    }
    
    // Update status
    cashOutRequest.status = 'failed';
    cashOutRequest.providerResponse = transfer;
    cashOutRequest.failureReason = transfer.failure_message || 'Transfer failed';
    
    await cashOutRequest.save();
    
    // Publish cash out failed event
    await publishEvent('cash_out.failed', {
      cashOutId: cashOutRequest._id.toString(),
      userId: cashOutRequest.userId,
      walletId: cashOutRequest.walletId,
      amount: cashOutRequest.amount,
      currency: cashOutRequest.currency,
      fee: cashOutRequest.fee,
      provider: cashOutRequest.provider,
      failureReason: cashOutRequest.failureReason,
      reference
    });
    
    logger.info(`Stripe transfer failed event processed: ${transfer.id}`);
    
    return {
      success: true,
      cashOutId: cashOutRequest._id.toString(),
      status: 'failed'
    };
  }
  
  /**
   * Get Orange Money access token
   * @returns {Promise<string>} Access token
   * @private
   */
  async _getOrangeMoneyToken() {
    // Check if token exists in cache
    const cachedToken = await redisClient.get('orange_money_token');
    
    if (cachedToken) {
      return cachedToken;
    }
    
    try {
      // Request new token
      const response = await axios.post(
        this.providers.orange_money.tokenUrl,
        {
          grant_type: 'client_credentials'
        },
        {
          auth: {
            username: this.providers.orange_money.clientId,
            password: this.providers.orange_money.clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.status !== 200 || !response.data.access_token) {
        logger.error(`Failed to get Orange Money token: ${JSON.stringify(response.data)}`);
        throw new PaymentError('Failed to get access token', 'AUTH_FAILED');
      }
      
      const token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      
      // Cache token
      await redisClient.set('orange_money_token', token, 'EX', expiresIn - 60);
      
      return token;
    } catch (error) {
      logger.error(`Orange Money token error: ${error.message}`);
      throw new PaymentError('Failed to get access token', 'AUTH_FAILED');
    }
  }
  
  /**
   * Generate AfriMoney API signature
   * @param {string} apiKey - API key
   * @param {string} apiSecret - API secret
   * @param {string} timestamp - Timestamp
   * @param {string} reference - Transaction reference
   * @returns {string} Signature
   * @private
   */
  _generateAfriMoneySignature(apiKey, apiSecret, timestamp, reference) {
    const signatureData = `${apiKey}${timestamp}${reference}`;
    return crypto
      .createHmac('sha256', apiSecret)
      .update(signatureData)
      .digest('hex');
  }
  
  /**
   * Map Orange Money status to system status
   * @param {string} providerStatus - Provider status
   * @returns {string} System status
   * @private
   */
  _mapOrangeMoneyStatus(providerStatus) {
    switch (providerStatus) {
      case 'SUCCESSFUL':
        return 'completed';
      case 'PENDING':
        return 'processing';
      case 'FAILED':
        return 'failed';
      case 'REJECTED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
  
  /**
   * Map AfriMoney status to system status
   * @param {string} providerStatus - Provider status
   * @returns {string} System status
   * @private
   */
  _mapAfriMoneyStatus(providerStatus) {
    switch (providerStatus) {
      case 'completed':
      case 'success':
        return 'completed';
      case 'processing':
      case 'pending':
        return 'processing';
      case 'failed':
      case 'error':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
  
  /**
   * Map Stripe status to system status
   * @param {string} providerStatus - Provider status
   * @returns {string} System status
   * @private
   */
  _mapStripeStatus(providerStatus) {
    switch (providerStatus) {
      case 'paid':
        return 'completed';
      case 'pending':
        return 'processing';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
  
  /**
   * Calculate fee for cash out
   * @param {string} provider - Provider name
   * @param {number} amount - Cash out amount
   * @returns {number} Fee amount
   * @private
   */
  _calculateFee(provider, amount) {
    switch (provider) {
      case 'orange_money':
        // 2% fee with minimum of 1 USD
        return Math.max(1, amount * 0.02);
      
      case 'afrimoney':
        // 1.5% fee with minimum of 0.5 USD
        return Math.max(0.5, amount * 0.015);
        
      case 'stripe':
        // 0.25% fee with minimum of 0.25 USD
        return Math.max(0.25, amount * 0.0025);
      
      default:
        // Default fee: 1% with minimum of 0.5 USD
        return Math.max(0.5, amount * 0.01);
    }
  }
  
  /**
   * Get provider limits
   * @param {string} provider - Provider name
   * @returns {Object} Provider limits
   * @private
   */
  _getProviderLimits(provider) {
    switch (provider) {
      case 'orange_money':
        return {
          minAmount: 1,
          maxAmount: 5000,
          dailyLimit: 10000,
          monthlyLimit: 50000
        };
      
      case 'afrimoney':
        return {
          minAmount: 0.5,
          maxAmount: 3000,
          dailyLimit: 5000,
          monthlyLimit: 30000
        };
        
      case 'stripe':
        return {
          minAmount: 0.5,
          maxAmount: 10000,
          dailyLimit: 25000,
          monthlyLimit: 100000
        };
      
      default:
        return {
          minAmount: 1,
          maxAmount: 1000,
          dailyLimit: 5000,
          monthlyLimit: 20000
        };
    }
  }
  
  /**
   * Generate a unique reference
   * @returns {string} Unique reference
   * @private
   */
  _generateReference() {
    const prefix = 'CASH';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
}

module.exports = new PaymentIntegrationService();