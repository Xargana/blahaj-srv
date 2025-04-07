const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Get API key from environment variables
const API_KEY = process.env.EXCHANGE_RATE_API_KEY;
if (!API_KEY) {
  console.error('WARNING: EXCHANGE_RATE_API_KEY environment variable is not set!');
  console.error('Exchange rate functionality will not work correctly.');
}

const BASE_URL = 'https://v6.exchangerate-api.com/v6';

// We'll use USD as our single base currency
const BASE_CURRENCY = 'USD';

// Path to the cache file
const CACHE_FILE_PATH = path.join(__dirname, 'exchange-rates-cache.json');

// In-memory storage for cached exchange rates
let exchangeRatesCache = {
  USD: {
    lastUpdated: null,
    rates: {},
    nextUpdateTime: null
  }
};

// one day in milliseconds
const UPDATE_INTERVAL = 1 * 24 * 60 * 60 * 1000;

// Load cached exchange rates from file
function loadCachedRates() {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Convert string dates back to Date objects
      if (parsedData.USD) {
        if (parsedData.USD.lastUpdated) {
          parsedData.USD.lastUpdated = new Date(parsedData.USD.lastUpdated);
        }
        if (parsedData.USD.nextUpdateTime) {
          parsedData.USD.nextUpdateTime = new Date(parsedData.USD.nextUpdateTime);
        }
      }
      
      exchangeRatesCache = parsedData;
      console.log('Loaded exchange rates from cache file');
    } else {
      console.log('No cache file found, will create one when rates are fetched');
    }
  } catch (error) {
    console.error('Error loading cached exchange rates:', error.message);
    // Continue with default cache if file can't be loaded
  }
}

// Save exchange rates to cache file
function saveCachedRates() {
  try {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(exchangeRatesCache, null, 2));
    console.log('Exchange rates saved to cache file');
  } catch (error) {
    console.error('Error saving exchange rates to cache file:', error.message);
  }
}

// Function to fetch and update exchange rates using USD as base
async function updateExchangeRates() {
  if (!API_KEY) {
    console.error('Cannot update exchange rates: API key is not set');
    return false;
  }
  
  try {
    console.log(`Fetching latest exchange rates using ${BASE_CURRENCY} as base...`);
    const response = await axios.get(`${BASE_URL}/${API_KEY}/latest/${BASE_CURRENCY}`);
    
    if (response.data && response.data.result === 'success') {
      exchangeRatesCache.USD = {
        lastUpdated: new Date(),
        rates: response.data.conversion_rates,
        nextUpdateTime: new Date(Date.now() + UPDATE_INTERVAL)
      };
      
      // Save to file after updating
      saveCachedRates();
      
      console.log('Exchange rates updated successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to update exchange rates:', error.message);
    return false;
  }
}

// Check if rates need updating and update if necessary
async function ensureRatesUpdated() {
  if (!exchangeRatesCache.USD.lastUpdated || 
      Date.now() > exchangeRatesCache.USD.nextUpdateTime.getTime()) {
    return await updateExchangeRates();
  }
  console.log(`Using cached rates, next update: ${exchangeRatesCache.USD.nextUpdateTime}`);
  return true;
}

// Calculate conversion rate between any two currencies using USD as base
function calculateRate(from, to) {
  const rates = exchangeRatesCache.USD.rates;
  
  // If either currency is USD, we can use the rate directly
  if (from === 'USD') return rates[to];
  if (to === 'USD') return 1 / rates[from];
  
  // Otherwise, calculate cross rate: from -> USD -> to
  return rates[to] / rates[from];
}

// Load cached rates when the module is loaded
loadCachedRates();

// Initialize rates if needed
ensureRatesUpdated();

// Root endpoint
router.get('/', (req, res) => {
  const availableCurrencies = exchangeRatesCache.USD.rates ? 
    Object.keys(exchangeRatesCache.USD.rates) : [];
  
  res.json({ 
    message: 'Exchange Rate API is running',
    baseCurrency: BASE_CURRENCY,
    availableCurrencies,
    lastUpdated: exchangeRatesCache.USD.lastUpdated,
    nextUpdate: exchangeRatesCache.USD.nextUpdateTime,
    updateInterval: '3 days',
    endpoints: {
      latest: '/latest',
      convert: '/convert/:from/:to/:amount',
      currencies: '/currencies'
    }
  });
});

// Get all cached exchange rates
router.get('/latest', async (req, res) => {
  await ensureRatesUpdated();
  
  if (!exchangeRatesCache.USD.rates) {
    return res.status(503).json({ error: 'Exchange rate data not yet available' });
  }
  
  res.json({
    result: 'success',
    base: BASE_CURRENCY,
    lastUpdated: exchangeRatesCache.USD.lastUpdated,
    nextUpdate: exchangeRatesCache.USD.nextUpdateTime,
    rates: exchangeRatesCache.USD.rates
  });
});

// Get rates for a specific currency as base
router.get('/latest/:currency', async (req, res) => {
  const { currency } = req.params;
  const currencyCode = currency.toUpperCase();
  
  await ensureRatesUpdated();
  
  if (!exchangeRatesCache.USD.rates) {
    return res.status(503).json({ error: 'Exchange rate data not yet available' });
  }
  
  // Check if the currency is supported
  if (!exchangeRatesCache.USD.rates[currencyCode] && currencyCode !== 'USD') {
    return res.status(400).json({ error: `Currency '${currencyCode}' not supported` });
  }
  
  // Calculate rates with the requested currency as base
  const rates = {};
  const usdRates = exchangeRatesCache.USD.rates;
  
  // If the requested base is USD, return rates directly
  if (currencyCode === 'USD') {
    res.json({
      result: 'success',
      base: currencyCode,
      lastUpdated: exchangeRatesCache.USD.lastUpdated,
      nextUpdate: exchangeRatesCache.USD.nextUpdateTime,
      rates: usdRates
    });
    return;
  }
  
  // Otherwise, calculate rates for all currencies with the requested currency as base
  const baseRate = usdRates[currencyCode]; // Rate of 1 USD in the requested currency
  
  // Add USD rate
  rates['USD'] = 1 / baseRate;
  
  // Add rates for all other currencies
  for (const toCurrency in usdRates) {
    if (toCurrency !== currencyCode) {
      // Convert through USD: from -> USD -> to
      rates[toCurrency] = usdRates[toCurrency] / baseRate;
    }
  }
  
  // Add rate for the base currency itself
  rates[currencyCode] = 1;
  
  res.json({
    result: 'success',
    base: currencyCode,
    lastUpdated: exchangeRatesCache.USD.lastUpdated,
    nextUpdate: exchangeRatesCache.USD.nextUpdateTime,
    rates: rates
  });
});

// Get list of available currencies
router.get('/currencies', async (req, res) => {
  await ensureRatesUpdated();
  
  const availableCurrencies = exchangeRatesCache.USD.rates ? 
    Object.keys(exchangeRatesCache.USD.rates) : [];
  
  res.json({
    result: 'success',
    baseCurrency: BASE_CURRENCY,
    availableCurrencies,
    lastUpdated: exchangeRatesCache.USD.lastUpdated,
    nextUpdate: exchangeRatesCache.USD.nextUpdateTime
  });
});

// Convert between currencies using cached rates
router.get('/convert/:from/:to/:amount', async (req, res) => {
  const { from, to, amount } = req.params;
  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();
  
  await ensureRatesUpdated();
  
  if (!exchangeRatesCache.USD.rates) {
    return res.status(503).json({ error: 'Exchange rate data not yet available' });
  }
  
  // Check if currencies are supported
  if (fromCurrency !== 'USD' && !exchangeRatesCache.USD.rates[fromCurrency]) {
    return res.status(400).json({ error: `Currency '${fromCurrency}' not supported` });
  }
  
  if (toCurrency !== 'USD' && !exchangeRatesCache.USD.rates[toCurrency]) {
    return res.status(400).json({ error: `Currency '${toCurrency}' not supported` });
  }
  
  try {
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Calculate conversion rate
    const rate = calculateRate(fromCurrency, toCurrency);
    const convertedAmount = numericAmount * rate;
    
    res.json({
      result: 'success',
      from: fromCurrency,
      to: toCurrency,
      amount: numericAmount,
      rate,
      convertedAmount: parseFloat(convertedAmount.toFixed(4)),
      lastUpdated: exchangeRatesCache.USD.lastUpdated,
      nextUpdate: exchangeRatesCache.USD.nextUpdateTime
    });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Failed to convert currency' });
  }
});

// Direct pair conversion (fallback to API if needed)
router.get('/pair/:from/:to/:amount', async (req, res) => {
  const { from, to, amount } = req.params;
  const fromCurrency = from.toUpperCase();
  const toCurrency = to.toUpperCase();
  
  // First try to use our cached rates
  await ensureRatesUpdated();
  
  if (exchangeRatesCache.USD.rates && 
      (fromCurrency === 'USD' || exchangeRatesCache.USD.rates[fromCurrency]) && 
      (toCurrency === 'USD' || exchangeRatesCache.USD.rates[toCurrency])) {
    
    try {
      const numericAmount = parseFloat(amount);
      
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      // Calculate conversion rate
      const rate = calculateRate(fromCurrency, toCurrency);
      const convertedAmount = numericAmount * rate;
      
      res.json({
        result: 'success',
        from: fromCurrency,
        to: toCurrency,
        amount: numericAmount,
        rate,
        convertedAmount: parseFloat(convertedAmount.toFixed(4)),
        lastUpdated: exchangeRatesCache.USD.lastUpdated,
        source: 'cache'
      });
      return;
    } catch (error) {
      console.error('Error using cached rates:', error);
      // Fall through to API call
    }
  }
  
  // If we can't use cached rates, call the API directly
  if (!API_KEY) {
    return res.status(503).json({ error: 'Exchange rate API key is not configured' });
  }
  
  try {
    const response = await axios.get(`${BASE_URL}/${API_KEY}/pair/${fromCurrency}/${toCurrency}/${amount}`);
    
    // Update our cache with the latest USD rates if it's time
    ensureRatesUpdated();
    
    res.json({
      ...response.data,
      source: 'api'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert currency' });
  }
});

module.exports = router;
