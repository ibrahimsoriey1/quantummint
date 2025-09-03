const crypto = require('crypto');

const requestIdHeaderName = 'x-request-id';

const requestIdMiddleware = (req, res, next) => {
  const existingId = req.headers[requestIdHeaderName];
  const requestId = existingId && typeof existingId === 'string' ? existingId : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader(requestIdHeaderName, requestId);
  next();
};

module.exports = {
  requestIdHeaderName,
  requestIdMiddleware
};


