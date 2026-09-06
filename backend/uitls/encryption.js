const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

const getMasterKey = () => {
  const masterKey = process.env.JWT_SECRET;
  if (!masterKey || masterKey.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for encryption');
  }
  return masterKey.slice(0, 32);
};

const encrypt = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const key = crypto.pbkdf2Sync(getMasterKey(), salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const result = Buffer.concat([
      salt, iv, authTag, Buffer.from(encrypted, 'hex')
    ]).toString('base64');

    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

const decrypt = (encryptedData) => {
  try {
    const data = Buffer.from(encryptedData, 'base64');

    const salt = data.slice(0, SALT_LENGTH);
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = crypto.pbkdf2Sync(getMasterKey(), salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

const hashApiKey = (apiKey) => {
  return crypto.createHmac('sha256', getMasterKey()).update(apiKey).digest('hex');
};

const generateSecureId = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hashApiKey,
  generateSecureId
};