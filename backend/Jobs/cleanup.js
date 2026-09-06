const cron = require('node-cron');
const { cleanupExpiredMemories } = require('../services/memoryService');
const logger = require('../utils/logger');

const startCleanupJob = () => {
  cron.schedule('0 3 * * *', async () => {
    logger.info('Starting daily cleanup job...');
    try {
      const memoryResult = await cleanupExpiredMemories();
      logger.info(`Memory cleanup completed: ${memoryResult.cleaned} items`);
    } catch (error) { logger.error('Cleanup job failed:', error); }
  });
  logger.info('Cleanup jobs scheduled');
};

module.exports = { startCleanupJob };