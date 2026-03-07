const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const authMiddleware = (req, res, next) => {
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

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
    });
  }
};

module.exports = authMiddleware;
