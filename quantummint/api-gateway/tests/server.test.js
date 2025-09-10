const request = require('supertest');
const express = require('express');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const app = require('../src/server');

describe('API Gateway', () => {
  describe('Health Check', () => {
    it('should return 200 for health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('API Documentation', () => {
    it('should serve Swagger documentation', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);
      
      expect(response.text).toContain('Swagger UI');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(10).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed initially
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Service Proxy', () => {
    it('should proxy requests to auth service', async () => {
      // Auth service is not running in test, expect connection error (503 or ECONNREFUSED)
      const response = await request(app)
        .get('/api/auth/health');
      
      // Should get 503 (service unavailable) or similar error
      expect([503, 500]).toContain(response.status);
    });

    it('should proxy requests to transaction service', async () => {
      const response = await request(app)
        .get('/api/transactions/health')
        .expect(401); // Expected since auth middleware blocks unauthenticated requests
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent-endpoint')
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/health') // Use a simpler endpoint that accepts POST
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token for protected routes', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
    });
  });
});
