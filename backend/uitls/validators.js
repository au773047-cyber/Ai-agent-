const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      })),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

const authValidators = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('displayName').trim().isLength({ min: 2, max: 50 }).withMessage('Display name must be 2-50 characters'),
    body('language').optional().isIn(['en', 'ha', 'ar']).withMessage('Language must be en, ha, or ar'),
    handleValidationErrors
  ],
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
  ]
};

const chatValidators = {
  sendMessage: [
    body('message').trim().isLength({ min: 1, max: 4000 }).withMessage('Message must be 1-4000 characters'),
    body('conversationId').optional().isUUID().withMessage('Invalid conversation ID'),
    body('language').optional().isIn(['en', 'ha', 'ar']).withMessage('Invalid language'),
    handleValidationErrors
  ]
};

const fileValidators = {
  upload: [
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'),
    handleValidationErrors
  ]
};

const searchValidators = {
  webSearch: [
    body('query').trim().isLength({ min: 1, max: 500 }).withMessage('Search query must be 1-500 characters'),
    body('numResults').optional().isInt({ min: 1, max: 20 }).withMessage('Results must be 1-20'),
    handleValidationErrors
  ]
};

const memoryValidators = {
  save: [
    body('key').trim().isLength({ min: 1, max: 100 }).withMessage('Key must be 1-100 characters'),
    body('value').notEmpty().withMessage('Value is required'),
    body('type').optional().isIn(['user_preference', 'fact', 'conversation_context', 'custom']).withMessage('Invalid memory type'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  authValidators,
  chatValidators,
  fileValidators,
  searchValidators,
  memoryValidators
};