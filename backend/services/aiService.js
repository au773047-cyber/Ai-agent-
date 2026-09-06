const OpenAI = require('openai');
const logger = require('../utils/logger');
const { retryAsync } = require('../utils/helpers');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPTS = {
  en: `You are an intelligent AI assistant. You help users with various tasks including answering questions, analyzing data, writing content, and providing recommendations. Be helpful, accurate, and concise.`,
  ha: `Kai ne mai taimako na AI mai hikima. Kana taimakawa masu amfani da ayyuka daban-daban har da amsa tambayoyi, nazarin bayanai, rubuta abubuwa, da kuma bayar da shawarwari.`,
  ar: `أنت مساعد ذكاء اصطناعي ذكي. تساعد المستخدمين في مهام متنوعة تشمل الإجابة على الأسئلة، وتحليل البيانات، وكتابة المحتوى.`
};

const getSystemPrompt = (language = 'en', customInstructions = '') => {
  const basePrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
  if (customInstructions) {
    return `${basePrompt}\n\nAdditional instructions: ${customInstructions}`;
  }
  return basePrompt;
};

const chatCompletion = async (messages, options = {}) => {
  const { language = 'en', model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2000, customInstructions = '' } = options;

  try {
    const systemMessage = { role: 'system', content: getSystemPrompt(language, customInstructions) };
    const formattedMessages = [systemMessage, ...messages.map(msg => ({ role: msg.role, content: msg.content }))];

    const response = await retryAsync(async () => {
      return await openai.chat.completions.create({
        model, messages: formattedMessages, temperature, max_tokens: maxTokens, top_p: 1, frequency_penalty: 0, presence_penalty: 0
      });
    }, 3, 2000);

    const completion = response.choices[0].message;
    logger.info('AI chat completion successful', { model, tokensUsed: response.usage?.total_tokens, language });

    return {
      content: completion.content,
      role: completion.role,
      tokens: response.usage?.total_tokens || 0,
      model: response.model,
      finishReason: response.choices[0].finish_reason
    };
  } catch (error) {
    logger.error('AI chat completion failed:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
};

const streamChatCompletion = async (messages, options = {}, onChunk) => {
  const { language = 'en', model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2000 } = options;

  try {
    const systemMessage = { role: 'system', content: getSystemPrompt(language) };
    const formattedMessages = [systemMessage, ...messages.map(msg => ({ role: msg.role, content: msg.content }))];

    const stream = await openai.chat.completions.create({
      model, messages: formattedMessages, temperature, max_tokens: maxTokens, stream: true
    });

    let fullContent = '';
    let totalTokens = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        totalTokens += 1;
        if (onChunk) onChunk({ content, done: false });
      }
    }

    if (onChunk) onChunk({ content: '', done: true, fullContent, tokens: totalTokens });
    return { content: fullContent, tokens: totalTokens, model };
  } catch (error) {
    logger.error('AI stream completion failed:', error);
    throw new Error(`AI streaming error: ${error.message}`);
  }
};

const generateEmbedding = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', input: text, encoding_format: 'float'
    });
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Embedding generation failed:', error);
    throw new Error(`Embedding error: ${error.message}`);
  }
};

const analyzeImage = async (imageBase64, prompt = 'Describe this image in detail') => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 1000
    });
    return { content: response.choices[0].message.content, tokens: response.usage?.total_tokens || 0 };
  } catch (error) {
    logger.error('Image analysis failed:', error);
    throw new Error(`Image analysis error: ${error.message}`);
  }
};

module.exports = {
  chatCompletion,
  streamChatCompletion,
  generateEmbedding,
  analyzeImage
};