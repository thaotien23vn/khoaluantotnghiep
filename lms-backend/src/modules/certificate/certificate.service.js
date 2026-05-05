const PDFDocument = require('pdfkit');
const db = require('../../models');
const progressService = require('../progress/progress.service');
const path = require('path');
const fs = require('fs');

class CertificateService {
   /**
    * Generate a PDF certificate for a student if they are eligible
    * Returns a PDF stream
    */
   async generateCertificate(userId, courseId) {
      // 1. Verify Eligibility
      const eligibility = await progressService.getCertificateEligibility(userId, courseId);
      if (!eligibility.isEligible) {
         throw { status: 403, message: 'Bạn chưa đủ điều kiện cấp chứng chỉ cho khóa học này. Hãy hoàn thành 100% video và bài kiểm tra.' };
      }

      const { user, courseTitle, certificateId } = await this._getCertificateDetails(userId, courseId, eligibility);

      // 2. Create PDF
      const doc = new PDFDocument({
         size: 'A4',
         layout: 'landscape',
         margin: 50
      });

      // Register font to support Vietnamese
      const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
      const fontBoldPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
      doc.registerFont('Arial', fontPath);
      doc.registerFont('Arial-Bold', fontBoldPath);
      doc.font('Arial');

      // 3. Draw Design
      this._drawCertificateDesign(doc, user.name, courseTitle, certificateId, eligibility.completedAt || new Date());

      return doc;
   }

   async _getCertificateDetails(userId, courseId, eligibility) {
      const user = await db.models.User.findByPk(userId);
      const course = await db.models.Course.findByPk(courseId);

      // Fallbacks
      const courseTitle = course ? course.title : (eligibility.certificateData?.courseTitle || 'Khóa học');
      const certId = eligibility.certificateData?.certificateId || `CERT-${courseId}-${userId}`;

      return { user, courseTitle, certificateId: certId, studentName: user.name };
   }

   _drawCertificateDesign(doc, studentName, courseTitle, certificateId, completionDate) {
      const width = doc.page.width;
      const height = doc.page.height;

      // 1. CHỮ NỀN (Watermark)
      doc.save();
      doc.opacity(0.03);
      doc.fontSize(100).font('Arial-Bold').fillColor('#1a365d');
      doc.rotate(-30, { origin: [width / 2, height / 2] });
      doc.text('E-LEARNING CERTIFIED', 0, height / 2 - 50, { align: 'center' });
      doc.restore();

      // 2. VIỀN NGOÀI (Border) - Sang trọng hơn
      // Viền dầy màu xanh đậm
      doc.rect(20, 20, width - 40, height - 40)
         .lineWidth(4)
         .stroke('#1a365d');

      // Viền mỏng màu vàng gold
      doc.rect(28, 28, width - 56, height - 56)
         .lineWidth(2)
         .stroke('#cda434');

      // 4 Góc hoa văn (Corners)
      const cornerSize = 40;
      // Top Left
      doc.rect(20, 20, cornerSize, cornerSize).fill('#1a365d');
      // Top Right
      doc.rect(width - 20 - cornerSize, 20, cornerSize, cornerSize).fill('#1a365d');
      // Bottom Left
      doc.rect(20, height - 20 - cornerSize, cornerSize, cornerSize).fill('#1a365d');
      // Bottom Right
      doc.rect(width - 20 - cornerSize, height - 20 - cornerSize, cornerSize, cornerSize).fill('#1a365d');

      // 3. TIÊU ĐỀ
      doc.font('Arial-Bold')
         .fontSize(50)
         .fillColor('#1a365d')
         .text('CERTIFICATE', 0, 90, { align: 'center', characterSpacing: 2 });

      doc.fontSize(18)
         .font('Arial')
         .fillColor('#cda434')
         .text('OF COMPLETION', 0, 145, { align: 'center', characterSpacing: 8 });

      // 4. NỘI DUNG CHÍNH
      doc.moveDown(2);
      doc.fontSize(16)
         .fillColor('#4a5568')
         .font('Arial')
         .text('This is to certify that', 0, 220, { align: 'center' });

      // Tên học viên - Chỉnh size tự động nếu dài
      const nameFontSize = studentName.length > 20 ? 30 : 40;
      doc.moveDown(0.5);
      doc.font('Arial-Bold')
         .fontSize(nameFontSize)
         .fillColor('#2d3748')
         .text(studentName.toUpperCase(), 0, 255, { align: 'center' });

      // Gạch dưới tên
      doc.moveTo(width / 2 - 200, 305)
         .lineTo(width / 2 + 200, 305)
         .lineWidth(1)
         .stroke('#e2e8f0');

      doc.moveDown(1.5);
      doc.fontSize(16)
         .font('Arial')
         .fillColor('#4a5568')
         .text('has successfully completed the online course', 0, 330, { align: 'center' });

      // Tên khóa học
      doc.moveDown(0.5);
      doc.font('Arial-Bold')
         .fontSize(28)
         .fillColor('#1a365d')
         .text(`"${courseTitle}"`, 50, 365, { align: 'center', width: width - 100 });

      // 5. NGÀY VÀ CHỮ KÝ
      const dateStr = new Date(completionDate).toLocaleDateString('vi-VN', {
         day: '2-digit',
         month: 'long',
         year: 'numeric'
      });

      // Cột bên trái: Ngày tháng
      doc.fontSize(12).font('Arial').fillColor('#718096').text('DATE ISSUED', 120, 460);
      doc.fontSize(14).font('Arial-Bold').fillColor('#2d3748').text(dateStr, 120, 480);
      doc.moveTo(120, 500).lineTo(320, 500).lineWidth(1).stroke('#cbd5e0');

      // Cột bên phải: Chữ ký
      doc.fontSize(12).font('Arial').fillColor('#718096').text('DIRECTOR OF ACADEMIC', width - 320, 460, { align: 'left' });
      doc.fontSize(14).font('Arial-Bold').fillColor('#1a365d').text('E-Learning Platform', width - 320, 480, { align: 'left' });
      doc.moveTo(width - 320, 500).lineTo(width - 120, 500).lineWidth(1).stroke('#cbd5e0');

      // 6. CON DẤU (Digital Seal) - Giả lập bằng các hình vẽ
      const sealX = width / 2;
      const sealY = 485;
      doc.circle(sealX, sealY, 45).lineWidth(2).stroke('#cda434');
      doc.circle(sealX, sealY, 40).lineWidth(1).stroke('#cda434');
      doc.fontSize(8).font('Arial-Bold').fillColor('#cda434')
         .text('VERIFIED', sealX - 30, sealY - 15, { width: 60, align: 'center' })
         .text('OFFICIAL', sealX - 30, sealY + 5, { width: 60, align: 'center' });

      // 7. MÃ XÁC MINH (Footer)
      doc.fontSize(9)
         .font('Arial')
         .fillColor('#a0aec0')
         .text(`Certificate ID: ${certificateId}`, 50, height - 55);
      
      const verifyUrl = `Verify at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${certificateId}`;
      doc.text(verifyUrl, width - 350, height - 55, { align: 'right' });
   }

   // Remove accents to avoid font rendering issues when missing custom fonts
   _removeVietnameseTones(str) {
      if (!str) return "";
      str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
      str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
      str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
      str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
      str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
      str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
      str = str.replace(/đ/g, "d");
      str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
      str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
      str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
      str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
      str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
      str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
      str = str.replace(/Đ/g, "D");
      return str;
   }

   /**
    * Get all certificates for a student
    * Returns list of courses where student is eligible for certificate
    */
   async getMyCertificates(userId) {
      const { Enrollment, Course } = db.models;

      // Get all completed enrollments
      const enrollments = await Enrollment.findAll({
         where: { userId },
         include: [{
            model: Course,
            where: { published: true },
            required: true
         }]
      });

      const certificates = [];

      for (const enrollment of enrollments) {
         try {
            const eligibility = await progressService.getCertificateEligibility(userId, enrollment.courseId);
            if (eligibility.isEligible) {
               certificates.push({
                  courseId: enrollment.courseId,
                  courseTitle: eligibility.course.title,
                  courseSlug: eligibility.course.slug,
                  courseImage: eligibility.course.imageUrl,
                  studentName: eligibility.certificateData?.studentName || eligibility.user?.name || 'Học viên',
                  progressPercent: eligibility.progressPercent,
                  completedAt: eligibility.completedAt,
                  certificateId: eligibility.certificateData?.certificateId || `CERT-${enrollment.courseId}-${userId}`,
                  totalLectures: eligibility.totalLectures,
                  completedLectures: eligibility.completedLectures,
                  quizPassed: eligibility.quizRequirement.passed,
                  quizTotal: eligibility.quizRequirement.total
               });
            }
         } catch (err) {
            // Skip if eligibility check fails
            continue;
         }
      }

      return certificates;
   }
}

module.exports = new CertificateService();
