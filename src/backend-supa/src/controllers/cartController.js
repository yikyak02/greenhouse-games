import database from '../services/supabaseService.js';

export const getUserCart = async (req, res) => {
    try {
        const { userId } = req.params;

        // check for existing active cart, need better boolean logic for this
        // need to set cart as inactive once checked out or just delete
        const { data: existingCart, error: cartError } = await database
            .from('carts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (cartError) {
            throw cartError;
        }

        let cart; 

        if (existingCart && existingCart.length > 0) {
            cart = existingCart[0];
        } else {

            // create new cart if an active cart does not already exist
            const { data: newCart, error: cartCreateError} = await database
                .from('carts')
                .insert([{ user_id: userId }])
                .select()
                .single();

            if (cartCreateError) {
                throw cartCreateError;
            }

            cart = newCart;
        }

        // amend to new schema
        const { data: items, error: itemsError } = await database
            .from('cart_items')
            .select(`
                cart_item_id,
                quantity,
                games (
                game_id,
                title,
                price,
                thumbnail_url
                )
            `)
            .eq('cart_id', cart.cart_id);
        
        if (itemsError) {
            throw itemsError;
        }

        return res.json({
            cart_id: cart.cart_id,
            items: items.map(item => ({
                cart_item_id: item.cart_item_id,
                quantity: item.quantity,
                ...item.games
            }))
        });
    } catch (error) {
        console.error('Error fetching user cart:', error);
        return res.status(500).json({ error: 'Failed to fetch user cart' });
    }
};

export const addToCart = async (req, res) => {
    try {
        const { cartId, gameId } = req.params;
        const { quantity = 1 } = req.body;

        // check if game exists
        const { data: game, error: gameError } = await database
            .from('games')
            .select('game_id')
            .eq('game_id', gameId)
            .single();

        if (gameError || !game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (itemError && itemError.code !== 'PGRST116') {
            throw itemError;
        }

        if (existingItem) {
            const { data: updatedItem, error: updateError } = await database
                .from('cart_items')
                .update({ quantity: existingItem.quantity + quantity })
                .eq('cart_item_id', existingItem.cart_item_id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            return res.json(updatedItem);
        } else {
            const { data: newItem, error: insertError } = await database
                .from('cart_items')
                .insert([{ cart_id: cartId, game_id: gameId, quantity }])
                .select()
                .single();

            if (insertError) { 
                throw insertError;
            }
            
            return res.status(201).json(newItem);
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        return res.status(500).json({ error: error.message });
    }
};

// update cart item quantity - update logic 
export const updateCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative' });
    }

    const { data: updatedItem, error } = await database
      .from('cart_items')
      .update({ quantity })
      .eq('cart_item_id', cartItemId)
      .select()
      .single();

    if (error) throw error;

    return res.json(updatedItem);

  } catch (error) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { cartItemId } = req.params;

    const { error } = await database
      .from('cart_items')
      .delete()
      .eq('cart_item_id', cartItemId);

    if (error) throw error;

    return res.status(204).send();

  } catch (error) {
    console.error('Error removing from cart:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const clearCart = async (req, res) => {
  try {
    const { cartId } = req.params;

    const { error } = await database
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);

    if (error) throw error;

    return res.status(204).send();

  } catch (error) {
    console.error('Error clearing cart:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getCartTotal = async (req, res) => {
  try {
    const { cartId } = req.params;

    //get all cart items with game prices
    const { data: items, error: itemsError } = await database
      .from('cart_items')
      .select(`
        quantity,
        games (
          price
        )
      `)
      .eq('cart_id', cartId);

    if (itemsError) throw itemsError;

    //calculate total
    const total = items.reduce((sum, item) => {
      return sum + (item.quantity * item.games.price);
    }, 0);

    return res.json({ total });

  } catch (error) {
    console.error('Error calculating cart total:', error);
    return res.status(500).json({ error: error.message });
  }
};