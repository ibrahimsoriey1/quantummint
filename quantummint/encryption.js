/**
 * Encryption Utility for QuantumMint
 * Provides end-to-end encryption for sensitive data
 */

const crypto = require('crypto');

/**
 * Encryption Service
 * Handles encryption and decryption of sensitive data
 */
class EncryptionService {
  /**
   * Initialize encryption service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.ivLength = options.ivLength || 16; // 128 bits
    this.tagLength = options.tagLength || 16; // 128 bits
    this.secretKey = options.secretKey || this.generateKey();
  }

  /**
   * Generate a random encryption key
   * @returns {Buffer} Random encryption key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Encrypt data
   * @param {String|Object} data - Data to encrypt
   * @returns {Object} Encrypted data with IV and auth tag
   */
  encrypt(data) {
    try {
      // Convert object to string if needed
      const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
      
      // Encrypt data
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag().toString('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag
      };
    } catch (error) {
      console.error('QuantumMint Encryption Error:', error.message);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   * @param {Object} encryptedData - Object containing encrypted data, IV, and auth tag
   * @returns {String|Object} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.secretKey,
        Buffer.from(iv, 'hex')
      );
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON if possible
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        // Return as string if not valid JSON
        return decrypted;
      }
    } catch (error) {
      console.error('QuantumMint Decryption Error:', error.message);
      throw new Error('Decryption failed: Invalid data or key');
    }
  }

  /**
   * Hash sensitive data (one-way)
   * @param {String} data - Data to hash
   * @param {String} salt - Optional salt
   * @returns {String} Hashed data
   */
  hash(data, salt = null) {
    try {
      // Generate salt if not provided
      const useSalt = salt || crypto.randomBytes(16).toString('hex');
      
      // Create hash
      const hash = crypto.pbkdf2Sync(
        data,
        useSalt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      
      return {
        hash,
        salt: useSalt
      };
    } catch (error) {
      console.error('QuantumMint Hashing Error:', error.message);
      throw new Error('Hashing failed');
    }
  }

  /**
   * Verify hashed data
   * @param {String} data - Data to verify
   * @param {String} hash - Hash to compare against
   * @param {String} salt - Salt used for hashing
   * @returns {Boolean} True if hash matches
   */
  verifyHash(data, hash, salt) {
    try {
      const { hash: newHash } = this.hash(data, salt);
      return newHash === hash;
    } catch (error) {
      console.error('QuantumMint Hash Verification Error:', error.message);
      return false;
    }
  }
}

module.exports = EncryptionService;