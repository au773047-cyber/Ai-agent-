const { getDatabase } = require('../config/database');
const { generateId } = require('../utils/helpers');

class Conversation {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.userId = data.userId || '';
    this.title = data.title || 'New Conversation';
    this.language = data.language || 'en';
    this.status = data.status || 'active';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.messageCount = data.messageCount || 0;
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
  }

  static async findById(id) {
    const db = getDatabase();
    const doc = await db.collection('conversations').doc(id).get();
    if (!doc.exists) return null;
    return new Conversation({ id: doc.id, ...doc.data() });
  }

  static async findByUser(userId, options = {}) {
    const db = getDatabase();
    let query = db.collection('conversations').where('userId', '==', userId).where('status', '==', 'active').orderBy('updatedAt', 'desc');
    if (options.limit) query = query.limit(options.limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Conversation({ id: doc.id, ...doc.data() }));
  }

  async save() {
    const db = getDatabase();
    this.updatedAt = new Date().toISOString();
    await db.collection('conversations').doc(this.id).set(this.toJSON(), { merge: true });
    return this;
  }

  async update(data) {
    const db = getDatabase();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('conversations').doc(this.id).update(updates);
    Object.assign(this, updates);
    return this;
  }

  async archive() { return this.update({ status: 'archived' }); }
  async delete() { return this.update({ status: 'deleted' }); }

  async incrementMessageCount() {
    const db = getDatabase();
    await db.collection('conversations').doc(this.id).update({
      messageCount: require('firebase-admin').firestore.FieldValue.increment(1),
      updatedAt: new Date().toISOString()
    });
    this.messageCount++;
    return this;
  }

  toJSON() {
    return {
      id: this.id, userId: this.userId, title: this.title,
      language: this.language, status: this.status,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
      messageCount: this.messageCount, metadata: this.metadata, tags: this.tags
    };
  }
}

module.exports = Conversation;