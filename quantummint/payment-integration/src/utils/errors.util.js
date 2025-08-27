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