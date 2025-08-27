/**
 * Custom error for transaction-related issues
 */
class TransactionError extends Error {
  /**
   * Create a new TransactionError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
  }
}

/**
 * Custom error for wallet-related issues
 */
class WalletError extends Error {
  /**
   * Create a new WalletError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

module.exports = {
  TransactionError,
  WalletError
};