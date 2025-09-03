const paymentService = require('../services/payment.service');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * Create payment
 * @route POST /api/payments
 */
exports.createPayment = async (req, res, next) => {
  try {
    const { 
      transactionId, 
      provider, 
      amount, 
      currency, 
      description,
      recipientInfo,
      metadata
    } = req.body;
    
    const userId = req.user.id;
    
    // Create payment with client info
    const result = await paymentService.createPayment({
      userId,
      transactionId,
      provider,
      amount,
      currency,
      description,
      recipientInfo,
      metadata,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      data: {
        payment: result.payment,
        nextAction: result.nextAction
      }
    });
  } catch (error) {
    logger.error(`Create payment error: ${error.message}`);
    next(error);
  }
};

/**
 * Create withdrawal
 * @route POST /api/payments/withdrawal
 */
exports.createWithdrawal = async (req, res, next) => {
  try {
    const { 
      transactionId, 
      provider, 
      amount, 
      currency, 
      description,
      recipientInfo,
      metadata
    } = req.body;
    
    const userId = req.user.id;
    
    // Create withdrawal with client info
    const result = await paymentService.createWithdrawal({
      userId,
      transactionId,
      provider,
      amount,
      currency,
      description,
      recipientInfo,
      metadata,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      success: true,
      message: 'Withdrawal created successfully',
      data: {
        payment: result.payment,
        nextAction: result.nextAction
      }
    });
  } catch (error) {
    logger.error(`Create withdrawal error: ${error.message}`);
    next(error);
  }
};

/**
 * Get payment by ID
 * @route GET /api/payments/:id
 */
exports.getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const payment = await paymentService.getPaymentById(id);
    
    // Check if user owns the payment or is admin
    if (payment.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to view this payment'));
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error(`Get payment error: ${error.message}`);
    next(error);
  }
};

/**
 * Get payment status
 * @route GET /api/payments/:id/status
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const payment = await paymentService.getPaymentStatus(id);
    
    // Check if user owns the payment or is admin
    if (payment.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to view this payment'));
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: payment._id,
        status: payment.status,
        amount: payment.amount,
        fee: payment.fee,
        provider: payment.provider,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      }
    });
  } catch (error) {
    logger.error(`Get payment status error: ${error.message}`);
    next(error);
  }
};

/**
 * Get user payments
 * @route GET /api/payments
 */
exports.getUserPayments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page, limit, type, provider, status, sort } = req.query;
    
    const result = await paymentService.getUserPayments(userId, {
      page,
      limit,
      type,
      provider,
      status,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.payments,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get user payments error: ${error.message}`);
    next(error);
  }
};

/**
 * Refund payment
 * @route POST /api/payments/:id/refund
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    // Get payment
    const payment = await paymentService.getPaymentById(id);
    
    // Check if user owns the payment or is admin
    if (payment.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to refund this payment'));
    }
    
    // Refund payment
    const refundedPayment = await paymentService.refundPayment(id, { amount, reason });
    
    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: refundedPayment
    });
  } catch (error) {
    logger.error(`Refund payment error: ${error.message}`);
    next(error);
  }
};

/**
 * Cancel payment
 * @route POST /api/payments/:id/cancel
 */
exports.cancelPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get payment
    const payment = await paymentService.getPaymentById(id);
    
    // Check if user owns the payment or is admin
    if (payment.userId !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to cancel this payment'));
    }
    
    // Cancel payment
    const cancelledPayment = await paymentService.cancelPayment(id, { reason });
    
    res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: cancelledPayment
    });
  } catch (error) {
    logger.error(`Cancel payment error: ${error.message}`);
    next(error);
  }
};

/**
 * Create payment (internal)
 * @route POST /api/payments/internal
 */
exports.createInternalPayment = async (req, res, next) => {
  try {
    const { 
      userId, 
      transactionId, 
      provider, 
      amount, 
      currency, 
      description,
      recipientInfo,
      metadata
    } = req.body;
    
    // Create payment
    const result = await paymentService.createPayment({
      userId,
      transactionId,
      provider,
      amount,
      currency,
      description,
      recipientInfo,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Internal payment created successfully',
      data: {
        payment: result.payment,
        nextAction: result.nextAction
      }
    });
  } catch (error) {
    logger.error(`Create internal payment error: ${error.message}`);
    next(error);
  }
};

/**
 * Create withdrawal (internal)
 * @route POST /api/payments/internal/withdrawal
 */
exports.createInternalWithdrawal = async (req, res, next) => {
  try {
    const { 
      userId, 
      transactionId, 
      provider, 
      amount, 
      currency, 
      description,
      recipientInfo,
      metadata
    } = req.body;
    
    // Create withdrawal
    const result = await paymentService.createWithdrawal({
      userId,
      transactionId,
      provider,
      amount,
      currency,
      description,
      recipientInfo,
      metadata
    });
    
    res.status(201).json({
      success: true,
      message: 'Internal withdrawal created successfully',
      data: {
        payment: result.payment,
        nextAction: result.nextAction
      }
    });
  } catch (error) {
    logger.error(`Create internal withdrawal error: ${error.message}`);
    next(error);
  }
};

/**
 * Get all payments (admin only)
 * @route GET /api/payments/admin/all
 */
exports.getAllPayments = async (req, res, next) => {
  try {
    const { 
      page, 
      limit, 
      type, 
      provider,
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort 
    } = req.query;
    
    const result = await paymentService.getAllPayments({
      page,
      limit,
      type,
      provider,
      status,
      userId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort
    });
    
    res.status(200).json({
      success: true,
      data: result.payments,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error(`Get all payments error: ${error.message}`);
    next(error);
  }
};

/**
 * Get payment statistics (admin only)
 * @route GET /api/payments/admin/statistics
 */
exports.getPaymentStatistics = async (req, res, next) => {
  try {
    const statistics = await paymentService.getPaymentStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Get payment statistics error: ${error.message}`);
    next(error);
  }
};