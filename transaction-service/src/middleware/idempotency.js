const { redisClient } = require('../config/redis');
const { logger } = require('../utils/logger');

const IDEMPOTENCY_HEADER = 'idempotency-key';

const idempotencyMiddleware = (namespace, ttlSeconds = 600) => {
  return async (req, res, next) => {
    try {
      const keyHeader = req.headers[IDEMPOTENCY_HEADER];
      if (!keyHeader || typeof keyHeader !== 'string') {
        return res.status(400).json({ success: false, message: 'Idempotency-Key header is required' });
      }

      const userId = req.user ? req.user.id : 'anonymous';
      const key = `idemp:${namespace}:${userId}:${keyHeader}`;

      // Check if we already have a stored response
      const existing = await redisClient.get(key);
      if (existing) {
        const { statusCode, body } = JSON.parse(existing);
        logger.info(`Idempotency hit for key ${key}`);
        return res.status(statusCode).json(body);
      }

      // Create a processing marker to prevent duplicate processing
      const processingKey = `${key}:processing`;
      const set = await redisClient.set(processingKey, '1', { NX: true, EX: ttlSeconds });
      if (!set) {
        // Another request is processing the same key
        return res.status(409).json({ success: false, message: 'Request with the same Idempotency-Key is already in progress' });
      }

      // Intercept response to store result
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        try {
          const payload = JSON.stringify({ statusCode: res.statusCode, body });
          redisClient.setEx(key, ttlSeconds, payload).catch(err => logger.error(`Idempotency store error: ${err.message}`));
          redisClient.del(processingKey).catch(err => logger.error(`Idempotency del error: ${err.message}`));
        } catch (e) {
          logger.error(`Idempotency serialize error: ${e.message}`);
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error(`Idempotency middleware error: ${error.message}`);
      next();
    }
  };
};

module.exports = { idempotencyMiddleware, IDEMPOTENCY_HEADER };


