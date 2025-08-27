# Payment Integration Implementation

This document outlines the implementation of the integration with Orange Money and AfriMoney for the Digital Money Generation System.

## Overview

The payment integration system enables users to cash out their digital money to external payment providers, specifically Orange Money and AfriMoney. It handles the communication with these providers' APIs, processes cash-out requests, and manages the transaction lifecycle.

## Key Components

1. Payment provider integration service
2. Cash-out request processing
3. Webhook handling for payment callbacks
4. Transaction status synchronization
5. Error handling and retry mechanisms

## Implementation Details

### 1. Payment Integration Service

```javascript
// payment-integration/src/services/payment-integration.service.js

const axios = require('axios');
const crypto = require('crypto');
const { redisClient } = require('../config/redis.config');
const logger = require('../utils/logger.util');
const { PaymentError } = require('../utils/errors.util');
const { publishEvent } = require('../utils/event.util');
const CashOutRequest = require('../models/cash-out-request.model');

/**
 * Payment Integration Service
 * Handles integration with payment providers like Orange Money and AfriMoney
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
      
      // Verify webhook signature
      this._verifyWebhookSignature(provider, payload, headers);
      
      // Process webhook based on provider
      switch (provider) {
        case 'orange_money':
          return await this._processOrangeMoneyWebhook(payload);
        
        case 'afrimoney':
          return await this._processAfriMoneyWebhook(payload);
        
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
        payeeNote: 'Digital Money System cash out',
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
        description: 'Digital Money System cash out'
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
   * Verify webhook signature
   * @param {string} provider - Provider name
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Webhook headers
   * @throws {PaymentError} If signature is invalid
   * @private
   */
  _verifyWebhookSignature(provider, payload, headers) {
    switch (provider) {
      case 'orange_money':
        this._verifyOrangeMoneySignature(payload, headers);
        break;
      
      case 'afrimoney':
        this._verifyAfriMoneySignature(payload, headers);
        break;
      
      default:
        throw new PaymentError('Unsupported payment provider', 'UNSUPPORTED_PROVIDER');
    }
  }
  
  /**
   * Verify Orange Money webhook signature
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Webhook headers
   * @throws {PaymentError} If signature is invalid
   * @private
   */
  _verifyOrangeMoneySignature(payload, headers) {
    const signature = headers['x-signature'];
    
    if (!signature) {
      throw new PaymentError('Missing signature', 'INVALID_SIGNATURE');
    }
    
    const webhookSecret = this.providers.orange_money.webhookSecret;
    const payloadString = JSON.stringify(payload);
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      throw new PaymentError('Invalid signature', 'INVALID_SIGNATURE');
    }
  }
  
  /**
   * Verify AfriMoney webhook signature
   * @param {Object} payload - Webhook payload
   * @param {Object} headers - Webhook headers
   * @throws {PaymentError} If signature is invalid
   * @private
   */
  _verifyAfriMoneySignature(payload, headers) {
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      throw new PaymentError('Missing signature or timestamp', 'INVALID_SIGNATURE');
    }
    
    const apiKey = this.providers.afrimoney.apiKey;
    const apiSecret = this.providers.afrimoney.apiSecret;
    const reference = payload.externalReference || payload.transactionId;
    
    const expectedSignature = this._generateAfriMoneySignature(
      apiKey,
      apiSecret,
      timestamp,
      reference
    );
    
    if (signature !== expectedSignature) {
      throw new PaymentError('Invalid signature', 'INVALID_SIGNATURE');
    }
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
```

### 2. Cash Out Request Model

```javascript
// payment-integration/src/models/cash-out-request.model.js

const mongoose = require('mongoose');

const cashOutRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  provider: {
    type: String,
    required: true,
    index: true
  },
  providerAccountId: {
    type: String,
    required: true
  },
  providerAccountName: {
    type: String,
    required: true
  },
  providerTransactionId: {
    type: String,
    sparse: true,
    index: true
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  providerResponse: {
    type: Object,
    default: {}
  },
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes for queries
cashOutRequestSchema.index({ createdAt: -1 });
cashOutRequestSchema.index({ userId: 1, createdAt: -1 });
cashOutRequestSchema.index({ walletId: 1, createdAt: -1 });
cashOutRequestSchema.index({ provider: 1, status: 1 });

const CashOutRequest = mongoose.model('CashOutRequest', cashOutRequestSchema);

module.exports = CashOutRequest;
```

### 3. Payment Controller

```javascript
// payment-integration/src/controllers/payment.controller.js

const paymentService = require('../services/payment-integration.service');
const { validateCashOutRequest } = require('../validation/payment.validation');
const { PaymentError } = require('../utils/errors.util');
const logger = require('../utils/logger.util');

/**
 * Get available payment providers
 */
exports.getProviders = async (req, res) => {
  try {
    const providers = await paymentService.getAvailableProviders();
    
    return res.status(200).json({
      success: true,
      data: {
        providers
      }
    });
  } catch (error) {
    logger.error(`Get providers controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving payment providers'
      }
    });
  }
};

/**
 * Process cash out request
 */
exports.processCashOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Validate request
    const { error, value } = validateCashOutRequest(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid cash out request',
          details: error.details.map(d => ({ field: d.path[0], message: d.message }))
        }
      });
    }
    
    // Add userId to cash out data
    value.userId = userId;
    
    // Process cash out
    const result = await paymentService.processCashOut(value);
    
    return res.status(200).json({
      success: true,
      message: 'Cash out request initiated',
      data: result
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Process cash out controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during cash out processing'
      }
    });
  }
};

/**
 * Get cash out status
 */
exports.getCashOutStatus = async (req, res) => {
  try {
    const { cashOutId } = req.params;
    const userId = req.user.userId;
    
    // Get cash out status
    const cashOut = await paymentService.getCashOutStatus(cashOutId);
    
    // Check if user has permission to view this cash out
    if (cashOut.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this cash out'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: cashOut
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      if (error.code === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
      }
      
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    
    logger.error(`Get cash out status controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving cash out status'
      }
    });
  }
};

/**
 * Get cash out history
 */
exports.getCashOutHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page, limit, status, provider, startDate, endDate, walletId } = req.query;
    
    // Get cash out history
    const result = await paymentService.getCashOutHistory(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      provider,
      startDate,
      endDate,
      walletId
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Get cash out history controller error: ${error.message}`);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving cash out history'
      }
    });
  }
};

/**
 * Handle webhook from payment provider
 */
exports.handleWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;
    const headers = req.headers;
    
    // Process webhook
    const result = await paymentService.handleWebhook(provider, payload, headers);
    
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Webhook controller error: ${error.message}`);
    
    // Always return 200 for webhooks to prevent retries
    return res.status(200).json({
      success: false,
      error: {
        message: 'Webhook processing failed'
      }
    });
  }
};
```

### 4. Payment Routes

```javascript
// payment-integration/src/routes/payment.routes.js

const express = require('express');
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Public webhook routes
router.post('/webhook/:provider', paymentController.handleWebhook);

// Protected routes
router.use(authMiddleware.verifyToken);

// Payment provider routes
router.get('/providers', paymentController.getProviders);

// Cash out routes
router.post('/cash-out', paymentController.processCashOut);
router.get('/cash-out/:cashOutId', paymentController.getCashOutStatus);
router.get('/cash-out', paymentController.getCashOutHistory);

module.exports = router;
```

### 5. Validation Utility

```javascript
// payment-integration/src/validation/payment.validation.js

const Joi = require('joi');

/**
 * Validate cash out request
 */
exports.validateCashOutRequest = (data) => {
  const schema = Joi.object({
    walletId: Joi.string()
      .required()
      .messages({
        'string.base': 'Wallet ID must be a string',
        'any.required': 'Wallet ID is required'
      }),
    
    amount: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.positive': 'Amount must be positive',
        'any.required': 'Amount is required'
      }),
    
    currency: Joi.string()
      .required()
      .messages({
        'string.base': 'Currency must be a string',
        'any.required': 'Currency is required'
      }),
    
    provider: Joi.string()
      .valid('orange_money', 'afrimoney')
      .required()
      .messages({
        'string.base': 'Provider must be a string',
        'any.only': 'Provider must be one of: orange_money, afrimoney',
        'any.required': 'Provider is required'
      }),
    
    providerAccountId: Joi.string()
      .required()
      .messages({
        'string.base': 'Provider account ID must be a string',
        'any.required': 'Provider account ID is required'
      }),
    
    providerAccountName: Joi.string()
      .required()
      .messages({
        'string.base': 'Provider account name must be a string',
        'any.required': 'Provider account name is required'
      }),
    
    reference: Joi.string()
      .optional()
      .messages({
        'string.base': 'Reference must be a string'
      })
  });
  
  return schema.validate(data);
};
```

### 6. Error Utility

```javascript
// payment-integration/src/utils/errors.util.js

/**
 * Custom error for payment-related issues
 */
class PaymentError extends Error {
  /**
   * Create a new PaymentError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
  }
}

module.exports = {
  PaymentError
};
```

### 7. Main Server File

```javascript
// payment-integration/src/server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { redisClient } = require('./config/redis.config');
const { subscribeToEvents } = require('./utils/event.util');
const logger = require('./utils/logger.util');
const paymentRoutes = require('./routes/payment.routes');

// Environment variables
const {
  PORT = 3004,
  MONGODB_URI,
  NODE_ENV = 'development'
} = process.env;

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'payment-integration-service',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Subscribe to events
    subscribeToEvents('cash_out.initiated', handleCashOutInitiated);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Payment integration service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error(`Server initialization error: ${error.message}`);
    process.exit(1);
  });

// Event handlers
async function handleCashOutInitiated(data) {
  logger.info(`Cash out initiated event received: ${data.cashOutId}`);
  
  // No need to process here as the cash out is already initiated
  // This is just for monitoring and potential future use
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  
  // Close Redis connection
  await redisClient.quit();
  logger.info('Redis connection closed');
  
  process.exit(0);
});
```

## Integration Flow with Orange Money

The integration with Orange Money follows this flow:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  User           │     │  Payment        │     │  Orange Money   │
│  Interface      │────▶│  Integration    │────▶│  API            │
│                 │     │  Service        │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │                       │
                                 │                       │
                                 │                       │
┌─────────────────┐     ┌────────▼────────┐     ┌────────▼────────┐
│                 │     │                 │     │                 │
│  Transaction    │◀────│  Event          │◀────│  Orange Money   │
│  Service        │     │  System         │     │  Webhook        │
│                 │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Initiation**:
   - User requests a cash-out through the UI
   - Payment Integration Service validates the request
   - Creates a cash-out record in the database
   - Publishes a cash_out.initiated event

2. **Processing**:
   - Payment Integration Service calls Orange Money API
   - Authenticates using OAuth 2.0
   - Sends cash-out request with required parameters
   - Updates cash-out record with provider transaction ID

3. **Completion**:
   - Orange Money processes the request and sends a webhook
   - Payment Integration Service validates the webhook signature
   - Updates the cash-out record status
   - Publishes a cash_out.completed or cash_out.failed event
   - Transaction Service updates the transaction status

4. **Status Checking**:
   - If webhook is not received, system can check status via API
   - Scheduled job checks pending cash-outs
   - Updates status based on API response

### Orange Money API Authentication

```javascript
/**
 * Get Orange Money access token
 * @returns {Promise<string>} Access token
 * @private
 */
async function getOrangeMoneyToken() {
  // Check if token exists in cache
  const cachedToken = await redisClient.get('orange_money_token');
  
  if (cachedToken) {
    return cachedToken;
  }
  
  // Request new token
  const response = await axios.post(
    'https://api.orange.com/oauth/v3/token',
    {
      grant_type: 'client_credentials'
    },
    {
      auth: {
        username: process.env.ORANGE_MONEY_CLIENT_ID,
        password: process.env.ORANGE_MONEY_CLIENT_SECRET
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  if (response.status !== 200 || !response.data.access_token) {
    throw new Error('Failed to get access token');
  }
  
  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;
  
  // Cache token
  await redisClient.set('orange_money_token', token, 'EX', expiresIn - 60);
  
  return token;
}
```

### Orange Money Cash-Out Request

```javascript
/**
 * Process Orange Money cash out request
 * @param {Object} cashOutRequest - Cash out request
 * @returns {Promise<Object>} Provider response
 * @private
 */
async function processOrangeMoneyRequest(cashOutRequest) {
  // Get access token
  const token = await getOrangeMoneyToken();
  
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
    payeeNote: 'Digital Money System cash out',
    externalId: cashOutRequest.reference
  };
  
  // Make API request
  const response = await axios.post(
    `${process.env.ORANGE_MONEY_API_URL}/v1/cash-out`,
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
    throw new Error('Cash out request failed');
  }
  
  return {
    providerTransactionId: response.data.transactionId || cashOutRequest.reference,
    status: mapOrangeMoneyStatus(response.data.status || 'PENDING'),
    providerResponse: response.data
  };
}
```

## Integration Flow with AfriMoney

The integration with AfriMoney follows a similar flow:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  User           │     │  Payment        │     │  AfriMoney      │
│  Interface      │────▶│  Integration    │────▶│  API            │
│                 │     │  Service        │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │                       │
                                 │                       │
                                 │                       │
┌─────────────────┐     ┌────────▼────────┐     ┌────────▼────────┐
│                 │     │                 │     │                 │
│  Transaction    │◀────│  Event          │◀────│  AfriMoney      │
│  Service        │     │  System         │     │  Webhook        │
│                 │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Initiation**:
   - User requests a cash-out through the UI
   - Payment Integration Service validates the request
   - Creates a cash-out record in the database
   - Publishes a cash_out.initiated event

2. **Processing**:
   - Payment Integration Service calls AfriMoney API
   - Authenticates using API key and signature
   - Sends cash-out request with required parameters
   - Updates cash-out record with provider transaction ID

3. **Completion**:
   - AfriMoney processes the request and sends a webhook
   - Payment Integration Service validates the webhook signature
   - Updates the cash-out record status
   - Publishes a cash_out.completed or cash_out.failed event
   - Transaction Service updates the transaction status

4. **Status Checking**:
   - If webhook is not received, system can check status via API
   - Scheduled job checks pending cash-outs
   - Updates status based on API response

### AfriMoney API Authentication

```javascript
/**
 * Generate AfriMoney API signature
 * @param {string} apiKey - API key
 * @param {string} apiSecret - API secret
 * @param {string} timestamp - Timestamp
 * @param {string} reference - Transaction reference
 * @returns {string} Signature
 * @private
 */
function generateAfriMoneySignature(apiKey, apiSecret, timestamp, reference) {
  const signatureData = `${apiKey}${timestamp}${reference}`;
  return crypto
    .createHmac('sha256', apiSecret)
    .update(signatureData)
    .digest('hex');
}
```

### AfriMoney Cash-Out Request

```javascript
/**
 * Process AfriMoney cash out request
 * @param {Object} cashOutRequest - Cash out request
 * @returns {Promise<Object>} Provider response
 * @private
 */
async function processAfriMoneyRequest(cashOutRequest) {
  // Generate signature
  const timestamp = Date.now().toString();
  const signature = generateAfriMoneySignature(
    process.env.AFRIMONEY_API_KEY,
    process.env.AFRIMONEY_API_SECRET,
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
    description: 'Digital Money System cash out'
  };
  
  // Make API request
  const response = await axios.post(
    `${process.env.AFRIMONEY_API_URL}/api/v1/disbursements`,
    payload,
    {
      headers: {
        'X-API-Key': process.env.AFRIMONEY_API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.status !== 200 || response.data.status !== 'success') {
    throw new Error('Cash out request failed');
  }
  
  return {
    providerTransactionId: response.data.data.transactionId,
    status: mapAfriMoneyStatus(response.data.data.status),
    providerResponse: response.data.data
  };
}
```

## Webhook Handling

Both Orange Money and AfriMoney send webhooks to notify the system about transaction status changes. The system handles these webhooks securely:

### Webhook Signature Verification

```javascript
/**
 * Verify webhook signature
 * @param {string} provider - Provider name
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 * @throws {PaymentError} If signature is invalid
 * @private
 */
function verifyWebhookSignature(provider, payload, headers) {
  switch (provider) {
    case 'orange_money':
      verifyOrangeMoneySignature(payload, headers);
      break;
    
    case 'afrimoney':
      verifyAfriMoneySignature(payload, headers);
      break;
    
    default:
      throw new Error('Unsupported payment provider');
  }
}

/**
 * Verify Orange Money webhook signature
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 * @throws {PaymentError} If signature is invalid
 * @private
 */
function verifyOrangeMoneySignature(payload, headers) {
  const signature = headers['x-signature'];
  
  if (!signature) {
    throw new Error('Missing signature');
  }
  
  const webhookSecret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  const payloadString = JSON.stringify(payload);
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
}

/**
 * Verify AfriMoney webhook signature
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Webhook headers
 * @throws {PaymentError} If signature is invalid
 * @private
 */
function verifyAfriMoneySignature(payload, headers) {
  const signature = headers['x-signature'];
  const timestamp = headers['x-timestamp'];
  
  if (!signature || !timestamp) {
    throw new Error('Missing signature or timestamp');
  }
  
  const apiKey = process.env.AFRIMONEY_API_KEY;
  const apiSecret = process.env.AFRIMONEY_API_SECRET;
  const reference = payload.externalReference || payload.transactionId;
  
  const expectedSignature = generateAfriMoneySignature(
    apiKey,
    apiSecret,
    timestamp,
    reference
  );
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
}
```

### Webhook Processing

```javascript
/**
 * Process Orange Money webhook
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} Processing result
 * @private
 */
async function processOrangeMoneyWebhook(payload) {
  // Extract transaction details
  const { transactionId, status, externalId } = payload;
  
  if (!transactionId || !status || !externalId) {
    throw new Error('Invalid webhook payload');
  }
  
  // Find cash out request by reference
  const cashOutRequest = await CashOutRequest.findOne({
    reference: externalId,
    provider: 'orange_money'
  });
  
  if (!cashOutRequest) {
    // Return success for unknown transactions to avoid retries
    return {
      success: true,
      message: 'Transaction not found in system'
    };
  }
  
  // Update provider transaction ID if not set
  if (!cashOutRequest.providerTransactionId) {
    cashOutRequest.providerTransactionId = transactionId;
  }
  
  // Map status
  const mappedStatus = mapOrangeMoneyStatus(status);
  
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
  
  return {
    success: true,
    cashOutId: cashOutRequest._id.toString(),
    status: mappedStatus
  };
}
```

## Error Handling and Retry Mechanism

The system implements robust error handling and retry mechanisms for payment provider integration:

### Error Handling

```javascript
/**
 * Process cash out with error handling and retry
 * @param {Object} cashOutRequest - Cash out request
 * @returns {Promise<Object>} Processing result
 */
async function processCashOutWithRetry(cashOutRequest) {
  try {
    // Process cash out based on provider
    let result;
    
    switch (cashOutRequest.provider) {
      case 'orange_money':
        result = await processOrangeMoneyRequest(cashOutRequest);
        break;
      
      case 'afrimoney':
        result = await processAfriMoneyRequest(cashOutRequest);
        break;
      
      default:
        throw new Error('Unsupported payment provider');
    }
    
    return result;
  } catch (error) {
    // Check if we should retry
    if (shouldRetry(cashOutRequest, error)) {
      // Increment retry count
      cashOutRequest.retryCount += 1;
      cashOutRequest.lastRetryAt = new Date();
      await cashOutRequest.save();
      
      // Schedule retry
      scheduleRetry(cashOutRequest);
      
      return {
        status: 'processing',
        message: 'Request scheduled for retry'
      };
    }
    
    // Mark as failed if we shouldn't retry
    cashOutRequest.status = 'failed';
    cashOutRequest.failureReason = error.message || 'Unknown error';
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
      reference: cashOutRequest.reference
    });
    
    return {
      status: 'failed',
      failureReason: cashOutRequest.failureReason
    };
  }
}

/**
 * Check if we should retry the cash out request
 * @param {Object} cashOutRequest - Cash out request
 * @param {Error} error - Error that occurred
 * @returns {boolean} Whether to retry
 */
function shouldRetry(cashOutRequest, error) {
  // Don't retry if max retries reached
  if (cashOutRequest.retryCount >= 3) {
    return false;
  }
  
  // Don't retry certain errors
  if (error.message.includes('Invalid account') || 
      error.message.includes('Insufficient funds') ||
      error.message.includes('Account not found')) {
    return false;
  }
  
  // Retry network errors, timeouts, and temporary provider issues
  return true;
}

/**
 * Schedule a retry for the cash out request
 * @param {Object} cashOutRequest - Cash out request
 */
function scheduleRetry(cashOutRequest) {
  // Calculate delay based on retry count (exponential backoff)
  const delaySeconds = Math.pow(2, cashOutRequest.retryCount) * 30;
  
  // Schedule retry
  setTimeout(async () => {
    try {
      // Reload cash out request to get latest status
      const freshRequest = await CashOutRequest.findById(cashOutRequest._id);
      
      // Only retry if still in processing status
      if (freshRequest && freshRequest.status === 'processing') {
        await processCashOutWithRetry(freshRequest);
      }
    } catch (error) {
      logger.error(`Retry failed for cash out ${cashOutRequest._id}: ${error.message}`);
    }
  }, delaySeconds * 1000);
}
```

## Conclusion

The payment integration system enables the Digital Money Generation System to interface with external payment providers, specifically Orange Money and AfriMoney, for cash-out functionality. It includes:

1. **Provider Integration**: Secure communication with Orange Money and AfriMoney APIs
2. **Cash-Out Processing**: Handling of cash-out requests from initiation to completion
3. **Webhook Handling**: Secure processing of provider webhooks for transaction status updates
4. **Error Handling**: Robust error handling and retry mechanisms for failed requests
5. **Security**: Signature verification, secure authentication, and data protection

The system is designed to be scalable, secure, and reliable, ensuring that users can easily cash out their digital money to their preferred payment providers. It provides a seamless integration between the Digital Money Generation System and external payment providers, enhancing the overall user experience.