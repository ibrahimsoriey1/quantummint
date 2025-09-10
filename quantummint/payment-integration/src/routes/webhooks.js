const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Webhook = require('../models/Webhook');
const webhookService = require('../services/webhookService');
const logger = require('../utils/logger');

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.get('stripe-signature');
    const payload = req.body;
    
    // Verify webhook signature
    const isValid = await webhookService.verifyStripeSignature(payload, signature);
    if (!isValid) {
      logger.warn('Invalid Stripe webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(payload);
    
    // Create webhook record
    const webhook = new Webhook({
      webhookId: uuidv4(),
      provider: 'stripe',
      eventType: event.type,
      eventId: event.id,
      payload: event,
      signature,
      status: 'received'
    });
    
    await webhook.save();
    
    // Process webhook asynchronously
    webhookService.processWebhook(webhook._id).catch(error => {
      logger.error('Webhook processing error:', error);
    });
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Orange Money webhook endpoint
router.post('/orange-money', async (req, res) => {
  try {
    const signature = req.get('x-orange-signature');
    const payload = req.body;
    
    // Verify webhook signature
    const isValid = await webhookService.verifyOrangeMoneySignature(JSON.stringify(payload), signature);
    if (!isValid) {
      logger.warn('Invalid Orange Money webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Create webhook record
    const webhook = new Webhook({
      webhookId: uuidv4(),
      provider: 'orange_money',
      eventType: payload.event_type || 'payment_update',
      eventId: payload.transaction_id || uuidv4(),
      providerTransactionId: payload.transaction_id,
      payload,
      signature,
      status: 'received'
    });
    
    await webhook.save();
    
    // Process webhook asynchronously
    webhookService.processWebhook(webhook._id).catch(error => {
      logger.error('Webhook processing error:', error);
    });
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Orange Money webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// AfriMoney webhook endpoint
router.post('/afrimoney', async (req, res) => {
  try {
    const signature = req.get('x-afrimoney-signature');
    const payload = req.body;
    
    // Verify webhook signature
    const isValid = await webhookService.verifyAfriMoneySignature(JSON.stringify(payload), signature);
    if (!isValid) {
      logger.warn('Invalid AfriMoney webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Create webhook record
    const webhook = new Webhook({
      webhookId: uuidv4(),
      provider: 'afrimoney',
      eventType: payload.event_type || 'payment_update',
      eventId: payload.reference || uuidv4(),
      providerTransactionId: payload.reference,
      payload,
      signature,
      status: 'received'
    });
    
    await webhook.save();
    
    // Process webhook asynchronously
    webhookService.processWebhook(webhook._id).catch(error => {
      logger.error('Webhook processing error:', error);
    });
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('AfriMoney webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Get webhook by ID
router.get('/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const webhook = await Webhook.findOne({ webhookId });
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    logger.error('Get webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get webhooks with filtering
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, provider, status, eventType } = req.query;
    
    const query = {};
    if (provider) query.provider = provider;
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    const skip = (page - 1) * limit;
    const webhooks = await Webhook.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-payload'); // Exclude payload for list view

    const total = await Webhook.countDocuments(query);

    res.json({
      success: true,
      data: {
        webhooks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get webhooks error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Retry webhook processing
router.post('/:webhookId/retry', async (req, res) => {
  try {
    const { webhookId } = req.params;
    
    const result = await webhookService.retryWebhook(webhookId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Retry webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
