import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import { authenticateToken } from './middleware/auth.js';

import authRoutes from './routes/authRoutes.js';
import userActivityRoutes from './routes/activityRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/activity', authenticateToken, userActivityRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected ✅');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
