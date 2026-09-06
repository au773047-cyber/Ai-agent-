const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { fileUploadLimiter } = require('../middleware/rate-limit');
const { extractTextFromFile, saveFile, validateFile } = require('../services/fileService');
const File = require('../models/File');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 } });

router.post('/upload', authenticate, fileUploadLimiter, upload.single('file'), async (req, res, next) => {
  try {
    const { conversationId, description = '' } = req.body;
    const userId = req.user.uid;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded', code: 'NO_FILE' });

    const validation = validateFile(file);
    if (!validation.valid) return res.status(400).json({ success: false, message: 'File validation failed', errors: validation.errors, code: 'VALIDATION_FAILED' });

    const user = await User.findById(userId);
    if (!user.canUploadFile(file.size)) return res.status(413).json({ success: false, message: 'File exceeds your plan limit', code: 'FILE_TOO_LARGE' });

    const savedFile = await saveFile(file.buffer, file.originalname, userId);

    const fileRecord = new File({
      userId, conversationId: conversationId || '', originalName: file.originalname,
      fileName: savedFile.fileName, mimeType: file.mimetype, size: file.size,
      path: savedFile.filePath, description, status: 'uploaded'
    });
    await fileRecord.save();

    extractTextFromFile(savedFile.filePath, file.mimetype)
      .then(async (extraction) => { await fileRecord.markAsProcessed(extraction.text); })
      .catch(async (error) => { await fileRecord.markAsError(error.message); });

    await user.incrementUsage('filesUploaded');

    res.status(201).json({
      success: true, message: 'File uploaded successfully',
      data: { file: { id: fileRecord.id, originalName: fileRecord.originalName, size: fileRecord.size, mimeType: fileRecord.mimeType, status: fileRecord.status, url: `/uploads/${fileRecord.fileName}` } }
    });
  } catch (error) { next(error); }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { limit = 20, status } = req.query;
    const files = await File.findByUser(userId, { limit: parseInt(limit), status });
    res.json({ success: true, data: { files: files.map(f => ({ ...f.toJSON(), url: `/uploads/${f.fileName}` })) } });
  } catch (error) { next(error); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const file = await File.findById(id);
    if (!file || file.userId !== userId) return res.status(404).json({ success: false, message: 'File not found', code: 'FILE_NOT_FOUND' });

    const { deleteFile: deleteFromDisk } = require('../services/fileService');
    await deleteFromDisk(file.path);

    const db = require('../config/database').getDatabase();
    await db.collection('files').doc(id).delete();

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) { next(error); }
});

module.exports = router;