// Test setup file for Transaction Service
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/quantummint_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
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

jest.mock('amqplib', () => ({
  connect: jest.fn(() => ({
    createChannel: jest.fn(() => ({
      assertQueue: jest.fn(),
      sendToQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      close: jest.fn()
    })),
    close: jest.fn()
  }))
}));

// Global test timeout
jest.setTimeout(10000);
