// models/userModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
const userSchema = new mongoose.Schema({
name: { type: String, required: true },
  email: { type: String, required: true },
  password: String,
  age: String,
  description: String,

  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  permissions: [String],
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
