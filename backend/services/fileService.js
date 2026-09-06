const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { sanitizeFilename, formatFileSize } = require('../utils/helpers');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const ensureUploadDir = async () => {
  try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (error) { logger.error('Failed to create upload directory:', error); }
};
ensureUploadDir();

const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4'
};

const extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return { text: data.text, pages: data.numpages, info: data.info };
  } catch (error) { throw new Error(`Failed to extract PDF text: ${error.message}`); }
};

const extractTextFromDOCX = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value };
  } catch (error) { throw new Error(`Failed to extract DOCX text: ${error.message}`); }
};

const extractTextFromTXT = async (filePath) => {
  try { const text = await fs.readFile(filePath, 'utf8'); return { text }; }
  catch (error) { throw new Error(`Failed to read text file: ${error.message}`); }
};

const extractDataFromExcel = async (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheets = {};
    workbook.SheetNames.forEach(sheetName => {
      sheets[sheetName] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });
    return { sheets, sheetNames: workbook.SheetNames };
  } catch (error) { throw new Error(`Failed to extract Excel data: ${error.message}`); }
};

const extractTextFromFile = async (filePath, mimeType) => {
  const ext = ALLOWED_MIME_TYPES[mimeType];
  switch (ext) {
    case 'pdf': return extractTextFromPDF(filePath);
    case 'docx': case 'doc': return extractTextFromDOCX(filePath);
    case 'txt': case 'csv': return extractTextFromTXT(filePath);
    case 'xlsx': return extractDataFromExcel(filePath);
    case 'jpg': case 'png': case 'webp': return { text: '[Image file]', type: 'image' };
    case 'mp3': return { text: '[Audio file]', type: 'audio' };
    case 'mp4': return { text: '[Video file]', type: 'video' };
    default: return { text: '[Unsupported file type]', type: 'unknown' };
  }
};

const saveFile = async (buffer, originalName, userId) => {
  try {
    const sanitizedName = sanitizeFilename(originalName);
    const timestamp = Date.now();
    const fileName = `${userId}_${timestamp}_${sanitizedName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fs.writeFile(filePath, buffer);
    const stats = await fs.stat(filePath);
    return { fileName, filePath, size: stats.size, savedAt: new Date().toISOString() };
  } catch (error) { throw new Error(`Failed to save file: ${error.message}`); }
};

const deleteFile = async (filePath) => {
  try { await fs.unlink(filePath); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

const validateFile = (file, maxSize = 52428800) => {
  const errors = [];
  if (!file) { errors.push('No file provided'); return { valid: false, errors }; }
  if (file.size > maxSize) errors.push(`File size exceeds ${formatFileSize(maxSize)}`);
  if (!ALLOWED_MIME_TYPES[file.mimetype]) errors.push(`File type ${file.mimetype} is not supported`);
  return { valid: errors.length === 0, errors, extension: ALLOWED_MIME_TYPES[file.mimetype] };
};

module.exports = {
  extractTextFromPDF, extractTextFromDOCX, extractTextFromTXT,
  extractDataFromExcel, extractTextFromFile, saveFile, deleteFile, validateFile, ALLOWED_MIME_TYPES
};