// Mock for Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn(),
  expire: jest.fn().mockResolvedValue(1),
  on: jest.fn(),
};

// Mock Redis functions
const mockRedis = {
  createClient: jest.fn().mockReturnValue(mockRedisClient),
};

module.exports = {
  mockRedisClient,
  mockRedis,
};