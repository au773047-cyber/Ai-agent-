const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const sanitizeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const detectLanguage = (text) => {
  const hausaPattern = /[ƙƙɗɗƴƴ]|(ina|ba|da|ga|ka|ma|na|sa|wa|ya|za)/i;
  const arabicPattern = /[\u0600-\u06FF]/;

  if (arabicPattern.test(text)) return 'ar';
  if (hausaPattern.test(text)) return 'ha';
  return 'en';
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryAsync = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(delayMs * Math.pow(2, i));
    }
  }
};

const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = {
  generateId,
  sanitizeHtml,
  truncateText,
  formatFileSize,
  detectLanguage,
  delay,
  retryAsync,
  sanitizeFilename,
  isValidUrl
};