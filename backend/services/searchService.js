const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { retryAsync } = require('../utils/helpers');

const GOOGLE_CSE_API = 'https://www.googleapis.com/customsearch/v1';

const webSearch = async (query, options = {}) => {
  const { numResults = 10, language = 'en', safeSearch = 'active' } = options;

  try {
    const params = {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CSE_ID,
      q: query,
      num: Math.min(numResults, 20),
      hl: language === 'ha' ? 'ha' : language === 'ar' ? 'ar' : 'en',
      safe: safeSearch
    };

    const response = await retryAsync(async () => {
      return await axios.get(GOOGLE_CSE_API, { params, timeout: 10000 });
    }, 3, 2000);

    const results = response.data.items?.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayUrl: item.displayLink,
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || null
    })) || [];

    logger.info('Web search completed', { query, resultsCount: results.length });
    return { success: true, query, results, totalResults: response.data.searchInformation?.totalResults || '0' };
  } catch (error) {
    logger.error('Web search failed:', error.message);
    return fallbackSearch(query, options);
  }
};

const fallbackSearch = async (query, options = {}) => {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('.result').each((i, elem) => {
      if (i >= (options.numResults || 10)) return;
      const title = $(elem).find('.result__a').text().trim();
      const link = $(elem).find('.result__a').attr('href');
      const snippet = $(elem).find('.result__snippet').text().trim();
      if (title && link) {
        results.push({ title, link: link.startsWith('http') ? link : `https:${link}`, snippet, displayUrl: new URL(link.startsWith('http') ? link : `https:${link}`).hostname });
      }
    });

    return { success: true, query, results, source: 'duckduckgo', totalResults: results.length.toString() };
  } catch (error) {
    logger.error('Fallback search failed:', error.message);
    throw new Error('Search service temporarily unavailable');
  }
};

const scrapeWebpage = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, aside').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const content = $('body').text().trim().replace(/\s+/g, ' ').substring(0, 5000);

    return { success: true, url, title, description, content, scrapedAt: new Date().toISOString() };
  } catch (error) {
    logger.error(`Failed to scrape ${url}:`, error.message);
    throw new Error(`Failed to scrape webpage: ${error.message}`);
  }
};

module.exports = { webSearch, scrapeWebpage, fallbackSearch };