import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

import gameRoutes from './routes/gameRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import gameCategoriesRoutes from './routes/gameCategoryRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

// Creates instance of express app
const app = express();
app.use(cors());
app.use(express.json());

// Routes registering
app.use('/api/games', gameRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/game-categories', gameCategoriesRoutes);
app.use('/api/users', userRoutes);

// Start the server and listen for HTTP requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
