require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { authenticateToken } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const userActivityRoutes = require("./routes/activityRoutes")
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes); // Optional: expose auth routes
app.use('/api/activity', authenticateToken,  userActivityRoutes);
app.use('/api/user', authenticateToken, userRoutes); // ✅ Middleware for /api/user

app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected ✅');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
