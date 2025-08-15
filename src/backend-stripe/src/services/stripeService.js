import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[ERROR] Stripe secret key is not set in environment variables');
    throw new Error('Stripe secret key is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default stripe;