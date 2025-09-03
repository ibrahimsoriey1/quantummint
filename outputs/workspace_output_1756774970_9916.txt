const stripeProvider = require('./stripe.provider');
const orangeMoneyProvider = require('./orange-money.provider');
const afrimoneyProvider = require('./afrimoney.provider');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Provider factory to manage payment providers
 */
class ProviderFactory {
  constructor() {
    this.providers = {
      stripe: stripeProvider,
      orange_money: orangeMoneyProvider,
      afrimoney: afrimoneyProvider
    };
  }

  /**
   * Get provider by code
   * @param {String} providerCode - Provider code
   * @returns {Object} - Provider instance
   */
  getProvider(providerCode) {
    const provider = this.providers[providerCode];
    
    if (!provider) {
      logger.error(`Provider not found: ${providerCode}`);
      throw new ApiError(400, `Payment provider '${providerCode}' not supported`);
    }
    
    return provider;
  }

  /**
   * Get all providers
   * @returns {Object} - All providers
   */
  getAllProviders() {
    return this.providers;
  }

  /**
   * Create a payment
   * @param {String} providerCode - Provider code
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} - Payment
   */
  async createPayment(providerCode, data) {
    const provider = this.getProvider(providerCode);
    return provider.createPayment(data);
  }

  /**
   * Create a withdrawal
   * @param {String} providerCode - Provider code
   * @param {Object} data - Withdrawal data
   * @returns {Promise<Object>} - Withdrawal
   */
  async createWithdrawal(providerCode, data) {
    const provider = this.getProvider(providerCode);
    return provider.createWithdrawal(data);
  }

  /**
   * Get payment status
   * @param {String} providerCode - Provider code
   * @param {String} paymentId - Payment ID
   * @returns {Promise<Object>} - Payment status
   */
  async getPaymentStatus(providerCode, paymentId) {
    const provider = this.getProvider(providerCode);
    return provider.getPaymentStatus(paymentId);
  }

  /**
   * Get withdrawal status
   * @param {String} providerCode - Provider code
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Withdrawal status
   */
  async getWithdrawalStatus(providerCode, withdrawalId) {
    const provider = this.getProvider(providerCode);
    return provider.getWithdrawalStatus(withdrawalId);
  }

  /**
   * Refund payment
   * @param {String} providerCode - Provider code
   * @param {String} paymentId - Payment ID
   * @param {Object} data - Refund data
   * @returns {Promise<Object>} - Refund
   */
  async refundPayment(providerCode, paymentId, data) {
    const provider = this.getProvider(providerCode);
    return provider.refundPayment(paymentId, data);
  }

  /**
   * Cancel withdrawal
   * @param {String} providerCode - Provider code
   * @param {String} withdrawalId - Withdrawal ID
   * @returns {Promise<Object>} - Cancelled withdrawal
   */
  async cancelWithdrawal(providerCode, withdrawalId) {
    const provider = this.getProvider(providerCode);
    return provider.cancelWithdrawal(withdrawalId);
  }

  /**
   * Verify webhook signature
   * @param {String} providerCode - Provider code
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @param {String} timestamp - Webhook timestamp
   * @returns {Object} - Verification result
   */
  verifyWebhook(providerCode, payload, signature, timestamp) {
    const provider = this.getProvider(providerCode);
    return provider.verifyWebhook(payload, signature, timestamp);
  }

  /**
   * Process webhook event
   * @param {String} providerCode - Provider code
   * @param {Object} event - Webhook event
   * @returns {Object} - Processed event
   */
  processWebhookEvent(providerCode, event) {
    const provider = this.getProvider(providerCode);
    return provider.processWebhookEvent(event);
  }

  /**
   * Calculate payment fee
   * @param {String} providerCode - Provider code
   * @param {Number} amount - Payment amount
   * @param {String} currency - Currency
   * @returns {Number} - Fee amount
   */
  calculateFee(providerCode, amount, currency) {
    const provider = this.getProvider(providerCode);
    return provider.calculateFee(amount, currency);
  }

  /**
   * Get provider details
   * @param {String} providerCode - Provider code
   * @returns {Object} - Provider details
   */
  getProviderDetails(providerCode) {
    const provider = this.getProvider(providerCode);
    
    return {
      name: provider.name,
      code: provider.code,
      supportedCountries: provider.getSupportedCountries ? provider.getSupportedCountries() : [],
      supportedCurrencies: provider.getSupportedCurrencies ? provider.getSupportedCurrencies() : []
    };
  }

  /**
   * Get all provider details
   * @returns {Array} - All provider details
   */
  getAllProviderDetails() {
    return Object.keys(this.providers).map(code => this.getProviderDetails(code));
  }
}

module.exports = new ProviderFactory();