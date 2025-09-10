// Test setup file for Auth Service
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/quantummint_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '24h';
process.env.BCRYPT_ROUNDS = '12';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    on: jest.fn(),
    once: jest.fn()
  },
  Schema: jest.fn(),
  model: jest.fn()
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(() => ({
    base32: 'test_secret',
    otpauth_url: 'otpauth://totp/test'
  })),
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test')
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Global test timeout
jest.setTimeout(10000);
