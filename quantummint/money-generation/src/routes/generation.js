const express = require('express');
const { validate } = require('../../../shared/utils/validation');
const { schemas } = require('../../../shared/utils/validation');
const { authenticate } = require('../middleware/auth');
const {
  generateMoney,
  getGenerationHistory,
  getGenerationById,
  cancelGeneration
} = require('../controllers/generationController');

const router = express.Router();

// @route   POST /api/generation/generate
// @desc    Generate money
// @access  Private
router.post('/generate', authenticate, validate(schemas.moneyGeneration), generateMoney);

// @route   GET /api/generation/history
// @desc    Get generation history
// @access  Private
router.get('/history', authenticate, validate(schemas.pagination, 'query'), getGenerationHistory);

// @route   GET /api/generation/:id
// @desc    Get generation by ID
// @access  Private
router.get('/:id', authenticate, getGenerationById);

// @route   PUT /api/generation/:id/cancel
// @desc    Cancel generation
// @access  Private
router.put('/:id/cancel', authenticate, cancelGeneration);

module.exports = router;
