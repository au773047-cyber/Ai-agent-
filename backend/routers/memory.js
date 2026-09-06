const express = require('express');
const { authenticate } = require('../middleware/auth');
const { memoryValidators } = require('../utils/validators');
const { saveMemory, getMemory, getAllMemories, deleteMemory } = require('../services/memoryService');

const router = express.Router();

router.post('/', authenticate, memoryValidators.save, async (req, res, next) => {
  try {
    const { key, value, type = 'custom', importance = 1, expiresInDays } = req.body;
    const memory = await saveMemory(req.user.uid, key, value, { type, importance, expiresInDays: expiresInDays ? parseInt(expiresInDays) : null });
    res.status(201).json({ success: true, message: 'Memory saved', data: { memory: memory.toJSON() } });
  } catch (error) { next(error); }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { type, limit = 50 } = req.query;
    const memories = await getAllMemories(req.user.uid, { type, limit: parseInt(limit) });
    res.json({ success: true, data: { memories: memories.map(m => m.toJSON()), count: memories.length } });
  } catch (error) { next(error); }
});

router.get('/:key', authenticate, async (req, res, next) => {
  try {
    const memory = await getMemory(req.user.uid, req.params.key);
    if (!memory) return res.status(404).json({ success: false, message: 'Memory not found', code: 'MEMORY_NOT_FOUND' });
    res.json({ success: true, data: { memory: memory.toJSON() } });
  } catch (error) { next(error); }
});

router.delete('/:key', authenticate, async (req, res, next) => {
  try {
    const result = await deleteMemory(req.user.uid, req.params.key);
    res.json({ success: true, message: 'Memory deleted', data: result });
  } catch (error) { next(error); }
});

module.exports = router;