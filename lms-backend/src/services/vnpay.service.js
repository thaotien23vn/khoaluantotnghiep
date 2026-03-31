/**
 * VNPay Service - Tích hợp thanh toán VNPay
 * Hỗ trợ cả Sandbox (test) và Production (thật)
 */

const { VNPay, ProductCode, VnpLocale, HashAlgorithm } = require('vnpay');
const crypto = require('crypto');
const querystring = require('querystring');

class VNPayService {
  constructor() {
    // Khởi tạo VNPay client
    // Sử dụng biến môi trường để cấu hình
    const isSandbox = process.env.VNPAY_SANDBOX !== 'false';
    
    this.vnpay = new VNPay({
      api_Host: isSandbox 
        ? 'https://sandbox.vnpayment.vn' 
        : 'https://pay.vnpay.vn',
      tmnCode: process.env.VNPAY_TMN_CODE || 'DEMO',
      secureSecret: process.env.VNPAY_HASH_SECRET || 'secret',
      vnp_Version: '2.1.0',
      hashAlgorithm: HashAlgorithm.SHA512,
    });
    
    this.returnUrl = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/payment/vnpay/return';
    this.isSandbox = isSandbox;
  }

  /**
   * Tạo URL thanh toán VNPay
   * @param {Object} params - Thông tin thanh toán
   * @param {string} params.orderId - Mã đơn hàng
   * @param {number} params.amount - Số tiền (VND)
   * @param {string} params.orderDescription - Mô tả đơn hàng
   * @param {string} params.ipAddr - IP của khách hàng
   * @param {string} params.txnRef - Mã tham chiếu giao dịch (unique)
   * @returns {Promise<string>} - URL thanh toán
   */
  async createPaymentUrl(params) {
    try {
      const { orderId, amount, orderDescription, ipAddr, txnRef, bankCode = '' } = params;
      
      // Chuyển đổi số tiền sang đơn vị của VNPay (đồng)
      // VNPay yêu cầu số tiền * 100
      const vnpAmount = Math.round(amount * 100);
      
      // Tạo thời gian giao dịch
      const createDate = this._formatDate(new Date());
      
      // Dữ liệu gửi đến VNPay
      const vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: process.env.VNPAY_TMN_CODE,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderDescription || `Thanh toan don hang ${orderId}`,
        vnp_OrderType: 'other',
        vnp_Amount: String(vnpAmount),
        vnp_ReturnUrl: this.returnUrl,
        vnp_IpAddr: ipAddr || '127.0.0.1',
        vnp_CreateDate: createDate,
      };

      // Tùy chọn: Chọn ngân hàng
      if (bankCode) {
        vnp_Params.vnp_BankCode = bankCode;
      }

      // Tạo chữ ký
      const sortedParams = this._sortObject(vnp_Params);
      const signData = this._createSignData(sortedParams);
      console.log('VNPay signData:', signData);
      console.log('VNPay secret:', process.env.VNPAY_HASH_SECRET);
      const secureHash = this._generateHash(signData, process.env.VNPAY_HASH_SECRET);
      console.log('VNPay secureHash:', secureHash);
      
      vnp_Params.vnp_SecureHash = secureHash;

      // Create URL
      const vnpUrl = this.isSandbox
        ? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
        : 'https://pay.vnpay.vn/paymentv2/vpcpay.html';
      
      const query = Object.entries(vnp_Params)
        .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
        .join('&');
      
      const paymentUrl = `${vnpUrl}?${query}`;
      
      return paymentUrl;
    } catch (error) {
      console.error('VNPay create payment URL error:', error);
      throw error;
    }
  }

  /**
   * Xử lý callback từ VNPay (Return URL)
   * @param {Object} vnpParams - Query params từ VNPay
   * @returns {Object} - Kết quả xử lý
   */
  async processReturnUrl(vnpParams) {
    try {
      const secureHash = vnpParams.vnp_SecureHash;
      delete vnpParams.vnp_SecureHash;
      delete vnpParams.vnp_SecureHashType;

      // Tạo lại chữ ký để verify
      const sortedParams = this._sortObject(vnpParams);
      const signData = querystring.stringify(sortedParams, { encode: false });
      const checkHash = this._generateHash(signData, process.env.VNPAY_HASH_SECRET);

      // Verify chữ ký
      if (secureHash !== checkHash) {
        return {
          success: false,
          message: 'Invalid signature',
          code: '99',
        };
      }

      // Kiểm tra mã phản hồi
      const responseCode = vnpParams.vnp_ResponseCode;
      const isSuccess = responseCode === '00';

      return {
        success: isSuccess,
        txnRef: vnpParams.vnp_TxnRef,
        orderId: vnpParams.vnp_TxnRef,
        amount: parseInt(vnpParams.vnp_Amount) / 100,
        bankCode: vnpParams.vnp_BankCode,
        bankTranNo: vnpParams.vnp_BankTranNo,
        cardType: vnpParams.vnp_CardType,
        payDate: vnpParams.vnp_PayDate,
        responseCode: responseCode,
        transactionNo: vnpParams.vnp_TransactionNo,
        message: this._getResponseMessage(responseCode),
      };
    } catch (error) {
      console.error('VNPay process return URL error:', error);
      throw error;
    }
  }

  /**
   * Xử lý IPN (Instant Payment Notification) từ VNPay
   * @param {Object} vnpParams - Query params từ VNPay
   * @returns {Object} - Kết quả xử lý với mã phản hồi cho VNPay
   */
  async processIpn(vnpParams) {
    try {
      const result = await this.processReturnUrl(vnpParams);
      
      // VNPay IPN cần trả về mã '00' nếu thành công
      if (result.success) {
        return {
          RspCode: '00',
          Message: 'Confirm Success',
          ...result,
        };
      } else {
        return {
          RspCode: result.responseCode || '99',
          Message: result.message || 'Unknown error',
          ...result,
        };
      }
    } catch (error) {
      console.error('VNPay IPN error:', error);
      return {
        RspCode: '99',
        Message: 'Unknown error',
      };
    }
  }

  /**
   * Truy vấn kết quả giao dịch
   * @param {string} txnRef - Mã giao dịch
   * @param {string} transactionDate - Ngày giao dịch (yyyyMMdd)
   * @param {string} ipAddr - IP
   * @returns {Promise<Object>} - Kết quả truy vấn
   */
  async queryDr(txnRef, transactionDate, ipAddr = '127.0.0.1') {
    try {
      const createDate = this._formatDate(new Date());
      
      const params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'querydr',
        vnp_TmnCode: process.env.VNPAY_TMN_CODE,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Query transaction ${txnRef}`,
        vnp_TransDate: transactionDate,
        vnp_CreateDate: createDate,
        vnp_IpAddr: ipAddr,
      };

      const sortedParams = this._sortObject(params);
      const signData = querystring.stringify(sortedParams, { encode: false });
      const secureHash = this._generateHash(signData, process.env.VNPAY_HASH_SECRET);
      
      params.vnp_SecureHash = secureHash;

      const queryUrl = this.isSandbox
        ? 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
        : 'https://pay.vnpay.vn/merchant_webapi/api/transaction';

      const response = await fetch(`${queryUrl}?${querystring.stringify(params)}`);
      const result = await response.json();

      return result;
    } catch (error) {
      console.error('VNPay query DR error:', error);
      throw error;
    }
  }

  /**
   * Hoàn tiền giao dịch
   * @param {string} txnRef - Mã giao dịch
   * @param {number} amount - Số tiền hoàn
   * @param {string} transactionType - Loại hoàn tiền
   * @param {string} ipAddr - IP
   * @returns {Promise<Object>} - Kết quả hoàn tiền
   */
  async refund(txnRef, amount, transactionType = '03', ipAddr = '127.0.0.1') {
    try {
      const createDate = this._formatDate(new Date());
      
      const params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'refund',
        vnp_TmnCode: process.env.VNPAY_TMN_CODE,
        vnp_TxnRef: txnRef,
        vnp_Amount: Math.round(amount * 100),
        vnp_OrderInfo: `Refund transaction ${txnRef}`,
        vnp_TransDate: createDate,
        vnp_CreateBy: 'system',
        vnp_IpAddr: ipAddr,
        vnp_TransactionType: transactionType,
      };

      const sortedParams = this._sortObject(params);
      const signData = querystring.stringify(sortedParams, { encode: false });
      const secureHash = this._generateHash(signData, process.env.VNPAY_HASH_SECRET);
      
      params.vnp_SecureHash = secureHash;

      const refundUrl = this.isSandbox
        ? 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
        : 'https://pay.vnpay.vn/merchant_webapi/api/transaction';

      const response = await fetch(refundUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: querystring.stringify(params),
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('VNPay refund error:', error);
      throw error;
    }
  }

  /**
   * Tạo mã giao dịch unique
   */
  generateTxnRef(userId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${userId}_${timestamp}_${random}`;
  }

  /**
   * Format ngày tháng cho VNPay
   */
  _formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Sắp xếp object và tạo query string thủ công
   */
  _sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = String(obj[key]);
      }
    }
    return sorted;
  }

  /**
   * Tạo query string từ object đã sort (for signing)
   * VNPay: space → + (không phải %20)
   */
  _createSignData(sortedObj) {
    return Object.entries(sortedObj)
      .map(([key, val]) => {
        const encodedVal = encodeURIComponent(val).replace(/%20/g, '+');
        return `${key}=${encodedVal}`;
      })
      .join('&');
  }

  /**
   * Tạo hash SHA512
   */
  _generateHash(data, secret) {
    return crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');
  }

  /**
   * Lấy message theo response code
   */
  _getResponseMessage(code) {
    const messages = {
      '00': 'Giao dịch thành công',
      '01': 'Giao dịch chưa hoàn tất',
      '02': 'Giao dịch bị lỗi',
      '04': 'Giao dịch đảo (Khách hàng đã bị trừ tiền tại Ngân hàng nhưng GD chưa thành công ở VNPAY)',
      '05': 'VNPAY đang xử lý giao dịch này (GD hoàn tiền)',
      '06': 'VNPAY đã gửi yêu cầu hoàn tiền sang Ngân hàng (GD hoàn tiền)',
      '07': 'Giao dịch bị nghi ngờ gian lận',
      '09': 'GD Hoàn trả bị từ chối',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách chưa đăng ký dịch vụ InternetBanking',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '99': 'Lỗi không xác định',
    };
    return messages[code] || `Mã lỗi: ${code}`;
  }
}

module.exports = new VNPayService();
