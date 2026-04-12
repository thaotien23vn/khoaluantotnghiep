const certificateService = require('./certificate.service');

class CertificateController {
  /**
   * Generate and stream PDF certificate
   */
  async downloadCertificate(req, res) {
    try {
      const { id: userId } = req.user;
      const { courseId } = req.params;

      await certificateService.generateCertificate(userId, courseId, res);
      // NOTE: We don't send typical res.json() here because we are piping a PDF buffer stream directly
    } catch (error) {
      console.error('Lỗi cấp chứng chỉ:', error);
      if (!res.headersSent) {
        const statusCode = error.status || 500;
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Lỗi hệ thống khi sinh chứng chỉ',
        });
      }
    }
  }
}

module.exports = new CertificateController();
