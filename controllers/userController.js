import User from "../models/user.js";
import crypto from "crypto"; // Node.js built-in module for generating random bytes

export const createUser = async (req, res) => {
  const { name, email, age, description } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate a random password
    const randomPassword = crypto.randomBytes(6).toString('hex'); // 12-character hex string

    // Create the user
    const user = await User.create({
      name,
      email,
      password: randomPassword,
      age,
      description
    });

    res.status(201).json({ 
      message: 'User created successfully', 
      user: {
        ...user.toObject(),
        password: undefined // Don't send the password in the response
      },
      initialPassword: randomPassword // optionally send the initial password
    });
  } catch (error) {
    console.log({ message: error.message });
    return res.status(400).json({ message: error.message });
  }
};
export const getAllUsers = async (req, res) => {
  try {
    // Fetch all users but exclude the password field
    const users = await User.find().select("-password");

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export default { createUser,getAllUsers };
