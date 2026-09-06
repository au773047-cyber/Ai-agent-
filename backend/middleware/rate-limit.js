const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const createCustomLimiter = (windowMs, max, keyPrefix = '') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return `${keyPrefix}:${req.ip}:${req.user?.uid || 'anonymous'}`;
    },
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for ${req.ip}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

const chatLimiter = createCustomLimiter(60 * 1000, 30, 'chat');
const fileUploadLimiter = createCustomLimiter(60 * 60 * 1000, 10, 'upload');
const searchLimiter = createCustomLimiter(60 * 1000, 20, 'search');

module.exports = {
  createCustomLimiter,
  chatLimiter,
  fileUploadLimiter,
  searchLimiter
};