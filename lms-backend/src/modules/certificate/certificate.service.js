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
      const certId = eligibility.certificateData?.certificateId || `CERT-${courseId}-${userId}-${Date.now()}`;

      return { user, courseTitle, certificateId: certId };
   }

   _drawCertificateDesign(doc, studentName, courseTitle, certificateId, completionDate) {
      const width = doc.page.width;
      const height = doc.page.height;

      // Background Container (Border)
      doc.rect(20, 20, width - 40, height - 40)
         .lineWidth(10)
         .stroke('#1a365d'); // Dark blue border

      doc.rect(35, 35, width - 70, height - 70)
         .lineWidth(2)
         .stroke('#e2e8f0'); // Inner border

      // Title
      doc.font('Arial-Bold')
         .fontSize(45)
         .fillColor('#1a365d')
         .text('CERTIFICATE', 0, 100, { align: 'center' });

      doc.fontSize(20)
         .font('Arial')
         .text('OF COMPLETION', 0, 155, { align: 'center', characterSpacing: 5 });

      // Ribbon / Line
      doc.moveTo(width / 2 - 150, 190)
         .lineTo(width / 2 + 150, 190)
         .lineWidth(2)
         .stroke('#cda434');

      // Body text
      doc.moveDown(3);
      doc.fontSize(16)
         .fillColor('#4a5568')
         .text('This is to certify that', 0, 230, { align: 'center' });

      // Student Name
      doc.moveDown(1);
      doc.font('Arial-Bold')
         .fontSize(35)
         .fillColor('#2d3748')
         .text(studentName.toUpperCase(), 0, 260, { align: 'center' });

      // Course
      doc.fontSize(16)
         .font('Arial')
         .fillColor('#4a5568')
         .text('has successfully completed the course', 0, 320, { align: 'center' });

      doc.moveDown(1);
      doc.font('Arial-Bold')
         .fontSize(25)
         .fillColor('#1a365d')
         .text(courseTitle, 30, 360, { align: 'center', width: width - 60 });

      // Date & Signatures
      const dateStr = new Date(completionDate).toLocaleDateString('vi-VN');

      doc.fontSize(12)
         .font('Arial')
         .fillColor('#4a5568');

      // Date Layout
      doc.text(`Date completed: ${dateStr}`, 100, 480);
      doc.moveTo(100, 500).lineTo(300, 500).stroke();

      // Signature
      doc.text('E-Learning Platform', width - 300, 480, { align: 'right' });
      doc.moveTo(width - 300, 500).lineTo(width - 100, 500).stroke();

      // Verification ID
      doc.fontSize(10)
         .fillColor('#a0aec0')
         .text(`Verification ID: ${certificateId}`, 50, height - 60);
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
