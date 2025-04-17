const express = require('express');
const whois = require('whois-json');
const router = express.Router();

// GET endpoint for WHOIS lookup
router.get('/:domain', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required' });
    }
    
    const result = await whois(domain);
    
    // Format the response in a clean structure
    const whoisData = {
      domain: domain,
      registrar: result.registrar || "Not available",
      creationDate: result.creationDate ? new Date(result.creationDate).toISOString() : "Not available",
      expirationDate: result.expirationDate ? new Date(result.expirationDate).toISOString() : "Not available",
      nameServers: Array.isArray(result.nameServers) ? result.nameServers : (result.nameServers ? [result.nameServers] : ["Not available"]),
      status: Array.isArray(result.status) ? result.status : (result.status ? [result.status] : ["Not available"]),
      raw: result // Include the full raw data for advanced usage
    };
    
    res.json(whoisData);
  } catch (error) {
    console.error('WHOIS API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch WHOIS information',
      message: error.message 
    });
  }
});

// POST endpoint for WHOIS lookup (alternative to GET with request body)
router.post('/', async (req, res) => {
  try {
    const domain = req.body.domain;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required in request body' });
    }
    
    const result = await whois(domain);
    
    // Format the response in a clean structure
    const whoisData = {
      domain: domain,
      registrar: result.registrar || "Not available",
      creationDate: result.creationDate ? new Date(result.creationDate).toISOString() : "Not available",
      expirationDate: result.expirationDate ? new Date(result.expirationDate).toISOString() : "Not available",
      nameServers: Array.isArray(result.nameServers) ? result.nameServers : (result.nameServers ? [result.nameServers] : ["Not available"]),
      status: Array.isArray(result.status) ? result.status : (result.status ? [result.status] : ["Not available"]),
      raw: result // Include the full raw data for advanced usage
    };
    
    res.json(whoisData);
  } catch (error) {
    console.error('WHOIS API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch WHOIS information',
      message: error.message 
    });
  }
});

module.exports = router;
