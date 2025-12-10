import express from "express";
const router = express.Router();

import { authenticateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { createUser,getAllUsers } from "../controllers/userController.js";

router.get(
  "/admin/dashboard",
  authenticateToken,
  requireRole("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin!" });
  }
);

router.get("/aa", (req, res) => {
  res.json({ message: "Welcome Admin!" });
});

router.post("/createUser", createUser);
router.get("/getAllUsers", getAllUsers);
export default router;
