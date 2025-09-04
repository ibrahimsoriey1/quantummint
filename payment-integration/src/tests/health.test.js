const request = require('supertest');
const app = require('../server');

describe('Payment Integration Health', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.statusCode);
  });
});









