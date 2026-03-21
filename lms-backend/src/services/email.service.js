const emailConfig = require('../config/email');

// Brevo API base URL
const BREVO_API_URL = 'https://api.brevo.com/v3';

/**
 * Check if email service is configured
 * @returns {boolean} Configuration status
 */
const isConfigured = () => !!emailConfig.apiKey;

/**
 * Get sender object for emails
 * @returns {Object} Sender information
 */
const getSender = () => ({
  name: emailConfig.fromName,
  email: emailConfig.fromEmail,
});

/**
 * Send email via Brevo REST API
 * @param {string} toEmail - Recipient email
 * @param {string} toName - Recipient name
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email HTML content
 * @returns {Promise<Object>} Send result
 */
const sendEmailViaBrevo = async (toEmail, toName, subject, htmlContent) => {
  if (!isConfigured()) {
    throw new Error('Email service not configured - missing BREVO_API_KEY');
  }

  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': emailConfig.apiKey,
      },
      body: JSON.stringify({
        sender: getSender(),
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId, data };
  } catch (error) {
    console.error('Brevo API error:', error.message);
    throw error;
  }
};

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} verificationCode - Verification code
 * @param {string} verificationLink - Verification link
 * @returns {Promise<Object>} Send result
 */
const sendVerificationEmail = async (email, name, verificationCode, verificationLink) => {
  if (!isConfigured()) {
    console.log('ℹ️  Skipping email send - BREVO_API_KEY not configured');
    return { success: false, skipped: true, error: 'Email service not configured' };
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Xin chào ${name}!</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Cảm ơn bạn đã đăng ký tài khoản trên <strong>EnglishLearning</strong>.
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Vui lòng dùng mã bên dưới để xác nhận email của bạn:
        </p>
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 5px;">
            ${verificationCode}
          </span>
        </div>
        <p style="color: #999; font-size: 14px;">
          Mã này sẽ hết hạn trong 24 giờ.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmailViaBrevo(email, name, 'Xác nhận email - Đăng ký tài khoản', htmlContent);
    console.log('✅ Verification email sent:', email, 'MessageId:', result.messageId);
    return { success: true, message: 'Email xác nhận đã được gửi', messageId: result.messageId };
  } catch (error) {
    console.error('⚠️  Failed to send verification email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send reset password email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} resetToken - Reset token
 * @param {string} resetLink - Reset link
 * @returns {Promise<Object>} Send result
 */
const sendResetPasswordEmail = async (email, name, resetToken, resetLink) => {
  if (!isConfigured()) {
    throw new Error('Email service not configured - missing BREVO_API_KEY');
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h2 style="color: #333; margin-bottom: 20px;">Xin chào ${name}!</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>EnglishLearning</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #1976d2; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p style="color: #666; font-size: 14px; text-align: center;">
          Hoặc sao chép mã này: <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${resetToken}</code>
        </p>
        <p style="color: #999; font-size: 14px;">
          Link này sẽ hết hạn trong 1 giờ.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmailViaBrevo(email, name, 'Đặt lại mật khẩu - EnglishLearning', htmlContent);
    console.log('✅ Reset password email sent:', email, 'MessageId:', result.messageId);
    return { success: true, message: 'Email đặt lại mật khẩu đã được gửi', messageId: result.messageId };
  } catch (error) {
    console.error('⚠️  Failed to send reset password email:', error.message);
    throw error;
  }
};

/**
 * Verify email service connection
 * @returns {Promise<boolean>} Connection status
 */
const verifyEmailConnection = async () => {
  console.log('🔍 Brevo API Config:', {
    apiKey: emailConfig.apiKey ? '***' + emailConfig.apiKey.slice(-8) : undefined,
    fromEmail: emailConfig.fromEmail,
    fromName: emailConfig.fromName,
  });

  if (!isConfigured()) {
    console.log('✗ Missing BREVO_API_KEY');
    return false;
  }

  try {
    const response = await fetch(`${BREVO_API_URL}/account`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': emailConfig.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const account = await response.json();
    console.log('✅ Brevo API connection successful:', account.email);
    return true;
  } catch (error) {
    console.error('✗ Brevo API connection error:', error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
  verifyEmailConnection,
  isConfigured,
  sendEmailViaBrevo,
};
