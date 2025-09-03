// Mock for jsonwebtoken
const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockImplementation((token, secret, callback) => {
    if (token === 'valid-token') {
      return { id: 'user-id', email: 'test@example.com', role: 'user' };
    } else if (token === 'expired-token') {
      throw new Error('jwt expired');
    } else {
      throw new Error('invalid token');
    }
  }),
};

module.exports = {
  mockJwt,
};