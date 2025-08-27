/**
 * Custom error for generation-related issues
 */
class GenerationError extends Error {
  /**
   * Create a new GenerationError
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'GenerationError';
    this.code = code;
  }
}

module.exports = {
  GenerationError
};