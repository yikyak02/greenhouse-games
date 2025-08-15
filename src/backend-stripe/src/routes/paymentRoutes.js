import express from 'express';

import {
  createPaymentIntentFromCart,
  handleStripeWebhook,
  getPaymentHistory,
  getOrderDetails
} from '../controllers/paymentController.js';

const router = express.Router();

// Create payment intent from cart
router.post('/create-from-cart', createPaymentIntentFromCart);

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Get payment history for a user
router.get('/history/:userId', getPaymentHistory);

// Get order details
router.get('/order/:orderId', getOrderDetails);

export default router;