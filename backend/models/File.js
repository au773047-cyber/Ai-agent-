const { getDatabase } = require('../config/database');
const { generateId } = require('../utils/helpers');

class File {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.userId = data.userId || '';
    this.conversationId = data.conversationId || '';
    this.originalName = data.originalName || '';
    this.fileName = data.fileName || '';
    this.mimeType = data.mimeType || '';
    this.size = data.size || 0;
    this.url = data.url || '';
    this.path = data.path || '';
    this.status = data.status || 'uploaded';
    this.extractedText = data.extractedText || '';
    this.metadata = data.metadata || {};
    this.description = data.description || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async findById(id) {
    const db = getDatabase();
    const doc = await db.collection('files').doc(id).get();
    if (!doc.exists) return null;
    return new File({ id: doc.id, ...doc.data() });
  }

  static async findByUser(userId, options = {}) {
    const db = getDatabase();
    let query = db.collection('files').where('userId', '==', userId).orderBy('createdAt', 'desc');
    if (options.limit) query = query.limit(options.limit);
    if (options.status) query = query.where('status', '==', options.status);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => new File({ id: doc.id, ...doc.data() }));
  }

  async save() {
    const db = getDatabase();
    this.updatedAt = new Date().toISOString();
    await db.collection('files').doc(this.id).set(this.toJSON(), { merge: true });
    return this;
  }

  async update(data) {
    const db = getDatabase();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('files').doc(this.id).update(updates);
    Object.assign(this, updates);
    return this;
  }

  async markAsProcessing() { return this.update({ status: 'processing' }); }
  async markAsProcessed(extractedText = '') { return this.update({ status: 'processed', extractedText }); }
  async markAsError(errorMessage) { return this.update({ status: 'error', metadata: { ...this.metadata, error: errorMessage } }); }

  toJSON() {
    return {
      id: this.id, userId: this.userId, conversationId: this.conversationId,
      originalName: this.originalName, fileName: this.fileName,
      mimeType: this.mimeType, size: this.size, url: this.url,
      path: this.path, status: this.status, extractedText: this.extractedText,
      metadata: this.metadata, description: this.description,
      createdAt: this.createdAt, updatedAt: this.updatedAt
    };
  }
}

module.exports = File;