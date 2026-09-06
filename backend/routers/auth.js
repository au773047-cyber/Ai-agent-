const express = require('express');
const jwt = require('jsonwebtoken');
const { getFirebaseAuth } = require('../config/firebase');
const { getDatabase } = require('../config/database');
const User = require('../models/User');
const { authValidators } = require('../utils/validators');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/error-handler');

const router = express.Router();

router.post('/register', authValidators.register, async (req, res, next) => {
  try {
    const { email, password, displayName, language = 'en' } = req.body;
    const auth = getFirebaseAuth();

    const firebaseUser = await auth.createUser({ email, password, displayName, emailVerified: false });

    const user = new User({
      uid: firebaseUser.uid, email, displayName, language,
      role: 'user', status: 'active', createdAt: new Date().toISOString()
    });
    await user.save();

    const token = jwt.sign({ uid: firebaseUser.uid, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    logger.info(`User registered: ${email}`);

    res.status(201).json({
      success: true, message: 'Registration successful',
      data: { user: { uid: user.uid, email: user.email, displayName: user.displayName, role: user.role, language: user.language }, token }
    });
  } catch (error) { next(error); }
});

router.post('/login', authValidators.login, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const auth = getFirebaseAuth();
    const firebaseUser = await auth.getUserByEmail(email);

    const db = getDatabase();
    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    if (!userDoc.exists) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const userData = userDoc.data();
    if (userData.status === 'suspended') throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');

    await db.collection('users').doc(firebaseUser.uid).update({ lastLoginAt: new Date().toISOString() });

    const token = jwt.sign({ uid: firebaseUser.uid, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    logger.info(`User logged in: ${email}`);

    res.json({
      success: true, message: 'Login successful',
      data: { user: { uid: firebaseUser.uid, email: firebaseUser.email, displayName: userData.displayName, role: userData.role, language: userData.language, plan: userData.plan }, token }
    });
  } catch (error) { next(error); }
});

router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('No token provided', 401, 'NO_TOKEN');

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.uid);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    res.json({ success: true, data: { user: user.toJSON() } });
  } catch (error) { next(error); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('No token provided', 401, 'NO_TOKEN');

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { displayName, language, preferences } = req.body;

    const user = await User.findById(decoded.uid);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (language) updates.language = language;
    if (preferences) updates.preferences = { ...user.preferences, ...preferences };

    await user.update(updates);
    if (displayName) { const auth = getFirebaseAuth(); await auth.updateUser(decoded.uid, { displayName }); }

    res.json({ success: true, message: 'Profile updated', data: { user: user.toJSON() } });
  } catch (error) { next(error); }
});

router.post('/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;