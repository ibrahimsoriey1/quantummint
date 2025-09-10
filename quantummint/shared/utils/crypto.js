const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class CryptoUtils {
  // Generate random token
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure random string
  static generateSecureString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Hash data using SHA-256
  static hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Create HMAC signature
  static createHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Verify HMAC signature
  static verifyHMAC(data, signature, secret) {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Encrypt data using AES-256-GCM
  static encrypt(text, key) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt data using AES-256-GCM
  static decrypt(encryptedData, key) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(
      algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Generate JWT token
  static generateJWT(payload, secret, expiresIn = '24h') {
    return jwt.sign(payload, secret, { expiresIn });
  }

  // Verify JWT token
  static verifyJWT(token, secret) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Generate API key
  static generateAPIKey() {
    const prefix = 'qm_';
    const key = this.generateSecureString(32);
    return prefix + key;
  }

  // Generate transaction ID
  static generateTransactionId() {
    const timestamp = Date.now();
    const random = this.generateSecureString(8);
    return `TXN_${timestamp}_${random}`;
  }

  // Generate wallet address
  static generateWalletAddress(userId) {
    const data = `${userId}_${Date.now()}_${this.generateSecureString(16)}`;
    const hash = this.hash(data);
    return `QM${hash.substring(0, 32).toUpperCase()}`;
  }

  // Validate wallet address
  static isValidWalletAddress(address) {
    return /^QM[A-F0-9]{32}$/.test(address);
  }

  // Generate OTP
  static generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // Generate backup codes
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateSecureString(8).toUpperCase());
    }
    return codes;
  }

  // Create password hash with salt
  static async hashPassword(password, saltRounds = 12) {
    const bcrypt = require('bcryptjs');
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password, hash) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  // Generate secure session ID
  static generateSessionId() {
    return this.generateToken(64);
  }

  // Create digital signature
  static createSignature(data, privateKey) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'hex');
  }

  // Verify digital signature
  static verifySignature(data, signature, publicKey) {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(publicKey, signature, 'hex');
  }

  // Generate key pair for digital signatures
  static generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }
}

module.exports = CryptoUtils;
