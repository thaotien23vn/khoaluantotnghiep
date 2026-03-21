const emailConfig = require('../config/email');

// Brevo API base URL
const BREVO_API_URL = 'https://api.brevo.com/v3';

// Kiểm tra cấu hình
function isConfigured() {
  return !!emailConfig.apiKey;
}

// Tạo sender object
function getSender() {
  return {
    name: emailConfig.fromName,
    email: emailConfig.fromEmail,
  };
}

// Gửi email qua Brevo REST API
async function sendEmailViaBrevo(toEmail, toName, subject, htmlContent) {
  if (!isConfigured()) {
    throw new Error('Thiếu BREVO_API_KEY');
  }

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
      subject: subject,
      htmlContent: htmlContent,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return await response.json();
}

// Gửi email xác nhận đăng ký
exports.sendVerificationEmail = async (email, name, verificationToken, verificationLink) => {
  if (!isConfigured()) {
    console.log('ℹ️  Bỏ qua gửi email - thiếu BREVO_API_KEY');
    return { success: false, skipped: true };
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
            ${verificationToken}
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
    const data = await sendEmailViaBrevo(email, name, 'Xác nhận email - Đăng ký tài khoản', htmlContent);
    console.log('✅ Đã gửi email xác nhận:', email, 'MessageId:', data.messageId);
    return { success: true, message: 'Email xác nhận đã được gửi', messageId: data.messageId };
  } catch (error) {
    console.error('⚠️  Lỗi gửi email:', error.message);
    return { success: false, error: error.message };
  }
};

// Gửi email đặt lại mật khẩu
exports.sendResetPasswordEmail = async (email, name, resetToken, resetLink) => {
  if (!isConfigured()) {
    console.log('ℹ️  Bỏ qua gửi email - thiếu BREVO_API_KEY');
    throw new Error('Email service not configured');
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
    await sendEmailViaBrevo(email, name, 'Đặt lại mật khẩu - EnglishLearning', htmlContent);
    console.log('✅ Đã gửi email reset password:', email);
    return { success: true, message: 'Email đặt lại mật khẩu đã được gửi' };
  } catch (error) {
    console.error('⚠️  Lỗi gửi email reset password:', error.message);
    throw error;
  }
};

// Kiểm tra kết nối email
exports.verifyEmailConnection = async () => {
  console.log('🔍 Brevo API Config:', {
    apiKey: emailConfig.apiKey ? '***' + emailConfig.apiKey.slice(-8) : undefined,
    fromEmail: emailConfig.fromEmail,
    fromName: emailConfig.fromName,
  });

  if (!isConfigured()) {
    console.log('✗ Thiếu BREVO_API_KEY');
    return false;
  }

  try {
    // Test API connection by getting account info
    const response = await fetch(`${BREVO_API_URL}/account`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api-key': emailConfig.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const account = await response.json();
    console.log('✅ Kết nối Brevo API thành công:', account.email);
    return true;
  } catch (error) {
    console.error('✗ Lỗi kết nối Brevo API:', error.message);
    return false;
  }
};
