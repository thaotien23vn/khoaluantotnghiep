const { validationResult } = require('express-validator');
const authService = require('../../services/auth.service');
const mediaService = require('../../services/media.service');
const db = require('../../models');

const UserModel = db.models.User;

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    });
  }
  return null;
};

/**
 * Handle service errors
 */
const handleServiceError = (error, res) => {
  if (error.status && error.message) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
  console.error('Unexpected error:', error);
  return res.status(500).json({
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  });
};

/**
 * Auth Controller - HTTP request handling
 */
class AuthController {
  /**
   * Register new user
   */
  async register(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await authService.registerUser(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await authService.loginUser(req.body);
      
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Verify email with token (from link)
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      const result = await authService.verifyEmail(token);
      
      res.json({
        success: true,
        message: 'Email đã được xác nhận thành công. Bạn có thể đăng nhập ngay',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Verify email with code
   */
  async verifyEmailByCode(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const { code } = req.body;
      const result = await authService.verifyEmail(code);
      
      res.json({
        success: true,
        message: 'Email đã được xác nhận thành công',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await authService.requestPasswordReset(req.body.email);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await authService.resetPassword(req.body);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Check reset password token
   */
  async checkResetPasswordToken(req, res) {
    try {
      const { token } = req.params;
      const result = await authService.checkResetPasswordToken(token);
      
      res.json({
        success: true,
        message: 'Token hợp lệ. Hãy gọi POST /api/auth/reset-password để đặt lại mật khẩu.',
        data: result,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(req, res) {
    try {
      const user = await UserModel.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy user',
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Lỗi lấy thông tin user:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  }

  /**
   * Update current user
   */
  async updateCurrentUser(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const user = await UserModel.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy user',
        });
      }

      const { name, phone, avatar } = req.body;

      if (name !== undefined) {
        user.name = name;
      }
      if (phone !== undefined) {
        user.phone = phone || null;
      }
      if (avatar !== undefined) {
        user.avatar = avatar || null;
      }

      await user.save();

      res.json({
        success: true,
        message: 'Cập nhật thông tin thành công',
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error('Lỗi cập nhật user:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(req, res) {
    try {
      const user = await UserModel.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy user',
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn file ảnh',
        });
      }

      if (!String(file.mimetype || '').startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ hỗ trợ upload ảnh',
        });
      }

      const uploaded = await mediaService.uploadLectureMedia(file);
      user.avatar = uploaded.url;
      await user.save();

      res.json({
        success: true,
        message: 'Upload avatar thành công',
        data: {
          uploaded,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            avatar: user.avatar,
            createdAt: user.createdAt,
            isEmailVerified: user.isEmailVerified,
          },
        },
      });
    } catch (error) {
      console.error('Lỗi upload avatar:', error);

      if (
        error &&
        (error.http_code === 400 || error.http_code === '400') &&
        String(error.message || '').toLowerCase().includes('invalid image file')
      ) {
        return res.status(400).json({
          success: false,
          message: 'File ảnh không hợp lệ',
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ',
        error: error.message,
      });
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(req, res) {
    try {
      const validationError = handleValidationErrors(req, res);
      if (validationError) return;

      const result = await authService.resendVerificationEmail(req.body.email);
      
      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      handleServiceError(error, res);
    }
  }
}

module.exports = new AuthController();
