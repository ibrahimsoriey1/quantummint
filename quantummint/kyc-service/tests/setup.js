// Test setup file for KYC Service
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/quantummint_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.FILE_UPLOAD_PATH = './test-uploads';
process.env.MAX_FILE_SIZE = '5242880'; // 5MB
process.env.COMPLIANCE_API_KEY = 'test-compliance-key';
process.env.LOG_LEVEL = 'error';

// Mock external dependencies
const mockSchema = function(definition) {
  this.methods = {};
  this.statics = {};
  this.pre = jest.fn();
  this.post = jest.fn();
  this.index = jest.fn();
  this.plugin = jest.fn();
  this.set = jest.fn();
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

// Ensure Schema.Types is accessible from the main mongoose object
mockMongoose.Schema.Types = mockSchema.Types;

jest.mock('mongoose', () => mockMongoose);

jest.mock('multer', () => {
  return jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        filename: 'test-file.jpg',
        path: '/test/path/test-file.jpg',
        mimetype: 'image/jpeg',
        size: 1024000
      };
      next();
    }),
    array: jest.fn(() => (req, res, next) => {
      req.files = [
        {
          filename: 'test-file1.jpg',
          path: '/test/path/test-file1.jpg',
          mimetype: 'image/jpeg',
          size: 1024000
        }
      ];
      next();
    })
  }));
});

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue()
  },
  existsSync: jest.fn().mockReturnValue(true),
  stat: jest.fn((path, callback) => {
    if (typeof callback === 'function') {
      callback(null, {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024
      });
    }
  }),
  createWriteStream: jest.fn(() => {
    const mockStream = {
      write: jest.fn(),
      end: jest.fn(),
      emit: jest.fn(),
      destroy: jest.fn(),
      pipe: jest.fn(),
      unpipe: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      setEncoding: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'open' && typeof callback === 'function') {
          setImmediate(callback);
        }
        return mockStream;
      }),
      once: jest.fn((event, callback) => {
        if (typeof callback === 'function') {
          setImmediate(callback);
        }
        return mockStream;
      }),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      addListener: jest.fn()
    };
    return mockStream;
  })
}));

jest.mock('axios');

// Global test timeout
jest.setTimeout(10000);
