const express = require('express');
const transactionController = require('../controllers/transaction.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Transaction routes
router.post('/', transactionController.createTransaction);
router.get('/:transactionId', transactionController.getTransaction);
router.get('/', transactionController.getTransactionHistory);

module.exports = router;