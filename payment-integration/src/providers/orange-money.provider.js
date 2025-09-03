const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { ApiError } = require('../middleware/errorHandler');
require('dotenv').config();

/**
 * Orange Money payment provider implementation
 */
class OrangeMoneyProvider {
  /**
   * Initialize Orange Money provider
   */
  constructor() {
    this.name = 'Orange Money';
    this.code = 'orange_money';
    this.apiUrl = process.env.ORANGE_MONEY_API_URL;
    this.clientId = process.env.ORANGE_MONEY_CLIENT_ID;
    this.clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET;
    this.merchantId = process.env.ORANGE_MONEY_MERCHANT_ID;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get access token
   * @returns {Promise<String>} - Access token
   */
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
        return this.accessToken;
      }
      
      // Request new token
      const response = await axios.post(
        `${this.apiUrl}/token`,
        {
          grant_type: 'client_credentials'
        },
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid token response');
      }
      
      // Store token and expiry
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return this.accessToken;
    } catch (error) {
      logger.error(`Orange Money token error: ${error.message}`);
      throw new ApiError(500, `Failed to get Orange Money access token: ${error.message}`);
    }
  }

  /**
   * Create a payment
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Payment
   */
  async createPayment(data) {
    try {
      const { amount, currency = 'XOF', description, metadata = {}, returnUrl, cancelUrl } = data;
      
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Generate unique reference
      const reference = `OM-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Create payment request
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          merchant: {
            id: this.merchantId
          },
          payment: {
            reference,
            amount: {
              value: amount,
              currency
            },
            description,
            callbackUrl: process.env.WEBHOOK_BASE_URL + '/api/webhooks/orange-money',
            returnUrl: returnUrl || process.env.WEBHOOK_BASE_URL,
            cancelUrl: cancelUrl || process.env.WEBHOOK_BASE_URL
          },
          metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data || !response.data.paymentUrl) {
        throw new Error('Invalid payment response');
      }
      
      return {
        success: true,
        providerPaymentId: response.data.id,
        providerReference: reference,
        status: this.mapPaymentStatus(response.data.status),
        providerResponse: response.data,
        paymentUrl: response.data.paymentUrl
      };
    } catch (error) {
      logger.error(`Orange Money payment creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create Orange Money payment: ${error.message}`);
    }
  }

  /**
   * Create a withdrawal
   * @param {Object} data - Withdrawal data
   * @returns {Promise<Object>} - Withdrawal
   */
  async createWithdrawal(data) {
    try {
      const { amount, currency = 'XOF', description, metadata = {}, recipientInfo } = data;
      
      // Validate recipient info
      if (!recipientInfo || !recipientInfo.phoneNumber || !recipientInfo.country) {
        throw new ApiError(400, 'Phone number and country are required for Orange Money withdrawals');
      }
      
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Generate unique reference
      const reference = `OM-W-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Create withdrawal request
      const response = await axios.post(
        `${this.apiUrl}/transfers`,
        {
          merchant: {
            id: this.merchantId
          },
          transfer: {
            reference,
            amount: {
              value: amount,
              currency
            },
            description,
            destination: {
              type: 'ORANGEMONEY',
              phoneNumber: recipientInfo.phoneNumber,
              country: recipientInfo.country
            },
            callbackUrl: process.env.WEBHOOK_BASE_URL + '/api/webhooks/orange-money'
          },
          metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data || !response.data.id) {
        throw new Error('Invalid withdrawal response');
      }
      
      return {
        success: true,
        providerPaymentId: response.data.id,
        providerReference: reference,
        status: this.mapTransferStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`Orange Money withdrawal creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create Orange Money withdrawal: ${error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} - Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Get payment status
      const response = await axios.get(
        `${this.apiUrl}/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid payment status response');
      }
      
      return {
        success: true,
        status: this.mapPaymentStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`Orange Money payment status error: ${error.message}`);
      throw new ApiError(500, `Failed to get Orange Money payment status: ${error.message}`);
    }
  }

  /**
   * Get withdrawal status
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Withdrawal status
   */
  async getWithdrawalStatus(withdrawalId) {
    try {
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Get withdrawal status
      const response = await axios.get(
        `${this.apiUrl}/transfers/${withdrawalId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid withdrawal status response');
      }
      
      return {
        success: true,
        status: this.mapTransferStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`Orange Money withdrawal status error: ${error.message}`);
      throw new ApiError(500, `Failed to get Orange Money withdrawal status: ${error.message}`);
    }
  }

  /**
   * Refund payment
   * @param {String} paymentId - Payment ID
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Refund
   */
  async refundPayment(paymentId, data = {}) {
    try {
      const { amount, reason = 'Requested by customer', metadata = {} } = data;
      
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Create refund request
      const response = await axios.post(
        `${this.apiUrl}/payments/${paymentId}/refunds`,
        {
          refund: {
            amount: amount ? { value: amount } : undefined,
            reason
          },
          metadata
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid refund response');
      }
      
      return {
        success: true,
        refundId: response.data.id,
        status: this.mapRefundStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`Orange Money refund error: ${error.message}`);
      throw new ApiError(500, `Failed to refund Orange Money payment: ${error.message}`);
    }
  }

  /**
   * Cancel withdrawal
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Cancelled withdrawal
   */
  async cancelWithdrawal(withdrawalId) {
    try {
      // Get access token
      const accessToken = await this.getAccessToken();
      
      // Cancel withdrawal
      const response = await axios.post(
        `${this.apiUrl}/transfers/${withdrawalId}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid cancellation response');
      }
      
      return {
        success: true,
        status: this.mapTransferStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`Orange Money withdrawal cancellation error: ${error.message}`);
      throw new ApiError(500, `Failed to cancel Orange Money withdrawal: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Object} - Verification result
   */
  verifyWebhook(payload, signature) {
    try {
      // Orange Money uses HMAC-SHA256 for webhook signatures
      const computedSignature = crypto
        .createHmac('sha256', this.clientSecret)
        .update(payload)
        .digest('hex');
      
      if (computedSignature !== signature) {
        throw new Error('Invalid webhook signature');
      }
      
      return {
        success: true,
        event: JSON.parse(payload)
      };
    } catch (error) {
      logger.error(`Orange Money webhook verification error: ${error.message}`);
      throw new ApiError(400, `Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event
   * @returns {Object} - Processed event
   */
  processWebhookEvent(event) {
    try {
      const eventType = event.type;
      const eventData = event.data;
      let paymentId = null;
      let status = null;
      
      // Process different event types
      switch (eventType) {
        case 'payment.success':
          paymentId = eventData.id;
          status = 'completed';
          break;
        case 'payment.failed':
          paymentId = eventData.id;
          status = 'failed';
          break;
        case 'payment.cancelled':
          paymentId = eventData.id;
          status = 'cancelled';
          break;
        case 'transfer.success':
          paymentId = eventData.id;
          status = 'completed';
          break;
        case 'transfer.failed':
          paymentId = eventData.id;
          status = 'failed';
          break;
        case 'transfer.cancelled':
          paymentId = eventData.id;
          status = 'cancelled';
          break;
        default:
          // Unhandled event type
          return {
            success: true,
            handled: false,
            eventType,
            message: `Unhandled event type: ${eventType}`
          };
      }
      
      return {
        success: true,
        handled: true,
        eventType,
        paymentId,
        status,
        eventData
      };
    } catch (error) {
      logger.error(`Orange Money webhook processing error: ${error.message}`);
      throw new ApiError(500, `Failed to process Orange Money webhook: ${error.message}`);
    }
  }

  /**
   * Map Orange Money payment status to internal status
   * @param {String} orangeMoneyStatus - Orange Money payment status
   * @returns {String} - Internal status
   */
  mapPaymentStatus(orangeMoneyStatus) {
    switch (orangeMoneyStatus) {
      case 'PENDING':
      case 'INITIATED':
        return 'pending';
      case 'PROCESSING':
        return 'processing';
      case 'SUCCESS':
      case 'SUCCESSFUL':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Map Orange Money transfer status to internal status
   * @param {String} orangeMoneyStatus - Orange Money transfer status
   * @returns {String} - Internal status
   */
  mapTransferStatus(orangeMoneyStatus) {
    switch (orangeMoneyStatus) {
      case 'PENDING':
      case 'INITIATED':
        return 'pending';
      case 'PROCESSING':
        return 'processing';
      case 'SUCCESS':
      case 'SUCCESSFUL':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Map Orange Money refund status to internal status
   * @param {String} orangeMoneyStatus - Orange Money refund status
   * @returns {String} - Internal status
   */
  mapRefundStatus(orangeMoneyStatus) {
    switch (orangeMoneyStatus) {
      case 'PENDING':
      case 'INITIATED':
        return 'pending';
      case 'PROCESSING':
        return 'processing';
      case 'SUCCESS':
      case 'SUCCESSFUL':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Calculate payment fee
   * @param {Number} amount - Payment amount
   * @param {String} currency - Currency
   * @returns {Number} - Fee amount
   */
  calculateFee(amount, currency = 'XOF') {
    // Orange Money typically charges 1.5% per transaction
    return amount * 0.015;
  }

  /**
   * Get supported countries
   * @returns {Array} - Supported countries
   */
  getSupportedCountries() {
    return [
      'Cameroon',
      'Côte d\'Ivoire',
      'Mali',
      'Senegal',
      'Guinea',
      'Madagascar',
      'DRC'
    ];
  }

  /**
   * Get supported currencies
   * @returns {Array} - Supported currencies
   */
  getSupportedCurrencies() {
    return [
      'XOF', // West African CFA franc
      'XAF', // Central African CFA franc
      'MGA', // Malagasy ariary
      'GNF'  // Guinean franc
    ];
  }
}

module.exports = new OrangeMoneyProvider();