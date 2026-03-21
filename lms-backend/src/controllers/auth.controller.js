const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const mediaService = require('../services/media.service');
const db = require('../models');

const UserModel = db.models.User;

/**
 * Handle validation errors
 * @param {Object} req - Request object
 * @returns {Object|null} Validation error response or null
 */
const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return {
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array(),
    };
  }
  return null;
};

/**
 * Handle service errors and return appropriate HTTP response
 * @param {Error} error - Service error
 * @returns {Object} HTTP response object
 */
const handleServiceError = (error) => {
  if (error.status && error.message) {
    return {
      status: error.status,
      success: false,
      message: error.message,
    };
  }
  
  console.error('Unexpected error:', error);
  return {
    status: 500,
    success: false,
    message: 'Lỗi máy chủ',
    error: error.message,
  };
};

/**
 * ============= REGISTER =============
 */
exports.register = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await authService.registerUser(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận',
      data: result,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= UPLOAD AVATAR (CURRENT USER) =============
 */
exports.uploadAvatar = async (req, res) => {
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

    return res.json({
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

    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * ============= UPDATE CURRENT USER =============
 */
exports.updateCurrentUser = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

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

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

/**
 * ============= VERIFY EMAIL =============
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await authService.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email đã được xác nhận thành công. Bạn có thể đăng nhập ngay',
      data: result,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= VERIFY EMAIL BY CODE =============
 */
exports.verifyEmailByCode = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const { code } = req.body;
    const result = await authService.verifyEmail(code);
    
    res.json({
      success: true,
      message: 'Email đã được xác nhận thành công',
      data: result,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= LOGIN =============
 */
exports.login = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await authService.loginUser(req.body);
    
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: result,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= FORGOT PASSWORD =============
 */
exports.forgotPassword = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await authService.requestPasswordReset(req.body.email);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= RESET PASSWORD =============
 */
exports.resetPassword = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await authService.resetPassword(req.body);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= CHECK RESET PASSWORD TOKEN (GET via email link) =============
 */
exports.checkResetPasswordToken = async (req, res) => {
  try {
    const { token } = req.params;
    const result = await authService.checkResetPasswordToken(token);
    
    return res.json({
      success: true,
      message: 'Token hợp lệ. Hãy gọi POST /api/auth/reset-password để đặt lại mật khẩu.',
      data: result,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};

/**
 * ============= GET CURRENT USER =============
 */
exports.getCurrentUser = async (req, res) => {
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
};

/**
 * ============= RESEND VERIFICATION EMAIL =============
 */
exports.resendVerificationEmail = async (req, res) => {
  try {
    // Validate input
    const validationError = handleValidationErrors(req);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await authService.resendVerificationEmail(req.body.email);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const errorResponse = handleServiceError(error);
    res.status(errorResponse.status).json(errorResponse);
  }
};
