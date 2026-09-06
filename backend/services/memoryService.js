const { getDatabase } = require('../config/database');
const Memory = require('../models/Memory');
const logger = require('../utils/logger');

const saveMemory = async (userId, key, value, options = {}) => {
  try {
    const { type = 'custom', importance = 1, source = 'user', expiresInDays = null } = options;
    let memory = await Memory.findByKey(userId, key);

    if (memory) {
      memory.value = value; memory.type = type; memory.importance = importance;
      memory.source = source; memory.updatedAt = new Date().toISOString();
      if (expiresInDays) { const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + expiresInDays); memory.expiresAt = expiresAt.toISOString(); }
      await memory.save();
    } else {
      memory = new Memory({ userId, key, value, type, importance, source });
      if (expiresInDays) { const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + expiresInDays); memory.expiresAt = expiresAt.toISOString(); }
      await memory.save();
    }
    return memory;
  } catch (error) { throw new Error(`Failed to save memory: ${error.message}`); }
};

const getMemory = async (userId, key) => {
  try {
    const memory = await Memory.findByKey(userId, key);
    if (!memory) return null;
    if (memory.isExpired()) { await deleteMemory(userId, key); return null; }
    await memory.incrementAccess();
    return memory;
  } catch (error) { throw new Error(`Failed to get memory: ${error.message}`); }
};

const getAllMemories = async (userId, options = {}) => {
  try {
    const memories = await Memory.findByUser(userId, options);
    const validMemories = [];
    for (const memory of memories) {
      if (!memory.isExpired()) validMemories.push(memory);
      else await deleteMemory(userId, memory.key);
    }
    return validMemories;
  } catch (error) { throw new Error(`Failed to get memories: ${error.message}`); }
};

const deleteMemory = async (userId, key) => {
  try {
    const db = getDatabase();
    const snapshot = await db.collection('memories').where('userId', '==', userId).where('key', '==', key).get();
    if (snapshot.empty) return { deleted: false };
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return { deleted: true, count: snapshot.size };
  } catch (error) { throw new Error(`Failed to delete memory: ${error.message}`); }
};

const getRelevantMemories = async (userId, context, limit = 5) => {
  try {
    const allMemories = await getAllMemories(userId);
    const contextWords = context.toLowerCase().split(/\s+/);
    const scoredMemories = allMemories.map(memory => {
      const memoryText = `${memory.key} ${memory.value}`.toLowerCase();
      let score = 0;
      contextWords.forEach(word => { if (memoryText.includes(word)) score += 1; });
      score += (memory.importance * 0.5) + (memory.accessCount * 0.1);
      return { memory, score };
    });
    scoredMemories.sort((a, b) => b.score - a.score);
    return scoredMemories.slice(0, limit).map(item => item.memory);
  } catch (error) { return []; }
};

const buildMemoryContext = async (userId, currentMessage) => {
  try {
    const relevantMemories = await getRelevantMemories(userId, currentMessage, 5);
    if (relevantMemories.length === 0) return '';
    const memoryContext = relevantMemories.map(m => `- ${m.key}: ${m.value}`).join('\n');
    return `\n\nRelevant user information:\n${memoryContext}`;
  } catch (error) { return ''; }
};

const cleanupExpiredMemories = async () => {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const snapshot = await db.collection('memories').where('expiresAt', '<=', now).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return { cleaned: snapshot.size };
  } catch (error) { throw error; }
};

module.exports = {
  saveMemory, getMemory, getAllMemories, deleteMemory,
  getRelevantMemories, buildMemoryContext, cleanupExpiredMemories
};