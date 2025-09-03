const crypto = require('crypto');

/**
 * Field encryption utilities for sensitive data
 */
class FieldEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment or generate one
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();
    
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('Warning: Using generated encryption key. Set ENCRYPTION_KEY environment variable for production.');
    }
  }

  /**
   * Generate a random encryption key
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Encrypt a field value
   */
  encrypt(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('quantummint', 'utf8'));
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
      
      return combined;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt field');
    }
  }

  /**
   * Decrypt a field value
   */
  decrypt(encryptedValue) {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }

    try {
      const parts = encryptedValue.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted value format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('quantummint', 'utf8'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt field');
    }
  }

  /**
   * Hash a value (one-way encryption)
   */
  hash(value, salt = null) {
    if (!value || typeof value !== 'string') {
      return value;
    }

    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(value, actualSalt, 10000, 64, 'sha512').toString('hex');
    
    return {
      hash: hash,
      salt: actualSalt
    };
  }

  /**
   * Verify a hashed value
   */
  verifyHash(value, hash, salt) {
    if (!value || !hash || !salt) {
      return false;
    }

    try {
      const testHash = crypto.pbkdf2Sync(value, salt, 10000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure random string
   */
  generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Encrypt sensitive fields in a document
   */
  encryptDocument(document, fieldsToEncrypt) {
    const encryptedDoc = { ...document };
    
    for (const field of fieldsToEncrypt) {
      if (encryptedDoc[field]) {
        encryptedDoc[field] = this.encrypt(encryptedDoc[field]);
      }
    }
    
    return encryptedDoc;
  }

  /**
   * Decrypt sensitive fields in a document
   */
  decryptDocument(document, fieldsToDecrypt) {
    const decryptedDoc = { ...document };
    
    for (const field of fieldsToDecrypt) {
      if (decryptedDoc[field]) {
        try {
          decryptedDoc[field] = this.decrypt(decryptedDoc[field]);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Keep the encrypted value if decryption fails
        }
      }
    }
    
    return decryptedDoc;
  }

  /**
   * Get fields that should be encrypted for each collection
   */
  getEncryptedFields(collectionName) {
    const encryptedFields = {
      users: ['passwordHash', 'salt', 'idVerification.idNumber', 'twoFactorSecret'],
      payment_providers: ['credentials.clientSecret', 'credentials.apiKey', 'credentials.privateKey', 'webhookSecret'],
      kyc_verifications: ['documentNumber'],
      system_configurations: [] // Will be determined by isEncrypted flag
    };
    
    return encryptedFields[collectionName] || [];
  }

  /**
   * Create a Mongoose pre-save hook for encryption
   */
  createEncryptionHook(collectionName) {
    const fieldsToEncrypt = this.getEncryptedFields(collectionName);
    
    return function(next) {
      if (fieldsToEncrypt.length > 0) {
        for (const field of fieldsToEncrypt) {
          if (this[field] && typeof this[field] === 'string') {
            this[field] = this.constructor.encryptField(this[field]);
          }
        }
      }
      next();
    };
  }

  /**
   * Create a Mongoose post-find hook for decryption
   */
  createDecryptionHook(collectionName) {
    const fieldsToDecrypt = this.getEncryptedFields(collectionName);
    
    return function(docs) {
      if (Array.isArray(docs)) {
        docs.forEach(doc => {
          for (const field of fieldsToDecrypt) {
            if (doc[field] && typeof doc[field] === 'string') {
              try {
                doc[field] = this.constructor.decryptField(doc[field]);
              } catch (error) {
                console.error(`Failed to decrypt field ${field}:`, error);
              }
            }
          }
        });
      } else if (docs) {
        for (const field of fieldsToDecrypt) {
          if (docs[field] && typeof docs[field] === 'string') {
            try {
              docs[field] = this.constructor.decryptField(docs[field]);
            } catch (error) {
              console.error(`Failed to decrypt field ${field}:`, error);
            }
          }
        }
      }
    };
  }
}

module.exports = new FieldEncryption();
