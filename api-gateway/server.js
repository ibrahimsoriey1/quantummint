require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const PORT = process.env.PORT || 3000;
const http = require('http').createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3006', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Auth middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Health
app.get('/health', (_req, res) => res.json({ status: 'OK', service: 'API Gateway' }));

// Swagger (optional minimal placeholder)
try {
  const swaggerDocument = YAML.load(__dirname + '/swagger.yaml');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) { /* ignore */ }

// Upstream services
const targets = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  money: process.env.MONEY_GENERATION_SERVICE_URL || 'http://localhost:3002',
  transaction: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:3003',
  payment: process.env.PAYMENT_INTEGRATION_SERVICE_URL || 'http://localhost:3004',
  kyc: process.env.KYC_SERVICE_URL || 'http://localhost:3005'
};

app.use('/api/v1/auth', createProxyMiddleware({ target: targets.auth, changeOrigin: true }));
app.use('/api/v1/users', createProxyMiddleware({ target: targets.auth, changeOrigin: true }));
app.use('/api/v1/2fa', createProxyMiddleware({ target: targets.auth, changeOrigin: true }));

app.use('/api/v1/generation', authenticateJWT, createProxyMiddleware({ target: targets.money, changeOrigin: true }));
app.use('/api/v1/wallet', authenticateJWT, createProxyMiddleware({ target: targets.money, changeOrigin: true }));
app.use('/api/v1/algorithm', authenticateJWT, createProxyMiddleware({ target: targets.money, changeOrigin: true }));
app.use('/api/v1/stats', authenticateJWT, createProxyMiddleware({ target: targets.money, changeOrigin: true }));

app.use('/api/v1/transactions', authenticateJWT, createProxyMiddleware({ target: targets.transaction, changeOrigin: true }));
app.use('/api/v1/balance', authenticateJWT, createProxyMiddleware({ target: targets.transaction, changeOrigin: true }));
app.use('/api/v1/fees', authenticateJWT, createProxyMiddleware({ target: targets.transaction, changeOrigin: true }));
app.use('/api/v1/compliance', authenticateJWT, createProxyMiddleware({ target: targets.transaction, changeOrigin: true }));

app.use('/api/v1/payments', authenticateJWT, createProxyMiddleware({ target: targets.payment, changeOrigin: true }));
app.use('/api/v1/webhooks', createProxyMiddleware({ target: targets.payment, changeOrigin: true }));
app.use('/api/v1/settlements', authenticateJWT, createProxyMiddleware({ target: targets.payment, changeOrigin: true }));
app.use('/api/v1/providers', authenticateJWT, createProxyMiddleware({ target: targets.payment, changeOrigin: true }));
app.use('/api/v1/exchange-rates', authenticateJWT, createProxyMiddleware({ target: targets.payment, changeOrigin: true }));
app.use('/api/v1/fraud-detection', authenticateJWT, createProxyMiddleware({ target: targets.payment, changeOrigin: true }));

app.use('/api/v1/kyc', authenticateJWT, createProxyMiddleware({ target: targets.kyc, changeOrigin: true }));
app.use('/api/v1/documents', authenticateJWT, createProxyMiddleware({ target: targets.kyc, changeOrigin: true }));
app.use('/api/v1/verification', authenticateJWT, createProxyMiddleware({ target: targets.kyc, changeOrigin: true }));
app.use('/api/v1/admin', authenticateJWT, createProxyMiddleware({ target: targets.kyc, changeOrigin: true }));

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Websocket proxy endpoints
// Note: http-proxy-middleware supports ws for WS upgrades
const { createProxyServer } = require('http-proxy');
const wsProxy = createProxyServer({});
http.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws/payments')) {
    wsProxy.ws(req, socket, head, { target: targets.payment, ws: true });
  } else if (req.url.startsWith('/ws/kyc')) {
    wsProxy.ws(req, socket, head, { target: targets.kyc, ws: true });
  } else {
    socket.destroy();
  }
});

http.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API Gateway listening on ${PORT}`);
});


