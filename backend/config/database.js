const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const logger = require('../utils/logger');

let db = null;

const connectDatabase = async () => {
  try {
    const { getFirebaseApp } = require('./firebase');
    const app = getFirebaseApp();
    db = getFirestore(app);

    await db.collection('_health').doc('check').set({
      timestamp: new Date().toISOString(),
      status: 'ok'
    }, { merge: true });

    logger.info('✅ Firestore database connected successfully');
    return db;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return db;
};

module.exports = {
  connectDatabase,
  getDatabase
};