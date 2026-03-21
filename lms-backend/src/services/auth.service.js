const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const jwtConfig = require('../config/jwt');
const emailService = require('./email.service');

const UserModel = db.models.User;

/**
 * Generate secure random token (32 bytes hex)
 * @returns {string} Secure random token
 */
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Generate 6-digit numeric verification code
 * @returns {string} 6-digit numeric code
 */
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Hash token for secure storage
 * @param {string} token - Plain token
 * @returns {Promise<string>} Hashed token
 */
const hashToken = async (token) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
};

/**
 * Verify token against hash
 * @param {string} plainToken - Plain token
 * @param {string} hashedToken - Hashed token
 * @returns {Promise<boolean>} Verification result
 */
const verifyToken = async (plainToken, hashedToken) => {
  return bcrypt.compare(plainToken, hashedToken);
};

/**
 * Create JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const createJWTToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration result
 */
const registerUser = async (userData) => {
  const { name, username, email, phone, password } = userData;

  // Check if email or username already exists
  const existingUser = await UserModel.findOne({
    where: {
      [Op.or]: [{ email }, { username }],
    },
  });

  if (existingUser) {
    const conflictField = existingUser.email === email ? 'email' : 'username';
    throw {
      status: 409,
      message: `${conflictField === 'email' ? 'Email' : 'Tên đăng nhập'} đã được sử dụng`,
      field: conflictField,
    };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate verification code
  const verificationCode = generateVerificationCode();

  // Create user
  const user = await UserModel.create({
    name,
    username,
    email,
    phone,
    passwordHash: hashedPassword,
    role: 'student',
    isEmailVerified: false,
    emailVerificationToken: verificationCode,
    emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  // Send verification email (fire and forget)
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationCode}`;
  emailService.sendVerificationEmail(email, name, verificationCode, verificationLink)
    .then(result => {
      if (result.success) {
        console.log('✅ Verification email sent:', email);
      } else {
      }
    })
    .catch(err => {});

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
    verificationCode, // Only for testing, should not be exposed in production
  };
};

/**
 * Verify email with code
 * @param {string} code - Verification code
 * @returns {Promise<Object>} Verification result
 */
const verifyEmail = async (code) => {
  if (!code) {
    throw {
      status: 400,
      message: 'Mã xác nhận không được cung cấp',
    };
  }

  // Find user by verification code
  const user = await UserModel.findOne({
    where: { emailVerificationToken: code },
  });

  if (!user) {
    throw {
      status: 404,
      message: 'Mã xác nhận không hợp lệ',
    };
  }

  // Check if token expired
  if (new Date() > user.emailVerificationTokenExpires) {
    throw {
      status: 400,
      message: 'Mã xác nhận đã hết hạn',
    };
  }

  // Update user
  await user.update({
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationTokenExpires: null,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
  };
};

/**
 * Login user
 * @param {Object} loginData - Login credentials
 * @returns {Promise<Object>} Login result
 */
const loginUser = async (loginData) => {
  const { email, username, password } = loginData;

  // Find user by email or username
  let user;
  if (email) {
    user = await UserModel.findOne({ where: { email } });
  } else if (username) {
    user = await UserModel.findOne({ where: { username } });
  }

  if (!user) {
    throw {
      status: 401,
      message: 'Email/tên đăng nhập hoặc mật khẩu không đúng',
    };
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    throw {
      status: 403,
      message: 'Email chưa được xác nhận. Vui lòng kiểm tra email',
    };
  }

  // Check if account is active
  if (!user.isActive) {
    throw {
      status: 403,
      message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
    };
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  
  if (!isPasswordValid) {
    throw {
      status: 401,
      message: 'Email/tên đăng nhập hoặc mật khẩu không đúng',
    };
  }

  // Create JWT token
  const token = createJWTToken(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    token,
  };
};

/**
 * Request password reset
 * @param {string} email - User email
 * @returns {Promise<Object>} Password reset result
 */
const requestPasswordReset = async (email) => {
  if (!email) {
    throw {
      status: 400,
      message: 'Email không được cung cấp',
    };
  }

  // Find user by email
  const user = await UserModel.findOne({ where: { email } });
  if (!user) {
    throw {
      status: 404,
      message: 'Không tìm thấy tài khoản với email này',
    };
  }

  // Generate reset token
  const resetToken = generateSecureToken();
  const hashedResetToken = await hashToken(resetToken);

  // Update user with reset token
  await user.update({
    resetPasswordToken: hashedResetToken,
    resetPasswordTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  // Send reset password email
  const feBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${String(feBaseUrl).replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  
  try {
    await emailService.sendResetPasswordEmail(email, user.name, resetToken, resetLink);
  } catch (emailError) {
    console.error('Failed to send reset password email:', emailError);
    throw {
      status: 500,
      message: 'Lỗi gửi email. Vui lòng thử lại sau',
    };
  }

  return {
    message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email',
  };
};

/**
 * Reset password with token
 * @param {Object} resetData - Reset password data
 * @returns {Promise<Object>} Reset result
 */
const resetPassword = async (resetData) => {
  const { token, password, confirmPassword } = resetData;

  if (!token || !password || !confirmPassword) {
    throw {
      status: 400,
      message: 'Token, mật khẩu và xác nhận mật khẩu không được trống',
    };
  }

  if (password !== confirmPassword) {
    throw {
      status: 400,
      message: 'Mật khẩu không khớp',
    };
  }

  if (password.length < 6) {
    throw {
      status: 400,
      message: 'Mật khẩu phải có ít nhất 6 ký tự',
    };
  }

  // Find user by reset token (need to check all users since token is hashed)
  const users = await UserModel.findAll({
    where: {
      resetPasswordToken: {
        [Op.ne]: null,
      },
    },
  });

  let user = null;
  for (const u of users) {
    const isValidToken = await verifyToken(token, u.resetPasswordToken);
    if (isValidToken) {
      user = u;
      break;
    }
  }

  if (!user) {
    throw {
      status: 404,
      message: 'Token không hợp lệ',
    };
  }

  // Check if token expired
  if (new Date() > user.resetPasswordTokenExpires) {
    throw {
      status: 400,
      message: 'Token đã hết hạn',
    };
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update password
  await user.update({
    passwordHash: hashedPassword,
    resetPasswordToken: null,
    resetPasswordTokenExpires: null,
  });

  return {
    message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập',
  };
};

/**
 * Check reset password token validity
 * @param {string} token - Reset token
 * @returns {Promise<Object>} Token check result
 */
const checkResetPasswordToken = async (token) => {
  if (!token) {
    throw {
      status: 400,
      message: 'Token không được cung cấp',
    };
  }

  // Find user by reset token (need to check all users since token is hashed)
  const users = await UserModel.findAll({
    where: {
      resetPasswordToken: {
        [Op.ne]: null,
      },
    },
  });

  let user = null;
  for (const u of users) {
    const isValidToken = await verifyToken(token, u.resetPasswordToken);
    if (isValidToken) {
      user = u;
      break;
    }
  }

  if (!user) {
    throw {
      status: 404,
      message: 'Token không hợp lệ',
    };
  }

  if (new Date() > user.resetPasswordTokenExpires) {
    throw {
      status: 400,
      message: 'Token đã hết hạn',
    };
  }

  return {
    token,
    expiresAt: user.resetPasswordTokenExpires,
  };
};

/**
 * Resend verification email
 * @param {string} email - User email
 * @returns {Promise<Object>} Resend result
 */
const resendVerificationEmail = async (email) => {
  if (!email) {
    throw {
      status: 400,
      message: 'Email không được cung cấp',
    };
  }

  // Find user by email
  const user = await UserModel.findOne({ where: { email } });
  if (!user) {
    throw {
      status: 404,
      message: 'Không tìm thấy tài khoản với email này',
    };
  }

  if (user.isEmailVerified) {
    throw {
      status: 400,
      message: 'Email đã được xác nhận rồi',
    };
  }

  // Generate new verification code
  const verificationCode = generateVerificationCode();

  // Update user
  await user.update({
    emailVerificationToken: verificationCode,
    emailVerificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  // Send verification email
  const verificationLink = `http://localhost:5000/api/auth/verify-email/${verificationCode}`;
  
  try {
    await emailService.sendVerificationEmail(email, user.name, verificationCode, verificationLink);
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    throw {
      status: 500,
      message: 'Lỗi gửi email. Vui lòng thử lại sau',
    };
  }

  return {
    message: 'Email xác nhận đã được gửi lại. Vui lòng kiểm tra email',
  };
};

module.exports = {
  registerUser,
  verifyEmail,
  loginUser,
  requestPasswordReset,
  resetPassword,
  checkResetPasswordToken,
  resendVerificationEmail,
  generateSecureToken,
  generateVerificationCode,
  hashToken,
  verifyToken,
  createJWTToken,
};
