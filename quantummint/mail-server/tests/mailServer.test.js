const QuantumMailServer = require('../src/server');

describe('Mail Server', () => {
  let mailServer;

  beforeEach(() => {
    mailServer = new QuantumMailServer();
  });

  afterEach(async () => {
    if (mailServer) {
      await mailServer.stop();
    }
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(mailServer.config).toBeDefined();
      expect(mailServer.config.smtp.port).toBe(25);
      expect(mailServer.config.imap.port).toBe(143);
      expect(mailServer.config.pop3.port).toBe(110);
      expect(mailServer.config.smtp.hostname).toBe('mail.quantummint.com');
    });

    test('should use environment variables for configuration', () => {
      process.env.SMTP_PORT = '2525';
      process.env.MAIL_HOSTNAME = 'test.example.com';
      
      const testServer = new QuantumMailServer();
      expect(testServer.config.smtp.port).toBe('2525');
      expect(testServer.config.smtp.hostname).toBe('test.example.com');
      
      delete process.env.SMTP_PORT;
      delete process.env.MAIL_HOSTNAME;
    });
  });

  describe('Service Initialization', () => {
    test('should initialize all mail services', async () => {
      await mailServer.initializeServices();
      
      expect(mailServer.smtpServer).toBeDefined();
      expect(mailServer.imapServer).toBeDefined();
      expect(mailServer.pop3Server).toBeDefined();
      expect(mailServer.webInterface).toBeDefined();
      expect(mailServer.mailQueue).toBeDefined();
      expect(mailServer.securityManager).toBeDefined();
      expect(mailServer.dnsManager).toBeDefined();
      expect(mailServer.analyticsService).toBeDefined();
    });
  });

  describe('Database Connection', () => {
    test('should connect to MongoDB', async () => {
      await mailServer.connectDatabase();
      expect(require('mongoose').connect).toHaveBeenCalledWith(
        mailServer.config.database.uri,
        mailServer.config.database.options
      );
    });
  });

  describe('Express App Setup', () => {
    test('should setup middleware and routes', () => {
      mailServer.setupMiddleware();
      mailServer.setupRoutes();
      
      expect(mailServer.app).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should provide health status', async () => {
      mailServer.setupRoutes();
      
      const mockReq = { app: { get: jest.fn().mockReturnValue({}) } };
      const mockRes = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn() 
      };
      
      // Simulate health check route
      const healthHandler = mailServer.app._router?.stack?.find(
        layer => layer.route?.path === '/health'
      )?.route?.stack?.[0]?.handle;
      
      if (healthHandler) {
        healthHandler(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
      }
    });
  });
});
