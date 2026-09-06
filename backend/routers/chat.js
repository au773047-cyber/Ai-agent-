const express = require('express');
const { authenticate } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rate-limit');
const { chatValidators } = require('../utils/validators');
const { chatCompletion, streamChatCompletion } = require('../services/aiService');
const { buildMemoryContext } = require('../services/memoryService');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

router.post('/message', authenticate, chatLimiter, chatValidators.sendMessage, async (req, res, next) => {
  try {
    const { message, conversationId, language = 'en' } = req.body;
    const userId = req.user.uid;

    const user = await User.findById(userId);
    if (!user.canSendMessage()) {
      return res.status(429).json({ success: false, message: 'Daily message limit reached', code: 'DAILY_LIMIT_REACHED' });
    }

    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ success: false, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' });
      }
    } else {
      conversation = new Conversation({ userId, title: message.substring(0, 50) + '...', language });
      await conversation.save();
    }

    const userMessage = new Message({ conversationId: conversation.id, userId, role: 'user', content: message, language });
    await userMessage.save();
    await conversation.incrementMessageCount();

    const history = await Message.getRecentMessages(conversation.id, 10);
    const messages = history.map(m => ({ role: m.role, content: m.content }));
    const memoryContext = await buildMemoryContext(userId, message);

    const aiMessages = [...messages];
    if (memoryContext) aiMessages.unshift({ role: 'system', content: `User context: ${memoryContext}` });

    const aiResponse = await chatCompletion(aiMessages, { language });

    const assistantMessage = new Message({
      conversationId: conversation.id, userId, role: 'assistant',
      content: aiResponse.content, language, tokens: aiResponse.tokens
    });
    await assistantMessage.save();
    await conversation.incrementMessageCount();
    await user.incrementUsage('messagesSent');

    res.json({
      success: true,
      data: { conversationId: conversation.id, message: { id: assistantMessage.id, role: 'assistant', content: aiResponse.content, createdAt: assistantMessage.createdAt }, tokens: aiResponse.tokens }
    });
  } catch (error) { next(error); }
});

router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { limit = 20 } = req.query;
    const conversations = await Conversation.findByUser(userId, { limit: parseInt(limit) });
    res.json({ success: true, data: { conversations: conversations.map(c => c.toJSON()) } });
  } catch (error) { next(error); }
});

router.get('/conversations/:id/messages', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' });
    }
    const messages = await Message.findByConversation(id);
    res.json({ success: true, data: { conversation: conversation.toJSON(), messages: messages.map(m => m.toJSON()) } });
  } catch (error) { next(error); }
});

router.delete('/conversations/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' });
    }
    await conversation.delete();
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) { next(error); }
});

module.exports = router;