const { validateRequest } = require('../../middleware/validateRequest');
const { body, param, query } = require('express-validator');

describe('Validate Request Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    test('should pass validation with valid data', async () => {
      // Set up request with valid data
      req.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      // Create validation rules
      const validationRules = [
        body('email').isEmail().withMessage('Invalid email address'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect next to be called without errors
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should return validation errors with invalid data', async () => {
      // Set up request with invalid data
      req.body = {
        email: 'invalid-email',
        password: 'short',
      };

      // Create validation rules
      const validationRules = [
        body('email').isEmail().withMessage('Invalid email address'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect validation errors
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Invalid email address',
            param: 'email',
            value: 'invalid-email',
          }),
          expect.objectContaining({
            msg: 'Password must be at least 8 characters',
            param: 'password',
            value: 'short',
          }),
        ]),
      });
    });

    test('should validate URL parameters', async () => {
      // Set up request with invalid params
      req.params = {
        id: 'invalid-id',
      };

      // Create validation rules
      const validationRules = [
        param('id').isMongoId().withMessage('Invalid ID format'),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect validation errors
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Invalid ID format',
            param: 'id',
            value: 'invalid-id',
          }),
        ]),
      });
    });

    test('should validate query parameters', async () => {
      // Set up request with invalid query
      req.query = {
        page: 'abc',
        limit: -5,
      };

      // Create validation rules
      const validationRules = [
        query('page').isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').isInt({ min: 1 }).withMessage('Limit must be a positive integer'),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect validation errors
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Page must be a positive integer',
            param: 'page',
            value: 'abc',
          }),
          expect.objectContaining({
            msg: 'Limit must be a positive integer',
            param: 'limit',
            value: -5,
          }),
        ]),
      });
    });

    test('should handle optional fields correctly', async () => {
      // Set up request with only required fields
      req.body = {
        email: 'test@example.com',
      };

      // Create validation rules with optional field
      const validationRules = [
        body('email').isEmail().withMessage('Invalid email address'),
        body('name').optional().isString().withMessage('Name must be a string'),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect next to be called without errors
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    test('should handle custom validation logic', async () => {
      // Set up request with data to validate
      req.body = {
        password: 'password123',
        confirmPassword: 'password456', // Doesn't match
      };

      // Create validation rules with custom validation
      const validationRules = [
        body('password')
          .isLength({ min: 8 })
          .withMessage('Password must be at least 8 characters'),
        body('confirmPassword')
          .custom((value, { req }) => {
            if (value !== req.body.password) {
              throw new Error('Passwords do not match');
            }
            return true;
          }),
      ];

      // Create validation middleware
      const validationMiddleware = validateRequest(validationRules);

      // Call middleware
      await validationMiddleware(req, res, next);

      // Expect validation errors
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: expect.arrayContaining([
          expect.objectContaining({
            msg: 'Passwords do not match',
            param: 'confirmPassword',
            value: 'password456',
          }),
        ]),
      });
    });
  });
});