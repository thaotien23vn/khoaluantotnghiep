const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const { validationResult } = require('express-validator');
const jwtConfig = require('../config/jwt');
const emailService = require('../services/email.service');
const mediaService = require('../services/media.service');
const db = require('../models');
const { Op } = require('sequelize');

// models are under db.models because index exports {sequelize, connectDB, models}
const UserModel = db.models.User;

// Generate random token (used for things like password reset)
const generateToken = () => crypto.randomBytes(32).toString('hex');

// helper: create six-digit verification code
const generateNumericCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// ============= REGISTER =============
exports.register = async (req, res) => {
  try {
    // Kiểm tra lỗi validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array(),
      });
    }

    const { name, username, email, phone, password } = req.body;

    // Kiểm tra email hoặc username đã tồn tại
    const existingUser = await UserModel.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });
    if (existingUser) {
      const conflictField = existingUser.email === email ? 'Email' : 'Tên đăng nhập';
      return res.status(409).json({
        success: false,
        message: `${conflictField} đã được sử dụng`,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo mã xác nhận 6 chữ số
    const emailVerificationToken = generateNumericCode();

    // Tạo user mới
    const user = await UserModel.create({
      name,
      username,
      email,
      phone,
      passwordHash: hashedPassword,
      role: 'student',
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 giờ
    });

    // Gửi email xác nhận
    const verificationLink = `http://localhost:5000/api/auth/verify-email/${emailVerificationToken}`;
    try {
      await emailService.sendVerificationEmail(email, name, emailVerificationToken, verificationLink);
    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
      // Xóa user nếu không gửi được email
      await user.destroy();
      return res.status(500).json({
        success: false,
        message: 'Lỗi gửi email xác nhận. Vui lòng thử lại sau',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản',
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        verificationCode: emailVerificationToken,
      },
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= UPLOAD AVATAR (CURRENT USER) =============
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

// ============= UPDATE CURRENT USER =============
exports.updateCurrentUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array(),
      });
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

// ============= VERIFY EMAIL =============
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token không được cung cấp',
      });
    }

    // Tìm user theo token
    const user = await UserModel.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }

    // Kiểm tra token hết hạn
    if (new Date() > user.emailVerificationTokenExpires) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    // Cập nhật user
    await user.update({
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    });

    res.json({
      success: true,
      message: 'Email đã được xác nhận thành công. Bạn có thể đăng nhập ngay',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi xác nhận email:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= VERIFY EMAIL BY CODE =============
exports.verifyEmailByCode = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token không được cung cấp',
      });
    }

    // Tìm user theo token
    const user = await UserModel.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }

    // Kiểm tra token hết hạn
    if (new Date() > user.emailVerificationTokenExpires) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    // Cập nhật user
    await user.update({
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
    });

    res.json({
      success: true,
      message: 'Email đã được xác nhận thành công',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    console.error('Lỗi xác nhận email:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= LOGIN =============
exports.login = async (req, res) => {
  try {
    // Kiểm tra lỗi validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array(),
      });
    }

    const { email, username, password } = req.body;

    // tìm user theo email hoặc username
    let user;
    if (email) {
      user = await UserModel.findOne({ where: { email } });
    } else if (username) {
      user = await UserModel.findOne({ where: { username } });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email/tên đăng nhập hoặc mật khẩu không đúng',
      });
    }

    // Kiểm tra email đã được xác nhận
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email chưa được xác nhận. Vui lòng kiểm tra email',
      });
    }

    // Kiểm tra tài khoản còn hoạt động
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= FORGOT PASSWORD =============
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email không được cung cấp',
      });
    }

    // Tìm user theo email
    const user = await UserModel.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này',
      });
    }

    // Tạo reset password token
    const resetPasswordToken = generateToken();

    // Cập nhật user với token
    await user.update({
      resetPasswordToken,
      resetPasswordTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 giờ
    });

    // Gửi email reset password
    const feBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${String(feBaseUrl).replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(resetPasswordToken)}`;
    try {
      await emailService.sendResetPasswordEmail(email, user.name, resetPasswordToken, resetLink);
    } catch (emailError) {
      console.error('Lỗi gửi email reset password:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Lỗi gửi email. Vui lòng thử lại sau',
      });
    }

    res.json({
      success: true,
      message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email',
    });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= RESET PASSWORD =============
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, mật khẩu và xác nhận mật khẩu không được trống',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu không khớp',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự',
      });
    }

    // Tìm user theo reset password token
    const user = await UserModel.findOne({
      where: { resetPasswordToken: token },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }

    // Kiểm tra token hết hạn
    if (new Date() > user.resetPasswordTokenExpires) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    // Hash password mới
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cập nhật mật khẩu
    await user.update({
      passwordHash: hashedPassword,
      resetPasswordToken: null,
      resetPasswordTokenExpires: null,
    });

    res.json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập',
    });
  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= CHECK RESET PASSWORD TOKEN (GET via email link) =============
exports.checkResetPasswordToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token không được cung cấp',
      });
    }

    const user = await UserModel.findOne({
      where: { resetPasswordToken: token },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }

    if (new Date() > user.resetPasswordTokenExpires) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn',
      });
    }

    return res.json({
      success: true,
      message: 'Token hợp lệ. Hãy gọi POST /api/auth/reset-password để đặt lại mật khẩu.',
      data: {
        token,
        expiresAt: user.resetPasswordTokenExpires,
      },
    });
  } catch (error) {
    console.error('Lỗi kiểm tra reset token:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= GET CURRENT USER =============
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

// ============= RESEND VERIFICATION EMAIL =============
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email không được cung cấp',
      });
    }

    // Tìm user theo email
    const user = await UserModel.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản với email này',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được xác nhận rồi',
      });
    }

    // Tạo verification token mới
    const emailVerificationToken = generateNumericCode();

    // Cập nhật user
    await user.update({
      emailVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 giờ
    });

    // Gửi email xác nhận
    const verificationLink = `http://localhost:5000/api/auth/verify-email/${emailVerificationToken}`;
    try {
      await emailService.sendVerificationEmail(email, user.name, emailVerificationToken, verificationLink);
    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Lỗi gửi email. Vui lòng thử lại sau',
      });
    }

    res.json({
      success: true,
      message: 'Email xác nhận đã được gửi lại. Vui lòng kiểm tra email',
    });
  } catch (error) {
    console.error('Lỗi gửi lại email:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= GOOGLE OAUTH =============
exports.googleAuth = (req, res, next) => {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || 
      !process.env.GOOGLE_CLIENT_SECRET || 
      process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here' ||
      process.env.GOOGLE_CLIENT_SECRET === 'your_google_client_secret_here') {
    
    return res.status(503).json({
      success: false,
      message: 'Google OAuth chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    });
  }
  
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })(req, res, next);
};

exports.googleAuthCallback = (req, res, next) => {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || 
      !process.env.GOOGLE_CLIENT_SECRET || 
      process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here' ||
      process.env.GOOGLE_CLIENT_SECRET === 'your_google_client_secret_here') {
    
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_not_configured`);
  }
  
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`);
    }

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_user`);
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    }))}`;
    
    res.redirect(redirectUrl);
  })(req, res, next);
};
