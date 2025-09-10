const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Verification = require('../models/Verification');
const verificationService = require('../services/verificationService');
const logger = require('../utils/logger');
const { validateVerificationRequest } = require('../middleware/validation');

const router = express.Router();

// Start verification process
router.post('/start', validateVerificationRequest, async (req, res) => {
  try {
    const { userId, profileId, type, method, provider, metadata } = req.body;
    
    const verificationData = {
      verificationId: uuidv4(),
      userId,
      profileId,
      type,
      method,
      provider: provider || 'internal',
      status: 'pending',
      metadata: metadata || {}
    };

    const verification = await verificationService.startVerification(verificationData);
    
    logger.info(`Verification started: ${verification.verificationId}`);
    res.status(201).json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Start verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification by ID
router.get('/:verificationId', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const verification = await Verification.findOne({ verificationId });
    
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Get verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get verifications by profile ID
router.get('/profile/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { type, status, limit = 10 } = req.query;
    
    const query = { profileId };
    if (type) query.type = type;
    if (status) query.status = status;

    const verifications = await Verification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: verifications
    });
  } catch (error) {
    logger.error('Get profile verifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get verifications by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, status, limit = 10 } = req.query;
    
    const query = { userId };
    if (type) query.type = type;
    if (status) query.status = status;

    const verifications = await Verification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: verifications
    });
  } catch (error) {
    logger.error('Get user verifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update verification step
router.post('/:verificationId/step', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { stepId, name, status, data, errors } = req.body;

    const result = await verificationService.updateVerificationStep(verificationId, {
      stepId,
      name,
      status,
      data,
      errors
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Update verification step error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Complete verification
router.post('/:verificationId/complete', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { results, reviewNotes } = req.body;

    const verification = await verificationService.completeVerification(verificationId, {
      results,
      reviewNotes
    });
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Complete verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Fail verification
router.post('/:verificationId/fail', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { reason, reviewNotes } = req.body;

    const verification = await verificationService.failVerification(verificationId, {
      reason,
      reviewNotes
    });
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Fail verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification results
router.get('/:verificationId/results', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const verification = await Verification.findOne({ verificationId });
    
    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      });
    }

    res.json({
      success: true,
      data: {
        verificationId: verification.verificationId,
        status: verification.status,
        results: verification.results,
        completedAt: verification.completedAt,
        timeline: verification.timeline
      }
    });
  } catch (error) {
    logger.error('Get verification results error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Run automated verification
router.post('/:verificationId/run-automated', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { checkTypes } = req.body;

    const result = await verificationService.runAutomatedVerification(verificationId, checkTypes);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Run automated verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Manual review (admin endpoint)
router.post('/:verificationId/review', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { reviewedBy, decision, notes, overrideResults } = req.body;

    if (!['approve', 'reject', 'request_more_info'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision. Must be approve, reject, or request_more_info'
      });
    }

    const verification = await verificationService.manualReview(verificationId, {
      reviewedBy,
      decision,
      notes,
      overrideResults
    });
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Manual review error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get pending verifications (admin endpoint)
router.get('/admin/pending', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, provider } = req.query;
    
    const query = { 
      status: { $in: ['pending', 'in_progress'] }
    };
    if (type) query.type = type;
    if (provider) query.provider = provider;

    const skip = (page - 1) * limit;
    const verifications = await Verification.find(query)
      .sort({ createdAt: 1 }) // Oldest first for review queue
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Verification.countDocuments(query);

    res.json({
      success: true,
      data: {
        verifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get verification statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const stats = await Verification.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            status: '$status',
            type: '$type',
            provider: '$provider'
          },
          count: { $sum: 1 },
          avgScore: { $avg: '$results.overallScore' }
        }
      }
    ]);

    const completionStats = await Verification.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          completedAt: { $exists: true }
        }
      },
      {
        $project: {
          processingTime: {
            $subtract: ['$completedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgProcessingTime: { $avg: '$processingTime' },
          minProcessingTime: { $min: '$processingTime' },
          maxProcessingTime: { $max: '$processingTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        period,
        verificationStats: stats,
        completionStats: completionStats[0] || {}
      }
    });
  } catch (error) {
    logger.error('Get verification stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Retry failed verification
router.post('/:verificationId/retry', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { resetSteps = false } = req.body;

    const verification = await verificationService.retryVerification(verificationId, resetSteps);
    
    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    logger.error('Retry verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
