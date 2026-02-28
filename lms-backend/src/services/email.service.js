const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');

// Tạo transporter
const transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: emailConfig.port,
  secure: false, // true for 465, false for other ports
  auth: {
    user: emailConfig.user,
    pass: emailConfig.password,
  },
});

// Gửi email xác nhận đăng ký (mã 6 chữ số)
exports.sendVerificationEmail = async (email, name, verificationToken, verificationLink) => {
  const mailOptions = {
    from: `${emailConfig.fromName} <${emailConfig.user}>`,
    to: email,
    subject: 'Xác nhận email - Đăng ký tài khoản LMS',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333;">Chào ${name}!</h2>
          <p style="color: #666; font-size: 16px;">
            Cảm ơn bạn đã đăng ký tài khoản trên LMS. 
            Vui lòng dùng mã bên dưới để xác nhận email của bạn.
          </p>
          <div style="margin: 30px 0; font-size: 24px; font-weight: bold;">
            Mã xác nhận của bạn: <code>${verificationToken}</code>
          </div>
          <p style="color: #999; font-size: 14px;">
            Mã này sẽ hết hạn trong 24 giờ.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Email xác nhận đã được gửi' };
  } catch (error) {
    console.error('Lỗi gửi email:', error);
    throw error;
  }
};

// Gửi email đặt lại mật khẩu
exports.sendResetPasswordEmail = async (email, name, resetToken, resetLink) => {
  const mailOptions = {
    from: `${emailConfig.fromName} <${emailConfig.user}>`,
    to: email,
    subject: 'Đặt lại mật khẩu - LMS',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 10px;">
          <h2 style="color: #333;">Xin chào ${name}!</h2>
          <p style="color: #666; font-size: 16px;">
            Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản LMS của mình.
            Vui lòng nhấp vào nút bên dưới để đặt lại mật khẩu.
          </p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Đặt lại mật khẩu
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            Hoặc sao chép token này vào form: <code>${resetToken}</code>
          </p>
          <p style="color: #999; font-size: 14px;">
            Link này sẽ hết hạn trong 1 giờ.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Email đặt lại mật khẩu đã được gửi' };
  } catch (error) {
    console.error('Lỗi gửi email:', error);
    throw error;
  }
};

// Kiểm tra kết nối email
exports.verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✓ Kết nối email thành công');
    return true;
  } catch (error) {
    console.error('✗ Lỗi kết nối email:', error);
    return false;
  }
};
