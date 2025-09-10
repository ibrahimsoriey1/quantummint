const express = require('express');
const Provider = require('../models/Provider');
const providerService = require('../services/providerService');
const logger = require('../utils/logger');

const router = express.Router();

// Get all providers
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    const query = active !== undefined ? { isActive: active === 'true' } : {};
    
    const providers = await Provider.find(query).sort({ name: 1 });
    
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    logger.error('Get providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get provider by name
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const provider = await Provider.findOne({ name });
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    logger.error('Get provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get provider fees
router.get('/:name/fees', async (req, res) => {
  try {
    const { name } = req.params;
    const { amount, type, currency } = req.query;
    
    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        error: 'Amount and type are required'
      });
    }

    const fees = await providerService.calculateFees(name, parseFloat(amount), type, currency);
    
    res.json({
      success: true,
      data: fees
    });
  } catch (error) {
    logger.error('Calculate fees error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get provider limits
router.get('/:name/limits', async (req, res) => {
  try {
    const { name } = req.params;
    const { type } = req.query;
    
    const limits = await providerService.getProviderLimits(name, type);
    
    res.json({
      success: true,
      data: limits
    });
  } catch (error) {
    logger.error('Get provider limits error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Check provider availability
router.get('/:name/availability', async (req, res) => {
  try {
    const { name } = req.params;
    const { country, currency } = req.query;
    
    const availability = await providerService.checkAvailability(name, country, currency);
    
    res.json({
      success: true,
      data: availability
    });
  } catch (error) {
    logger.error('Check availability error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize default providers (admin endpoint)
router.post('/initialize', async (req, res) => {
  try {
    const providers = await providerService.initializeDefaultProviders();
    
    res.json({
      success: true,
      data: providers,
      message: 'Default providers initialized'
    });
  } catch (error) {
    logger.error('Initialize providers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
