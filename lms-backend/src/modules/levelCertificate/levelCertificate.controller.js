const levelCertificateService = require('./levelCertificate.service');

class LevelCertificateController {
  /**
   * Generate and stream PDF course path completion certificate.
   * This is an internal platform certificate of achievement, not an official language proficiency certificate.
   */
  async downloadLevelCertificate(req, res) {
    try {
      const { id: userId } = req.user;
      const { level } = req.params;

      const { doc, certificateId, isNew } = await levelCertificateService.generateLevelCertificate(userId, level);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=Course_Path_Completion_Certificate_${level}_${certificateId}.pdf`);

      doc.on('error', (err) => {
        console.error('Level Certificate PDF Stream Error:', err);
        if (!res.headersSent) {
          res.status(500).send('Error generating PDF');
        }
      });

      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error('Lỗi tạo chứng chỉ hoàn thành khóa học:', error);
      if (!res.headersSent) {
        const statusCode = error.status || 500;
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Lỗi hệ thống khi tạo chứng chỉ hoàn thành khóa học',
        });
      }
    }
  }

  /**
   * Publicly verify a course completion certificate by ID.
   * This verifies internal platform achievement only - not official language proficiency.
   * No authentication required.
   */
  async verifyLevelCertificate(req, res) {
    try {
      const { certificateId } = req.params;
      const cert = await levelCertificateService.verifyLevelCertificate(certificateId);

      res.json({
        success: true,
        data: cert,
      });
    } catch (error) {
      console.error('Lỗi xác thực chứng chỉ hoàn thành khóa học:', error);
      const statusCode = error.status || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống khi xác thực chứng chỉ',
      });
    }
  }

  /**
   * Get all course completion certificates for the logged-in student
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
      console.error('Lỗi lấy danh sách chứng chỉ hoàn thành khóa học:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi hệ thống khi lấy danh sách chứng chỉ hoàn thành khóa học',
      });
    }
  }
}

module.exports = new LevelCertificateController();
