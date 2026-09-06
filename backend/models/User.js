const { getDatabase } = require('../config/database');
const { generateId } = require('../utils/helpers');

class User {
  constructor(data = {}) {
    this.uid = data.uid || generateId();
    this.email = data.email || '';
    this.displayName = data.displayName || '';
    this.photoURL = data.photoURL || '';
    this.role = data.role || 'user';
    this.status = data.status || 'active';
    this.language = data.language || 'en';
    this.plan = data.plan || 'free';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || null;
    this.metadata = data.metadata || {};
    this.preferences = data.preferences || { theme: 'light', notifications: true, autoSave: true };
    this.usage = data.usage || { messagesSent: 0, filesUploaded: 0, searchesMade: 0, apiCalls: 0, lastResetDate: new Date().toISOString() };
    this.limits = data.limits || { maxMessagesPerDay: 100, maxFileSize: 52428800, maxStorage: 1073741824, allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'] };
  }

  static async findById(uid) {
    const db = getDatabase();
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return new User({ uid: doc.id, ...doc.data() });
  }

  static async findByEmail(email) {
    const db = getDatabase();
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return new User({ uid: doc.id, ...doc.data() });
  }

  async save() {
    const db = getDatabase();
    this.updatedAt = new Date().toISOString();
    await db.collection('users').doc(this.uid).set(this.toJSON(), { merge: true });
    return this;
  }

  async update(data) {
    const db = getDatabase();
    const updates = { ...data, updatedAt: new Date().toISOString() };
    await db.collection('users').doc(this.uid).update(updates);
    Object.assign(this, updates);
    return this;
  }

  async incrementUsage(type, amount = 1) {
    const db = getDatabase();
    const field = `usage.${type}`;
    await db.collection('users').doc(this.uid).update({
      [field]: require('firebase-admin').firestore.FieldValue.increment(amount),
      updatedAt: new Date().toISOString()
    });
    this.usage[type] = (this.usage[type] || 0) + amount;
    return this;
  }

  isAdmin() { return this.role === 'admin' || this.role === 'superadmin'; }
  isActive() { return this.status === 'active'; }
  canSendMessage() { return this.usage.messagesSent < this.limits.maxMessagesPerDay; }
  canUploadFile(fileSize) { return fileSize <= this.limits.maxFileSize; }

  toJSON() {
    return {
      uid: this.uid, email: this.email, displayName: this.displayName,
      photoURL: this.photoURL, role: this.role, status: this.status,
      language: this.language, plan: this.plan, createdAt: this.createdAt,
      updatedAt: this.updatedAt, lastLoginAt: this.lastLoginAt,
      metadata: this.metadata, preferences: this.preferences,
      usage: this.usage, limits: this.limits
    };
  }
}

module.exports = User;