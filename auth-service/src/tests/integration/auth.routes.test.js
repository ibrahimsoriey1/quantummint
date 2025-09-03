const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const User = require('../../models/user.model');
const Token = require('../../models/token.model');
const TwoFactorAuth = require('../../models/twoFactor.model');
const { sendEmail } = require('../../utils/email');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock dependencies
jest.mock('../../utils/email');
jest.mock('../../config/redis', () => ({
  client: {
    connect: jest.fn().mockResolvedValue(true),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  },
}));

describe('Auth Routes', () => {
  let server;
  let testUser;
  let testToken;

  beforeAll(async () => {
    // Connect to a test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummint-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    server = app.listen(0); // Use any available port
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await server.close();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    await User.deleteMany({});
    await Token.deleteMany({});
    await TwoFactorAuth.deleteMany({});
    
    // Create a test user
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: hashedPassword,
      phoneNumber: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      isVerified: true,
    });
    
    // Create a test token
    testToken = await Token.create({
      userId: testUser._id,
      token: 'test-token',
      type: 'email-verification',
    });
    
    // Mock sendEmail to resolve successfully
    sendEmail.mockResolvedValue(true);
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: 'newuser@example.com',
          password: 'Password123!',
          phoneNumber: '+1987654321',
          dateOfBirth: '1995-05-15',
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
      });
      
      // Verify user was created in the database
      const user = await User.findOne({ email: 'newuser@example.com' });
      expect(user).toBeTruthy();
      expect(user.firstName).toBe('New');
      expect(user.lastName).toBe('User');
      expect(user.isVerified).toBe(false);
      
      // Verify token was created
      const token = await Token.findOne({ userId: user._id, type: 'email-verification' });
      expect(token).toBeTruthy();
      
      // Verify email was sent
      expect(sendEmail).toHaveBeenCalled();
    });
    
    test('should return error if email already exists', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Duplicate',
          lastName: 'User',
          email: 'test@example.com', // Already exists
          password: 'Password123!',
          phoneNumber: '+1987654321',
          dateOfBirth: '1995-05-15',
        });
      
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        message: 'Email already in use',
      });
    });
    
    test('should return validation errors for invalid input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: '',
          lastName: '',
          email: 'invalid-email',
          password: 'short',
          phoneNumber: '',
          dateOfBirth: 'invalid-date',
        });
      
      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeTruthy();
      expect(response.body.user).toBeTruthy();
      expect(response.body.user.email).toBe('test@example.com');
    });
    
    test('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid email or password',
      });
    });
    
    test('should return error for unverified account', async () => {
      // Create an unverified user
      await User.findByIdAndUpdate(testUser._id, { isVerified: false });
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        message: 'Please verify your email before logging in',
      });
    });
  });

  describe('GET /api/auth/verify-email/:token', () => {
    test('should verify email successfully', async () => {
      const response = await request(app)
        .get(`/api/auth/verify-email/${testToken.token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Email verified successfully. You can now log in.',
      });
      
      // Verify user is now verified
      const user = await User.findById(testUser._id);
      expect(user.isVerified).toBe(true);
      
      // Verify token was deleted
      const token = await Token.findById(testToken._id);
      expect(token).toBeNull();
    });
    
    test('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email/invalid-token');
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid or expired verification token',
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should send password reset email successfully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'test@example.com',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password reset instructions sent to your email',
      });
      
      // Verify token was created
      const token = await Token.findOne({ userId: testUser._id, type: 'password-reset' });
      expect(token).toBeTruthy();
      
      // Verify email was sent
      expect(sendEmail).toHaveBeenCalled();
    });
    
    test('should return success even if email does not exist (for security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password reset instructions sent to your email',
      });
      
      // Verify no token was created
      const token = await Token.findOne({ type: 'password-reset', userId: { $ne: testUser._id } });
      expect(token).toBeNull();
    });
  });

  describe('POST /api/auth/reset-password/:token', () => {
    let resetToken;
    
    beforeEach(async () => {
      // Create a password reset token
      resetToken = await Token.create({
        userId: testUser._id,
        token: 'reset-token',
        type: 'password-reset',
      });
    });
    
    test('should reset password successfully', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password/${resetToken.token}`)
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.',
      });
      
      // Verify password was updated
      const user = await User.findById(testUser._id);
      const passwordMatch = await bcrypt.compare('NewPassword123!', user.password);
      expect(passwordMatch).toBe(true);
      
      // Verify token was deleted
      const token = await Token.findById(resetToken._id);
      expect(token).toBeNull();
    });
    
    test('should return error for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password/invalid-token')
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: 'Invalid or expired password reset token',
      });
    });
    
    test('should return error if passwords do not match', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password/${resetToken.token}`)
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });
      
      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });
  });

  // Additional test cases for other routes can be added here
});