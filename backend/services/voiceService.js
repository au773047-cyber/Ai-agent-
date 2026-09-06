const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const GOOGLE_TTS_API = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const textToSpeech = async (text, options = {}) => {
  const { language = 'en', speed = 1.0 } = options;
  try {
    const languageCode = language === 'ha' ? 'ha-NG' : language === 'ar' ? 'ar-SA' : 'en-US';
    const response = await axios.post(
      `${GOOGLE_TTS_API}?key=${process.env.GOOGLE_API_KEY}`,
      {
        input: { text },
        voice: { languageCode, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: speed }
      }
    );
    return { audioBase64: response.data.audioContent, format: 'mp3' };
  } catch (error) {
    logger.error('Text-to-speech failed:', error.message);
    throw new Error(`TTS failed: ${error.message}`);
  }
};

module.exports = { textToSpeech };