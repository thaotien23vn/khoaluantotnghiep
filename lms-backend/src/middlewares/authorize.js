/**
 * Role-based authorization middleware
 * Checks if user has required role to access the endpoint.
 * Để luôn dùng role mới nhất trong DB (khi admin đổi role),
 * middleware sẽ đọc role từ bảng users thay vì tin hoàn toàn vào token.
 */

const db = require('../models');

const authorizeRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Vui lòng đăng nhập trước',
        });
      }

      const { User } = db.models;

      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại',
        });
      }

      const currentRole = user.role;
      
      // Check role không phân biệt hoa thường
      const normalizedCurrentRole = currentRole?.toLowerCase();
      const normalizedAllowedRoles = allowedRoles.map(r => r?.toLowerCase());

      if (!normalizedAllowedRoles.includes(normalizedCurrentRole)) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền truy cập. Yêu cầu role: ${allowedRoles.join(
            ', ',
          )}. Hiện tại: ${currentRole}`,
        });
      }

      // Gắn user đầy đủ để controller có thể dùng nếu cần
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
      return res.status(500).json({
        success: false,
        message: 'Lỗi kiểm tra quyền truy cập',
        error: error.message,
      });
    }
  };
};

// Convenience functions for common role checks
const requireStudent = authorizeRole('student');
const requireTeacher = authorizeRole('teacher');
const requireAdmin = authorizeRole('admin');
const requireTeacherOrAdmin = authorizeRole('teacher', 'admin');
const requireStudentOrAdmin = authorizeRole('student', 'admin');

module.exports = {
  authorizeRole,
  requireStudent,
  requireTeacher,
  requireAdmin,
  requireTeacherOrAdmin,
  requireStudentOrAdmin,
};
