const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { ApiError } = require('../middleware/errorHandler');
require('dotenv').config();

/**
 * AfriMoney payment provider implementation
 */
class AfriMoneyProvider {
  /**
   * Initialize AfriMoney provider
   */
  constructor() {
    this.name = 'AfriMoney';
    this.code = 'afrimoney';
    this.apiUrl = process.env.AFRIMONEY_API_URL;
    this.apiKey = process.env.AFRIMONEY_API_KEY;
    this.apiSecret = process.env.AFRIMONEY_API_SECRET;
    this.merchantId = process.env.AFRIMONEY_MERCHANT_ID;
  }

  /**
   * Generate signature for API requests
   * @param {Object} data - Request data
   * @param {String} timestamp - Request timestamp
   * @returns {String} - Signature
   */
  generateSignature(data, timestamp) {
    const payload = JSON.stringify(data) + timestamp + this.apiKey;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Create a payment
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Payment
   */
  async createPayment(data) {
    try {
      const { amount, currency = 'SLL', description, metadata = {}, phoneNumber, country } = data;
      
      if (!phoneNumber) {
        throw new ApiError(400, 'Phone number is required for AfriMoney payments');
      }
      
      if (!country) {
        throw new ApiError(400, 'Country is required for AfriMoney payments');
      }
      
      // Generate reference
      const reference = `AM-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Prepare request data
      const requestData = {
        merchantId: this.merchantId,
        reference,
        amount,
        currency,
        description,
        customer: {
          phoneNumber,
          country
        },
        callbackUrl: process.env.WEBHOOK_BASE_URL + '/api/webhooks/afrimoney',
        metadata
      };
      
      // Generate signature
      const signature = this.generateSignature(requestData, timestamp);
      
      // Create payment request
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );
      
      if (!response.data || !response.data.paymentId) {
        throw new Error('Invalid payment response');
      }
      
      return {
        success: true,
        providerPaymentId: response.data.paymentId,
        providerReference: reference,
        status: this.mapPaymentStatus(response.data.status),
        providerResponse: response.data,
        nextAction: {
          type: 'ussd',
          code: response.data.ussdCode,
          instructions: response.data.instructions
        }
      };
    } catch (error) {
      logger.error(`AfriMoney payment creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create AfriMoney payment: ${error.message}`);
    }
  }

  /**
   * Create a withdrawal
   * @param {Object} data - Withdrawal data
   * @returns {Promise<Object>} - Withdrawal
   */
  async createWithdrawal(data) {
    try {
      const { amount, currency = 'SLL', description, metadata = {}, phoneNumber, country } = data;
      
      if (!phoneNumber) {
        throw new ApiError(400, 'Phone number is required for AfriMoney withdrawals');
      }
      
      if (!country) {
        throw new ApiError(400, 'Country is required for AfriMoney withdrawals');
      }
      
      // Generate reference
      const reference = `AM-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Prepare request data
      const requestData = {
        merchantId: this.merchantId,
        reference,
        amount,
        currency,
        description,
        recipient: {
          phoneNumber,
          country
        },
        callbackUrl: process.env.WEBHOOK_BASE_URL + '/api/webhooks/afrimoney',
        metadata
      };
      
      // Generate signature
      const signature = this.generateSignature(requestData, timestamp);
      
      // Create withdrawal request
      const response = await axios.post(
        `${this.apiUrl}/disbursements`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );
      
      if (!response.data || !response.data.disbursementId) {
        throw new Error('Invalid withdrawal response');
      }
      
      return {
        success: true,
        providerPaymentId: response.data.disbursementId,
        providerReference: reference,
        status: this.mapWithdrawalStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`AfriMoney withdrawal creation error: ${error.message}`);
      throw new ApiError(500, `Failed to create AfriMoney withdrawal: ${error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} - Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Generate signature
      const signature = this.generateSignature({ paymentId }, timestamp);
      
      // Get payment status
      const response = await axios.get(
        `${this.apiUrl}/payments/${paymentId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
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
      logger.error(`AfriMoney payment status error: ${error.message}`);
      throw new ApiError(500, `Failed to get AfriMoney payment status: ${error.message}`);
    }
  }

  /**
   * Get withdrawal status
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Withdrawal status
   */
  async getWithdrawalStatus(withdrawalId) {
    try {
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Generate signature
      const signature = this.generateSignature({ disbursementId: withdrawalId }, timestamp);
      
      // Get withdrawal status
      const response = await axios.get(
        `${this.apiUrl}/disbursements/${withdrawalId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid withdrawal status response');
      }
      
      return {
        success: true,
        status: this.mapWithdrawalStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`AfriMoney withdrawal status error: ${error.message}`);
      throw new ApiError(500, `Failed to get AfriMoney withdrawal status: ${error.message}`);
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
      const { reason = 'requested_by_customer' } = data;
      
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Prepare request data
      const requestData = {
        paymentId,
        reason
      };
      
      // Generate signature
      const signature = this.generateSignature(requestData, timestamp);
      
      // Create refund request
      const response = await axios.post(
        `${this.apiUrl}/payments/${paymentId}/refund`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );
      
      if (!response.data || !response.data.refundId) {
        throw new Error('Invalid refund response');
      }
      
      return {
        success: true,
        refundId: response.data.refundId,
        status: response.data.status,
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`AfriMoney refund error: ${error.message}`);
      throw new ApiError(500, `Failed to refund AfriMoney payment: ${error.message}`);
    }
  }

  /**
   * Cancel withdrawal
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Cancelled withdrawal
   */
  async cancelWithdrawal(withdrawalId) {
    try {
      // Generate timestamp
      const timestamp = Date.now().toString();
      
      // Prepare request data
      const requestData = {
        disbursementId: withdrawalId
      };
      
      // Generate signature
      const signature = this.generateSignature(requestData, timestamp);
      
      // Cancel withdrawal
      const response = await axios.post(
        `${this.apiUrl}/disbursements/${withdrawalId}/cancel`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': signature
          }
        }
      );
      
      if (!response.data) {
        throw new Error('Invalid withdrawal cancellation response');
      }
      
      return {
        success: true,
        status: this.mapWithdrawalStatus(response.data.status),
        providerResponse: response.data
      };
    } catch (error) {
      logger.error(`AfriMoney withdrawal cancellation error: ${error.message}`);
      throw new ApiError(500, `Failed to cancel AfriMoney withdrawal: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @param {String} timestamp - Webhook timestamp
   * @returns {Object} - Verification result
   */
  verifyWebhook(payload, signature, timestamp) {
    try {
      // Verify signature
      const computedSignature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(payload + timestamp + this.apiKey)
        .digest('hex');
      
      if (computedSignature !== signature) {
        throw new Error('Invalid signature');
      }
      
      // Parse payload
      const event = JSON.parse(payload);
      
      return {
        success: true,
        event
      };
    } catch (error) {
      logger.error(`AfriMoney webhook verification error: ${error.message}`);
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
          paymentId = eventData.paymentId;
          status = 'completed';
          break;
        case 'payment.failed':
          paymentId = eventData.paymentId;
          status = 'failed';
          break;
        case 'payment.cancelled':
          paymentId = eventData.paymentId;
          status = 'cancelled';
          break;
        case 'disbursement.success':
          paymentId = eventData.disbursementId;
          status = 'completed';
          break;
        case 'disbursement.failed':
          paymentId = eventData.disbursementId;
          status = 'failed';
          break;
        case 'disbursement.cancelled':
          paymentId = eventData.disbursementId;
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
      logger.error(`AfriMoney webhook processing error: ${error.message}`);
      throw new ApiError(500, `Failed to process AfriMoney webhook: ${error.message}`);
    }
  }

  /**
   * Map AfriMoney payment status to internal status
   * @param {String} afriMoneyStatus - AfriMoney payment status
   * @returns {String} - Internal status
   */
  mapPaymentStatus(afriMoneyStatus) {
    switch (afriMoneyStatus) {
      case 'PENDING':
      case 'INITIATED':
        return 'pending';
      case 'PROCESSING':
        return 'processing';
      case 'SUCCESS':
      case 'SUCCESSFUL':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      case 'FAILED':
        return 'failed';
      default:
        return 'pending';
    }
  }

  /**
   * Map AfriMoney withdrawal status to internal status
   * @param {String} afriMoneyStatus - AfriMoney withdrawal status
   * @returns {String} - Internal status
   */
  mapWithdrawalStatus(afriMoneyStatus) {
    switch (afriMoneyStatus) {
      case 'PENDING':
      case 'INITIATED':
        return 'pending';
      case 'PROCESSING':
        return 'processing';
      case 'SUCCESS':
      case 'SUCCESSFUL':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      case 'FAILED':
        return 'failed';
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
  calculateFee(amount, currency = 'SLL') {
    // AfriMoney typically charges 2% per transaction
    return amount * 0.02;
  }

  /**
   * Get supported countries
   * @returns {Array} - Supported countries
   */
  getSupportedCountries() {
    return [
      'Sierra Leone',
      'DRC',
      'Uganda',
      'The Gambia'
    ];
  }

  /**
   * Get supported currencies
   * @returns {Array} - Supported currencies
   */
  getSupportedCurrencies() {
    return [
      'SLL', // Sierra Leonean Leone
      'CDF', // Congolese Franc
      'UGX', // Ugandan Shilling
      'GMD'  // Gambian Dalasi
    ];
  }
}

module.exports = new AfriMoneyProvider();