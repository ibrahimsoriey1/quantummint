// Test setup file for Payment Integration Service
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/quantummint_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
process.env.ORANGE_MONEY_API_KEY = 'test_orange_key';
process.env.AFRIMONEY_API_KEY = 'test_afrimoney_key';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies
const mockSchema = function(definition) {
  this.methods = {};
  this.statics = {};
  this.pre = jest.fn();
  this.post = jest.fn();
  this.virtual = jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn()
  }));
  return this;
};

mockSchema.Types = {
  ObjectId: String
};

const mockMongoose = {
  Schema: mockSchema,
  model: jest.fn(() => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    save: jest.fn()
  })),
  connect: jest.fn(),
  connection: {
    on: jest.fn(),
    once: jest.fn()
  }
};

mockMongoose.Schema.Types = mockSchema.Types;

jest.mock('mongoose', () => mockMongoose);

jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn()
    },
    refunds: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

jest.mock('axios');

// Global test timeout
jest.setTimeout(10000);
