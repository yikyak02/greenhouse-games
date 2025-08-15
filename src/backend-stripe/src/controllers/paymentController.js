import stripe from '../services/stripeService.js';
import database from '../services/supabaseService.js';

// Create payment intent from cart
export const createPaymentIntentFromCart = async (req, res) => {
  try {
    const { cartId, userId } = req.body;
    
    if (!cartId || !userId) {
      return res.status(400).json({ error: 'Cart ID and User ID are required' });
    }

    // Get cart items with prices
    const { data: items, error: itemsError } = await database
      .from('cart_items')
      .select(`
        quantity,
        games (
          game_id,
          title,
          price
        )
      `)
      .eq('cart_id', cartId);

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate total amount
    const amount = items.reduce((sum, item) => {
      return sum + (item.quantity * item.games.price);
    }, 0);

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      metadata: { 
        userId,
        cartId,
        gameIds: JSON.stringify(items.map(item => item.games.game_id))
      }
    });

    // Store payment in Supabase
    const { data: paymentData, error: paymentError } = await database
      .from('payments')
      .insert([{
        user_id: userId,
        cart_id: cartId,
        amount: amount,
        currency: 'usd',
        status: 'pending',
        stripe_payment_id: paymentIntent.id,
        description: `Payment for ${items.length} games`
      }])
      .select();

    if (paymentError) {
      console.error('Error saving payment:', paymentError);
      return res.status(500).json({ error: 'Failed to save payment record' });
    }

    // Create order record
    const { data: orderData, error: orderError } = await database
      .from('orders')
      .insert([{
        user_id: userId,
        payment_id: paymentData[0].payment_id,
        cart_id: cartId,
        total_amount: amount,
        status: 'created'
      }])
      .select();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentData[0].payment_id,
      orderId: orderData[0].order_id,
      amount
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Handle Stripe webhook (unchanged from previous implementation)
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handleSuccessfulPayment(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Helper function to handle successful payments
const handleSuccessfulPayment = async (paymentIntent) => {
  try {
    // Update payment status in Supabase
    const { error: paymentError } = await database
      .from('payments')
      .update({
        status: 'succeeded',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_id', paymentIntent.id);

    if (paymentError) throw paymentError;

    // Get the payment record to find the associated order
    const { data: paymentData, error: getPaymentError } = await database
      .from('payments')
      .select('payment_id, cart_id')
      .eq('stripe_payment_id', paymentIntent.id)
      .single();

    if (getPaymentError) throw getPaymentError;

    // Update order status
    const { error: orderError } = await database
      .from('orders')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentData.payment_id);

    if (orderError) throw orderError;

    // Clear the cart after successful payment
    const { error: clearCartError } = await database
      .from('cart_items')
      .delete()
      .eq('cart_id', paymentData.cart_id);

    if (clearCartError) throw clearCartError;

    console.log(`Successfully processed payment ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error processing successful payment:', error);
  }
};

// Helper function to handle failed payments (unchanged)
const handleFailedPayment = async (paymentIntent) => {
  try {
    const { error } = await database
      .from('payments')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_id', paymentIntent.id);

    if (error) throw error;

    console.log(`Marked payment ${paymentIntent.id} as failed`);

  } catch (error) {
    console.error('Error processing failed payment:', error);
  }
};

// Get payment history for a user
export const getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await database
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment history:', error);
      return res.status(500).json({ error: 'Failed to fetch payment history' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error in getPaymentHistory:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get order details with cart items
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order with payment details
    const { data: orderData, error: orderError } = await database
      .from('orders')
      .select(`
        *,
        payments (
          amount,
          currency,
          status as payment_status,
          stripe_payment_id,
          created_at as payment_date
        ),
        carts (
          cart_id,
          created_at as cart_created
        )
      `)
      .eq('order_id', orderId)
      .single();

    if (orderError) throw orderError;

    // Get cart items with game details
    const { data: itemsData, error: itemsError } = await database
      .from('cart_items')
      .select(`
        quantity,
        games (
          game_id,
          title,
          price,
          thumbnail_url
        )
      `)
      .eq('cart_id', orderData.carts.cart_id);

    if (itemsError) throw itemsError;

    return res.json({
      ...orderData,
      items: itemsData.map(item => ({
        quantity: item.quantity,
        ...item.games
      }))
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    return res.status(500).json({ error: error.message });
  }
};