const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getDatabase } = require('../config/database');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

router.get('/stats', async (req, res, next) => {
  try {
    const db = getDatabase();
    const usersSnapshot = await db.collection('users').count().get();
    const conversationsSnapshot = await db.collection('conversations').count().get();
    const messagesSnapshot = await db.collection('messages').count().get();
    const filesSnapshot = await db.collection('files').count().get();

    const recentUsers = await db.collection('users').orderBy('createdAt', 'desc').limit(5).get();
    const recentMessages = await db.collection('messages').orderBy('createdAt', 'desc').limit(10).get();

    res.json({
      success: true,
      data: {
        counts: { users: usersSnapshot.data().count, conversations: conversationsSnapshot.data().count, messages: messagesSnapshot.data().count, files: filesSnapshot.data().count },
        recentUsers: recentUsers.docs.map(d => ({ id: d.id, ...d.data() })),
        recentMessages: recentMessages.docs.map(d => ({ id: d.id, ...d.data() }))
      }
    });
  } catch (error) { next(error); }
});

router.get('/users', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { limit = 50, status, role } = req.query;
    let query = db.collection('users').orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);
    if (role) query = query.where('role', '==', role);
    if (limit) query = query.limit(parseInt(limit));
    const snapshot = await query.get();
    const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: { users, count: users.length } });
  } catch (error) { next(error); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, role, plan } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found', code: 'USER_NOT_FOUND' });

    const updates = {};
    if (status) updates.status = status;
    if (role) updates.role = role;
    if (plan) updates.plan = plan;
    await user.update(updates);

    logger.info(`Admin ${req.user.uid} updated user ${id}`);
    res.json({ success: true, message: 'User updated', data: { user: user.toJSON() } });
  } catch (error) { next(error); }
});

module.exports = router;