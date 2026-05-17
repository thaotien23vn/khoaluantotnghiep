const PDFDocument = require('pdfkit');
const db = require('../../models');
const learningPathService = require('../learningPath/learningPath.service');

class LevelCertificateService {
  /**
   * Generate or retrieve a level certificate PDF.
   * Returns { doc, certificateId, isNew }
   */
  async generateLevelCertificate(userId, level) {
    const { User, LevelCertificate } = db.models;

    // 1. Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      throw { status: 404, message: 'Không tìm thấy người dùng' };
    }

    // 2. Verify the level was actually completed
    const pathData = await learningPathService.getMyProgress(userId);
    if (!pathData) {
      throw { status: 404, message: 'Bạn chưa có lộ trình học tập' };
    }

    const levelData = pathData.levels?.find(l => l.level === level);
    if (!levelData || levelData.completedCourses < levelData.totalCourses) {
      throw { status: 403, message: `Bạn chưa hoàn thành trình độ ${level}` };
    }

    // 3. Check if certificate already exists
    let cert = await LevelCertificate.findOne({ where: { userId, level } });
    let isNew = false;

    if (!cert) {
      const certificateId = `LEVEL-CERT-${level}-${userId}-${Date.now()}`;
      cert = await LevelCertificate.create({
        userId,
        level,
        certificateId,
        issuedAt: new Date(),
      });
      isNew = true;
    }

    // 4. Generate PDF
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    this._drawLevelCertificateDesign(doc, user.name, level, cert.certificateId, cert.issuedAt);

    return { doc, certificateId: cert.certificateId, isNew };
  }

  /**
   * Get all level certificates for a user
   */
  async getMyLevelCertificates(userId) {
    const { LevelCertificate } = db.models;
    const certs = await LevelCertificate.findAll({
      where: { userId },
      order: [['issuedAt', 'DESC']],
    });
    return certs.map(c => ({
      id: c.id,
      level: c.level,
      certificateId: c.certificateId,
      issuedAt: c.issuedAt,
    }));
  }

  _drawLevelCertificateDesign(doc, studentName, level, certificateId, issuedAt) {
    const width = doc.page.width;
    const height = doc.page.height;

    // Register fonts
    const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
    const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
    doc.registerFont('Arial', fontPath);
    doc.registerFont('Arial-Bold', fontBoldPath);
    doc.font('Arial');

    // 1. Background watermark
    doc.save();
    doc.opacity(0.03);
    doc.fontSize(100).font('Arial-Bold').fillColor('#1a365d');
    doc.rotate(-30, { origin: [width / 2, height / 2] });
    doc.text('CEFR CERTIFIED', 0, height / 2 - 50, { align: 'center' });
    doc.restore();

    // 2. Border
    doc.rect(20, 20, width - 40, height - 40)
       .lineWidth(4)
       .stroke('#7c3aed'); // violet-600 for level cert
    doc.rect(28, 28, width - 56, height - 56)
       .lineWidth(2)
       .stroke('#f59e0b'); // amber

    // Corners
    const cornerSize = 40;
    doc.rect(20, 20, cornerSize, cornerSize).fill('#7c3aed');
    doc.rect(width - 20 - cornerSize, 20, cornerSize, cornerSize).fill('#7c3aed');
    doc.rect(20, height - 20 - cornerSize, cornerSize, cornerSize).fill('#7c3aed');
    doc.rect(width - 20 - cornerSize, height - 20 - cornerSize, cornerSize, cornerSize).fill('#7c3aed');

    // 3. Title
    doc.font('Arial-Bold')
       .fontSize(44)
       .fillColor('#1a365d')
       .text('CERTIFICATE', 0, 80, { align: 'center', characterSpacing: 2 });

    doc.fontSize(16)
       .font('Arial')
       .fillColor('#7c3aed')
       .text('OF CEFR LEVEL ACHIEVEMENT', 0, 130, { align: 'center', characterSpacing: 8 });

    // 4. Body
    doc.fontSize(14)
       .fillColor('#4a5568')
       .text('This is to certify that', 0, 200, { align: 'center' });

    const nameFontSize = studentName.length > 20 ? 30 : 40;
    doc.font('Arial-Bold')
       .fontSize(nameFontSize)
       .fillColor('#2d3748')
       .text(studentName.toUpperCase(), 0, 235, { align: 'center' });

    doc.moveTo(width / 2 - 200, 285)
       .lineTo(width / 2 + 200, 285)
       .lineWidth(1)
       .stroke('#e2e8f0');

    doc.fontSize(14)
       .font('Arial')
       .fillColor('#4a5568')
       .text('has successfully achieved CEFR Level', 0, 310, { align: 'center' });

    doc.font('Arial-Bold')
       .fontSize(36)
       .fillColor('#7c3aed')
       .text(level, 0, 345, { align: 'center' });

    doc.fontSize(12)
       .font('Arial')
       .fillColor('#4a5568')
       .text('as recognized by the Common European Framework of Reference for Languages', 0, 400, { align: 'center' });

    // 5. Date & Signature
    const dateStr = new Date(issuedAt).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    doc.fontSize(12).font('Arial').fillColor('#718096').text('DATE ISSUED', 120, 460);
    doc.fontSize(14).font('Arial-Bold').fillColor('#2d3748').text(dateStr, 120, 480);
    doc.moveTo(120, 500).lineTo(320, 500).lineWidth(1).stroke('#cbd5e0');

    doc.fontSize(12).font('Arial').fillColor('#718096').text('DIRECTOR OF ACADEMIC', width - 320, 460, { align: 'left' });
    doc.fontSize(14).font('Arial-Bold').fillColor('#1a365d').text('E-Learning Platform', width - 320, 480, { align: 'left' });
    doc.moveTo(width - 320, 500).lineTo(width - 120, 500).lineWidth(1).stroke('#cbd5e0');

    // Seal
    const sealX = width / 2;
    const sealY = 485;
    doc.circle(sealX, sealY, 45).lineWidth(2).stroke('#f59e0b');
    doc.circle(sealX, sealY, 40).lineWidth(1).stroke('#f59e0b');
    doc.fontSize(8).font('Arial-Bold').fillColor('#f59e0b')
       .text('OFFICIAL', sealX - 30, sealY - 15, { width: 60, align: 'center' })
       .text('SEAL', sealX - 30, sealY + 5, { width: 60, align: 'center' });

    // Footer
    doc.fontSize(9)
       .font('Arial')
       .fillColor('#a0aec0')
       .text(`Certificate ID: ${certificateId}`, 50, height - 55);

    const verifyUrl = `Verify at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-level/${certificateId}`;
    doc.text(verifyUrl, width - 350, height - 55, { align: 'right' });
  }
}

module.exports = new LevelCertificateService();
