const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message),
      code: 'VALIDATION_ERROR'
    });
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.statusCode).json({
    success: false,
    message: err.isOperational ? err.message : 'Something went wrong',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && {
      stack: err.stack,
      details: err.message
    })
  });
};

module.exports = errorHandler;
module.exports.AppError = AppError;