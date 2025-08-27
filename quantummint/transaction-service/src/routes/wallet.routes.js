const express = require('express');
const walletController = require('../controllers/wallet.controller');
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Wallet routes
router.post('/', walletController.createWallet);
router.get('/', walletController.getUserWallets);
router.get('/:walletId', walletController.getWallet);
router.patch('/:walletId/status', walletController.updateWalletStatus);
router.patch('/:walletId/name', walletController.updateWalletName);

module.exports = router;