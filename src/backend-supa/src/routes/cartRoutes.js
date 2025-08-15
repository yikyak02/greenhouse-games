import express from 'express';
import {
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartTotal
} from '../controllers/cartController.js';

const router = express.Router();

// Get or create user's cart
router.get('/user/:userId', getUserCart);

// Add item to cart
router.post('/:cartId/items/:gameId', addToCart);

// Update cart item quantity
router.put('/items/:cartItemId', updateCartItem);

// Remove item from cart
router.delete('/items/:cartItemId', removeFromCart);

// Clear cart
router.delete('/:cartId/clear', clearCart);

// Get cart total
router.get('/:cartId/total', getCartTotal);

export default router;