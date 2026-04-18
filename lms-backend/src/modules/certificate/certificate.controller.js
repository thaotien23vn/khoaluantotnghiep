const certificateService = require('./certificate.service');

class CertificateController {
  /**
   * Generate and stream PDF certificate
   */
  async downloadCertificate(req, res) {
    try {
      const { id: userId } = req.user;
      const { courseId } = req.params;

      const doc = await certificateService.generateCertificate(userId, courseId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Certificate_${courseId}.pdf`);

      doc.on('error', (err) => {
        console.error('Certificate PDF Stream Error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error generating PDF');
        }
      });

      doc.pipe(res);
      doc.end();
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
