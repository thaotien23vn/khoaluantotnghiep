const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token không được cung cấp',
      });
    }

    const decoded = jwt.verify(token, jwtConfig.secret);
    
    // Debug logs to track token information
    console.log('DEBUG Auth Middleware - Token decoded successfully');
    console.log('DEBUG Auth Middleware - User ID from token:', decoded.id);
    console.log('DEBUG Auth Middleware - User Role from token:', decoded.role);
    console.log('DEBUG Auth Middleware - User Email from token:', decoded.email);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.log('DEBUG Auth Middleware - Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
      error: error.message,
    });
  }
};

module.exports = authMiddleware;
