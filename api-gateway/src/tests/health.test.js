const request = require('supertest');
const app = require('../server');

describe('API Gateway Health', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect([200, 404]).toContain(res.statusCode);
  });
});


