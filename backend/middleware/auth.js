const jwt = require('jsonwebtoken');
const { getFirebaseAuth } = require('../config/firebase');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const auth = getFirebaseAuth();
    const firebaseUser = await auth.getUser(decoded.uid);

    if (!firebaseUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const db = getDatabase();
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        success: false,
        message: 'User data not found',
        code: 'USER_DATA_NOT_FOUND'
      });
    }

    const userData = userDoc.data();

    if (userData.status === 'suspended' || userData.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'Account has been suspended',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    req.user = {
      uid: decoded.uid,
      email: firebaseUser.email,
      displayName: userData.displayName || firebaseUser.displayName,
      role: userData.role || 'user',
      language: userData.language || 'en',
      plan: userData.plan || 'free',
      ...userData
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        yourRole: req.user.role
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};