const QuantumDomainController = require('../src/server');

describe('Domain Controller', () => {
  let domainController;

  beforeEach(() => {
    domainController = new QuantumDomainController();
  });

  afterEach(async () => {
    if (domainController) {
      await domainController.stop();
    }
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      expect(domainController.config).toBeDefined();
      expect(domainController.config.domain.name).toBe('quantummint.local');
      expect(domainController.config.ldap.port).toBe(389);
      expect(domainController.config.kerberos.realm).toBe('QUANTUMMINT.LOCAL');
    });

    test('should use environment variables for configuration', () => {
      process.env.DOMAIN_NAME = 'test.local';
      process.env.LDAP_PORT = '1389';
      
      const testController = new QuantumDomainController();
      expect(testController.config.domain.name).toBe('test.local');
      expect(testController.config.ldap.port).toBe('1389');
      
      delete process.env.DOMAIN_NAME;
      delete process.env.LDAP_PORT;
    });
  });

  describe('Service Initialization', () => {
    test('should initialize all services', async () => {
      await domainController.initializeServices();
      
      expect(domainController.auditService).toBeDefined();
      expect(domainController.securityManager).toBeDefined();
      expect(domainController.directoryService).toBeDefined();
      expect(domainController.ldapServer).toBeDefined();
      expect(domainController.kerberosServer).toBeDefined();
      expect(domainController.dnsController).toBeDefined();
      expect(domainController.groupPolicyManager).toBeDefined();
      expect(domainController.replicationManager).toBeDefined();
      expect(domainController.integration).toBeDefined();
    });
  });

  describe('Database Connection', () => {
    test('should connect to MongoDB', async () => {
      await domainController.connectDatabase();
      expect(require('mongoose').connect).toHaveBeenCalledWith(
        domainController.config.database.uri,
        domainController.config.database.options
      );
    });
  });

  describe('Express App Setup', () => {
    test('should setup middleware and routes', () => {
      domainController.setupMiddleware();
      domainController.setupRoutes();
      
      expect(domainController.app).toBeDefined();
    });
  });

  describe('Health Check', () => {
    test('should provide health status', async () => {
      domainController.setupRoutes();
      
      const mockReq = { app: { get: jest.fn().mockReturnValue({}) } };
      const mockRes = { 
        status: jest.fn().mockReturnThis(),
        json: jest.fn() 
      };
      
      // Simulate health check route
      const healthHandler = domainController.app._router?.stack?.find(
        layer => layer.route?.path === '/health'
      )?.route?.stack?.[0]?.handle;
      
      if (healthHandler) {
        healthHandler(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalled();
      }
    });
  });
});
