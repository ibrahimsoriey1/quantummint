const { v4: uuidv4 } = require('uuid');

const requestIdHeaderName = 'x-request-id';

const requestIdMiddleware = (req, res, next) => {
  const existingId = req.headers[requestIdHeaderName];
  const requestId = existingId && typeof existingId === 'string' ? existingId : uuidv4();

  req.requestId = requestId;
  res.setHeader(requestIdHeaderName, requestId);
  next();
};

module.exports = {
  requestIdHeaderName,
  requestIdMiddleware
};


