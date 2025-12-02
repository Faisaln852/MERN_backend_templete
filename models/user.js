// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  permissions: [String],
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
