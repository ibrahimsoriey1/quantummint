const { authenticate, authorize } = require('../../middleware/authenticate');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../../middleware/errorHandler');

// Mock dependencies
jest.mock('jsonwebtoken');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    test('should authenticate user with valid token', () => {
      // Mock jwt.verify to return a decoded token
      jwt.verify.mockImplementation((token, secret, callback) => {
        return {
          id: 'user-id',
          email: 'test@example.com',
          role: 'user',
        };
      });

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET, expect.any(Function));
      expect(req.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'user',
      });
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(ApiError));
    });

    test('should return error if no authorization header', () => {
      // Remove authorization header
      req.headers = {};

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Authentication required. Please log in.',
      }));
    });

    test('should return error if authorization header is not Bearer', () => {
      // Set invalid authorization header
      req.headers.authorization = 'Basic invalid-token';

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Authentication required. Please log in.',
      }));
    });

    test('should return error if token is invalid', () => {
      // Mock jwt.verify to throw an error
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Invalid token. Please log in again.',
      }));
    });

    test('should return error if token is expired', () => {
      // Mock jwt.verify to throw a TokenExpiredError
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Your token has expired. Please log in again.',
      }));
    });
  });

  describe('authorize', () => {
    beforeEach(() => {
      // Set up req.user for authorization tests
      req.user = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'user',
      };
    });

    test('should authorize user with required role', () => {
      // Create authorize middleware for 'user' role
      const authorizeUser = authorize(['user', 'admin']);

      authorizeUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(ApiError));
    });

    test('should authorize user with admin role', () => {
      // Set user role to admin
      req.user.role = 'admin';

      // Create authorize middleware for 'user' role
      const authorizeUser = authorize(['user']);

      authorizeUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(ApiError));
    });

    test('should not authorize user with insufficient role', () => {
      // Create authorize middleware for 'admin' role
      const authorizeAdmin = authorize(['admin']);

      authorizeAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: 'You do not have permission to access this resource',
      }));
    });

    test('should not authorize if user is not authenticated', () => {
      // Remove user from request
      delete req.user;

      // Create authorize middleware for 'user' role
      const authorizeUser = authorize(['user']);

      authorizeUser(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 401,
        message: 'Authentication required. Please log in.',
      }));
    });
  });
});