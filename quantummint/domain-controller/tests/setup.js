const mongoose = require('mongoose');

// Mock external dependencies
jest.mock('ldapjs', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, callback) => callback && callback()),
    bind: jest.fn(),
    search: jest.fn(),
    add: jest.fn(),
    modify: jest.fn(),
    del: jest.fn(),
    close: jest.fn()
  })),
  createClient: jest.fn(() => ({
    bind: jest.fn(),
    search: jest.fn(),
    unbind: jest.fn()
  }))
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    flushdb: jest.fn().mockResolvedValue('OK')
  }))
}));

jest.mock('dns2', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock mongoose connection
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(),
  connection: {
    close: jest.fn().mockResolvedValue(),
    readyState: 1
  },
  Schema: jest.fn().mockImplementation((definition) => ({
    methods: {},
    statics: {},
    pre: jest.fn(),
    post: jest.fn(),
    plugin: jest.fn(),
    index: jest.fn()
  })),
  model: jest.fn().mockImplementation((name) => {
    const MockModel = function(data) {
      Object.assign(this, data);
      this._id = 'mock-id';
      this.save = jest.fn().mockResolvedValue(this);
      this.remove = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue(this);
    };
    
    MockModel.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    });
    
    MockModel.findOne = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    MockModel.create = jest.fn().mockResolvedValue(new MockModel());
    MockModel.findOneAndUpdate = jest.fn().mockResolvedValue(new MockModel());
    MockModel.findByIdAndUpdate = jest.fn().mockResolvedValue(new MockModel());
    MockModel.findOneAndDelete = jest.fn().mockResolvedValue(new MockModel());
    MockModel.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
    MockModel.countDocuments = jest.fn().mockResolvedValue(0);
    MockModel.aggregate = jest.fn().mockResolvedValue([]);
    
    return MockModel;
  })
}));

// Setup test environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/quantummint-dc-test';
  process.env.REDIS_URL = 'redis://localhost:6379/15';
  process.env.LOG_LEVEL = 'error';
});

afterAll(async () => {
  // Cleanup
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});
