/**
 * MoMo Payment Service - Tích hợp thanh toán MoMo
 * Hỗ trợ cả Sandbox (test) và Production (thật)
 */

const crypto = require('crypto');

class MoMoService {
  constructor() {
    // Cấu hình từ biến môi trường
    this.partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
    this.accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
    this.secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PDHzmkL7tX9';
    this.redirectUrl = process.env.MOMO_REDIRECT_URL || 'https://cicd-test1.onrender.com/payment/momo/return';
    this.ipnUrl = process.env.MOMO_IPN_URL || 'https://cicd-test1.onrender.com/api/payments/momo/ipn';
    this.isSandbox = process.env.MOMO_SANDBOX !== 'false';
    
    // API endpoints
    this.apiEndpoint = this.isSandbox
      ? 'https://test-payment.momo.vn/v2/gateway/api/create'
      : 'https://payment.momo.vn/v2/gateway/api/create';
  }

  /**
   * Tạo chữ ký HMAC SHA256 cho MoMo
   */
  _createSignature(rawSignature) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
  }

  /**
   * Tạo request thanh toán MoMo
   * @param {Object} params - Thông tin thanh toán
   * @param {string} params.orderId - Mã đơn hàng
   * @param {number} params.amount - Số tiền (VND)
   * @param {string} params.orderInfo - Mô tả đơn hàng
   * @param {string} params.extraData - Dữ liệu bổ sung (base64)
   * @returns {Promise<Object>} - Kết quả tạo thanh toán
   */
  async createPayment(params) {
    const { orderId, amount, orderInfo, extraData = '' } = params;
    
    const requestId = crypto.randomUUID();
    const requestType = 'payWithMethod'; // Hoặc 'captureWallet' cho thanh toán QR
    
    // Tạo chữ ký
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = this._createSignature(rawSignature);
    
    // Request body
    const requestBody = {
      partnerCode: this.partnerCode,
      partnerName: 'LMS Payment',
      storeId: 'LMSStore',
      requestId,
      amount: String(amount),
      orderId,
      orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      signature,
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      
      if (result.resultCode === 0) {
        return {
          success: true,
          payUrl: result.payUrl,
          deeplink: result.deeplink,
          qrCodeUrl: result.qrCodeUrl,
          orderId,
          requestId,
          amount,
        };
      }
      
      return {
        success: false,
        message: result.message,
        resultCode: result.resultCode,
      };
    } catch (error) {
      console.error('MoMo create payment error:', error);
      throw { status: 500, message: 'Không thể tạo thanh toán MoMo' };
    }
  }

  /**
   * Xác minh chữ ký từ callback/IPN của MoMo
   * @param {Object} params - Params từ MoMo
   * @returns {boolean} - true nếu chữ ký hợp lệ
   */
  verifySignature(params) {
    const { signature, ...data } = params;
    
    // Tạo chữ ký để so sánh
    const rawSignature = Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    const checkSignature = this._createSignature(rawSignature);
    
    return signature === checkSignature;
  }

  /**
   * Xử lý callback từ MoMo
   * @param {Object} callbackData - Dữ liệu từ MoMo
   * @returns {Object} - Kết quả xử lý
   */
  processCallback(callbackData) {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = callbackData;

    // Xác minh chữ ký
    const isValid = this.verifySignature({
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    });

    if (!isValid) {
      return {
        success: false,
        message: 'Chữ ký không hợp lệ',
      };
    }

    const isSuccess = resultCode === 0;

    return {
      success: isSuccess,
      orderId,
      transId,
      amount: parseInt(amount),
      resultCode,
      message,
      payType,
      responseTime,
    };
  }

  /**
   * Tạo mã giao dịch unique cho MoMo
   */
  generateOrderId(userId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `MOMO_${userId}_${timestamp}_${random}`;
  }
}

module.exports = new MoMoService();
