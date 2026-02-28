/**
 * Role-based authorization middleware
 * Checks if user has required role to access the endpoint
 */

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập trước',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền truy cập. Yêu cầu role: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = authorizeRole;
