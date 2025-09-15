import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import gameRoutes from './routes/gameRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import gameCategoriesRoutes from './routes/gameCategoryRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
//import paymentRoutes from '../../backend-stripe/src/routes/paymentRoutes.js';
import { sendSignupNotification, sendPurchaseConfirmation } from './services/notificationService.js';

dotenv.config();

// Creates instance of express app
const app = express();
app.use(cors());
app.use(express.json());

// Test endpoints for notification service
app.post('/test-signup-email', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    console.log(`Testing signup email to: ${email}`);
    const result = await sendSignupNotification(email, name);
    
    res.json({ 
      success: result, 
      message: result ? 'Signup email sent successfully!' : 'Failed to send signup email',
      email: email,
      name: name
    });
  } catch (error) {
    console.error('Test signup email error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/test-purchase-email', async (req, res) => {
  try {
    const { email, name, items, amount, currency, orderId } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    console.log(`Testing purchase email to: ${email}`);
    const result = await sendPurchaseConfirmation({
      to: email,
      name: name || 'Test User',
      items: items || [
        { games: { title: 'Test Game 1', price: 19.99 }, quantity: 1 },
        { games: { title: 'Test Game 2', price: 29.99 }, quantity: 2 }
      ],
      amount: amount || 69.97,
      currency: currency || 'USD',
      orderId: orderId || 'TEST-12345'
    });
    
    res.json({ 
      success: result, 
      message: result ? 'Purchase email sent successfully!' : 'Failed to send purchase email',
      email: email,
      orderId: orderId || 'TEST-12345'
    });
  } catch (error) {
    console.error('Test purchase email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Routes registering
app.use('/api/games', gameRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/game-categories', gameCategoriesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
//app.use('/api/payments', paymentRoutes);

// Start the server and listen for HTTP requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
