const { errorHandler, ApiError } = require('../../middleware/errorHandler');
const { logger } = require('../../utils/logger');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock process.env
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Reset process.env
    delete process.env.NODE_ENV;
  });

  describe('ApiError', () => {
    test('should create an ApiError with the correct properties', () => {
      const error = new ApiError(400, 'Bad request', true);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    test('should create an ApiError with custom stack', () => {
      const customStack = 'Custom stack trace';
      const error = new ApiError(400, 'Bad request', true, customStack);
      
      expect(error.stack).toBe(customStack);
    });
  });

  describe('errorHandler', () => {
    test('should handle ApiError correctly', () => {
      const error = new ApiError(400, 'Bad request');
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Bad request'));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: 'Bad request',
        stack: expect.any(String),
      });
    });

    test('should handle ValidationError correctly', () => {
      const error = new Error('Validation error');
      error.name = 'ValidationError';
      error.errors = {
        field1: { message: 'Field1 is required' },
        field2: { message: 'Field2 is invalid' },
      };
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Validation error'));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: 'Field1 is required, Field2 is invalid',
        stack: expect.any(String),
      });
    });

    test('should handle CastError correctly', () => {
      const error = new Error('Cast error');
      error.name = 'CastError';
      error.path = 'id';
      error.value = 'invalid-id';
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Cast error'));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 400,
        message: 'Invalid id: invalid-id',
        stack: expect.any(String),
      });
    });

    test('should handle duplicate key error correctly', () => {
      const error = new Error('Duplicate key error');
      error.code = 11000;
      error.keyValue = { email: 'test@example.com' };
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Duplicate key error'));
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 409,
        message: 'Duplicate field value entered: {"email":"test@example.com"}',
        stack: expect.any(String),
      });
    });

    test('should handle JWT error correctly', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid token'));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: 'Invalid token. Please log in again.',
        stack: expect.any(String),
      });
    });

    test('should handle token expired error correctly', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Token expired'));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 401,
        message: 'Your token has expired. Please log in again.',
        stack: expect.any(String),
      });
    });

    test('should handle generic error correctly', () => {
      const error = new Error('Generic error');
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Generic error'));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 500,
        message: 'Generic error',
        stack: expect.any(String),
      });
    });

    test('should not include stack trace in production', () => {
      // Set NODE_ENV to production
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Production error');
      
      errorHandler(error, req, res, next);
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Production error'));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 500,
        message: 'Production error',
        stack: undefined,
      });
    });
  });
});