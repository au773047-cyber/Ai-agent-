const { getDatabase } = require('../config/database');
const { generateId } = require('../utils/helpers');

class Message {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.conversationId = data.conversationId || '';
    this.userId = data.userId || '';
    this.role = data.role || 'user';
    this.content = data.content || '';
    this.type = data.type || 'text';
    this.language = data.language || 'en';
    this.metadata = data.metadata || {};
    this.tokens = data.tokens || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.status = data.status || 'complete';
    this.error = data.error || null;
    this.attachments = data.attachments || [];
    this.citations = data.citations || [];
  }

  static async findById(id) {
    const db = getDatabase();
    const doc = await db.collection('messages').doc(id).get();
    if (!doc.exists) return null;
    return new Message({ id: doc.id, ...doc.data() });
  }

  static async findByConversation(conversationId, options = {}) {
    const db = getDatabase();
    let query = db.collection('messages').where('conversationId', '==', conversationId).orderBy('createdAt', 'asc');
    if (options.limit) query = query.limit(options.limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() }));
  }

  static async getRecentMessages(conversationId, limit = 20) {
    const db = getDatabase();
    const snapshot = await db.collection('messages').where('conversationId', '==', conversationId).orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => new Message({ id: doc.id, ...doc.data() })).reverse();
  }

  async save() {
    const db = getDatabase();
    this.updatedAt = new Date().toISOString();
    await db.collection('messages').doc(this.id).set(this.toJSON(), { merge: true });
    return this;
  }

  async update(data) {
    const db = getDatabase();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('messages').doc(this.id).update(updates);
    Object.assign(this, updates);
    return this;
  }

  async markAsError(errorMessage) {
    return this.update({ status: 'error', error: errorMessage });
  }

  toJSON() {
    return {
      id: this.id, conversationId: this.conversationId, userId: this.userId,
      role: this.role, content: this.content, type: this.type,
      language: this.language, metadata: this.metadata, tokens: this.tokens,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
      status: this.status, error: this.error,
      attachments: this.attachments, citations: this.citations
    };
  }
}

module.exports = Message;