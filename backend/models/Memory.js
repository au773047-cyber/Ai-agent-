const { getDatabase } = require('../config/database');
const { generateId } = require('../utils/helpers');

class Memory {
  constructor(data = {}) {
    this.id = data.id || generateId();
    this.userId = data.userId || '';
    this.key = data.key || '';
    this.value = data.value || '';
    this.type = data.type || 'custom';
    this.importance = data.importance || 1;
    this.source = data.source || 'user';
    this.metadata = data.metadata || {};
    this.expiresAt = data.expiresAt || null;
    this.accessCount = data.accessCount || 0;
    this.lastAccessedAt = data.lastAccessedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static async findById(id) {
    const db = getDatabase();
    const doc = await db.collection('memories').doc(id).get();
    if (!doc.exists) return null;
    return new Memory({ id: doc.id, ...doc.data() });
  }

  static async findByUser(userId, options = {}) {
    const db = getDatabase();
    let query = db.collection('memories').where('userId', '==', userId).orderBy('updatedAt', 'desc');
    if (options.type) query = query.where('type', '==', options.type);
    if (options.limit) query = query.limit(options.limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => new Memory({ id: doc.id, ...doc.data() }));
  }

  static async findByKey(userId, key) {
    const db = getDatabase();
    const snapshot = await db.collection('memories').where('userId', '==', userId).where('key', '==', key).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return new Memory({ id: doc.id, ...doc.data() });
  }

  async save() {
    const db = getDatabase();
    this.updatedAt = new Date().toISOString();
    await db.collection('memories').doc(this.id).set(this.toJSON(), { merge: true });
    return this;
  }

  async update(data) {
    const db = getDatabase();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('memories').doc(this.id).update(updates);
    Object.assign(this, updates);
    return this;
  }

  async incrementAccess() {
    const db = getDatabase();
    await db.collection('memories').doc(this.id).update({
      accessCount: require('firebase-admin').firestore.FieldValue.increment(1),
      lastAccessedAt: new Date().toISOString()
    });
    this.accessCount++;
    return this;
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  toJSON() {
    return {
      id: this.id, userId: this.userId, key: this.key, value: this.value,
      type: this.type, importance: this.importance, source: this.source,
      metadata: this.metadata, expiresAt: this.expiresAt,
      accessCount: this.accessCount, lastAccessedAt: this.lastAccessedAt,
      createdAt: this.createdAt, updatedAt: this.updatedAt
    };
  }
}

module.exports = Memory;