import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "No authentication token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token invalid or expired" });
  }

  try {
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }
    if ((decoded.tokenVersion ?? 0) !== req.user.tokenVersion) {
      return res.status(401).json({
        message: "Your session has expired. Please sign in again.",
      });
    }
    if (!req.user.isActive) {
      return res.status(403).json({
        message: "This account is inactive. Contact the store administrator.",
      });
    }
    if (req.user.role === "seller" && !req.user.sellerApproved) {
      return res.status(403).json({
        message: "Your seller account is awaiting admin approval.",
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Role '${req.user.role}' is not allowed to access this resource`,
      });
    }
    next();
  };
};
