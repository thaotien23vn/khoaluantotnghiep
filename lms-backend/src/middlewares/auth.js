const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const db = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token không được cung cấp',
      });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);

    const { User } = db.models;
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    // Always use current DB state to avoid stale role/profile from JWT payload
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      username: user.username,
      chatBannedUntil: user.chatBannedUntil,
      chatBanReason: user.chatBanReason,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
    });
  }
};

module.exports = authMiddleware;
