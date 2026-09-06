const express = require('express');
const { authenticate } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rate-limit');
const { searchValidators } = require('../utils/validators');
const { webSearch } = require('../services/searchService');
const User = require('../models/User');

const router = express.Router();

router.post('/web', authenticate, searchLimiter, searchValidators.webSearch, async (req, res, next) => {
  try {
    const { query, numResults = 10, language = 'en' } = req.body;
    const user = await User.findById(req.user.uid);
    await user.incrementUsage('searchesMade');
    const results = await webSearch(query, { numResults: parseInt(numResults), language });
    res.json({ success: true, data: results });
  } catch (error) { next(error); }
});

module.exports = router;