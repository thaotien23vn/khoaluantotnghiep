const levelCertificateService = require('./levelCertificate.service');

class LevelCertificateController {
  /**
   * Generate and stream PDF level certificate
   */
  async downloadLevelCertificate(req, res) {
    try {
      const { id: userId } = req.user;
      const { level } = req.params;

      const { doc, certificateId, isNew } = await levelCertificateService.generateLevelCertificate(userId, level);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Level_Certificate_${level}_${certificateId}.pdf`);

      doc.on('error', (err) => {
        console.error('Level Certificate PDF Stream Error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error generating PDF');
        }
      });

      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error('Lỗi cấp chứng chỉ cấp độ:', error);
      if (!res.headersSent) {
        const statusCode = error.status || 500;
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Lỗi hệ thống khi sinh chứng chỉ cấp độ',
        });
      }
    }
  }

  /**
   * Get all level certificates for the logged-in student
   */
  async getMyLevelCertificates(req, res) {
    try {
      const { id: userId } = req.user;
      const certificates = await levelCertificateService.getMyLevelCertificates(userId);

      res.json({
        success: true,
        data: certificates,
      });
    } catch (error) {
      console.error('Lỗi lấy danh sách chứng chỉ cấp độ:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi hệ thống khi lấy danh sách chứng chỉ cấp độ',
      });
    }
  }
}

module.exports = new LevelCertificateController();
