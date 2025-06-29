
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express from 'express';
import cors from 'cors';
import { connectToDatabase } from './config/database.js'; // Ensure .js extension
import codeRoutes from './routes/codeRoutes.js'; // Ensure .js extension

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 


// API routes
app.use('/api/code', codeRoutes);


// Start the Express server
app.listen(PORT, async () => {
    try{
        await connectToDatabase();
        console.log('Database connected successfully.');
        console.log(`Server running on http://localhost:${PORT}`);
    } catch (error) {
        console.error('Error connecting to the database:', error);
    }
  
});