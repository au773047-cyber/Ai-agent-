const { initializeApp, getApps, getApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const logger = require('../utils/logger');

let app = null;

const initializeFirebase = () => {
  try {
    if (getApps().length > 0) {
      app = getApp();
      logger.info('Firebase already initialized');
      return app;
    }

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    app = initializeApp({
      credential: require('firebase-admin').credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    logger.info('✅ Firebase Admin initialized successfully');
    return app;
  } catch (error) {
    logger.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

const getFirebaseApp = () => {
  if (!app) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return app;
};

const getFirebaseAuth = () => {
  return getAuth(getFirebaseApp());
};

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  getFirebaseAuth
};