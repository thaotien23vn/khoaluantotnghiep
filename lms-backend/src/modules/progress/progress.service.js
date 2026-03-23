const db = require('../../models');

const {
  LectureProgress,
  Enrollment,
  Course,
  Lecture,
  Chapter,
  User,
} = db.models;

/**
 * Progress Service - Business logic for lecture progress tracking
 */
class ProgressService {
  /**
   * Update lecture progress when student watches video
   */
  async updateLectureProgress(userId, lectureId, watchedPercent) {
    const lecture = await Lecture.findByPk(lectureId, {
      include: [{ model: Chapter, attributes: ['courseId'] }],
    });

    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy bài giảng' };
    }

    const courseId = lecture.Chapter.courseId;

    // Check if enrolled
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      throw { status: 403, message: 'Bạn chưa đăng ký khóa học này' };
    }

    const watched = Math.min(100, Math.max(0, Number(watchedPercent)));
    const isCompleted = watched >= 80; // Mark complete if watched 80%+

    const [progress, created] = await LectureProgress.findOrCreate({
      where: { userId, lectureId },
      defaults: {
        userId,
        lectureId,
        courseId,
        watchedPercent: watched,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        lastAccessedAt: new Date(),
      },
    });

    if (!created) {
      progress.watchedPercent = Math.max(progress.watchedPercent, watched);
      progress.isCompleted = progress.isCompleted || isCompleted;
      if (isCompleted && !progress.completedAt) {
        progress.completedAt = new Date();
      }
      progress.lastAccessedAt = new Date();
      await progress.save();
    }

    // Auto-update course progress
    await this.updateCourseProgress(userId, courseId);

    return { progress };
  }

  /**
   * Auto calculate and update course progress
   */
  async updateCourseProgress(userId, courseId) {
    const totalLectures = await Lecture.count({
      include: [{
        model: Chapter,
        where: { courseId },
        required: true,
      }],
    });

    if (totalLectures === 0) return;

    const completedLectures = await LectureProgress.count({
      where: {
        userId,
        courseId,
        isCompleted: true,
      },
    });

    const progressPercent = Math.round((completedLectures / totalLectures) * 100);

    await Enrollment.update(
      { progressPercent },
      { where: { userId, courseId } }
    );

    return { progressPercent, totalLectures, completedLectures };
  }

  /**
   * Get student's lecture progress for a course
   */
  async getStudentCourseProgress(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
      include: [{ model: Course, attributes: ['id', 'title'] }],
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    const progressList = await LectureProgress.findAll({
      where: { userId, courseId },
      include: [{
        model: Lecture,
        attributes: ['id', 'title', 'type', 'duration'],
      }],
      order: [['lastAccessedAt', 'DESC']],
    });

    return {
      course: enrollment.Course,
      courseProgress: enrollment.progressPercent,
      lecturesProgress: progressList,
      totalLectures: await this.countCourseLectures(courseId),
      completedLectures: progressList.filter(p => p.isCompleted).length,
    };
  }

  /**
   * Get teacher's view of student progress
   */
  async getTeacherStudentProgress(teacherId, courseId, studentId) {
    // Verify teacher owns the course
    const course = await Course.findOne({
      where: { id: courseId, createdBy: teacherId },
    });

    if (!course) {
      throw { status: 403, message: 'Bạn không có quyền xem khóa học này' };
    }

    const student = await User.findByPk(studentId, {
      attributes: ['id', 'name', 'email', 'avatar'],
    });

    if (!student) {
      throw { status: 404, message: 'Không tìm thấy học sinh' };
    }

    const enrollment = await Enrollment.findOne({
      where: { userId: studentId, courseId },
    });

    const progressList = await LectureProgress.findAll({
      where: { userId: studentId, courseId },
      include: [{
        model: Lecture,
        attributes: ['id', 'title', 'type', 'duration'],
      }],
      order: [['lastAccessedAt', 'DESC']],
    });

    return {
      student,
      course: {
        id: course.id,
        title: course.title,
      },
      enrollment: {
        status: enrollment?.status,
        progressPercent: enrollment?.progressPercent,
        enrolledAt: enrollment?.enrolledAt,
      },
      lecturesProgress: progressList,
      lastAccessed: progressList[0]?.lastAccessedAt || null,
      totalLectures: await this.countCourseLectures(courseId),
      completedLectures: progressList.filter(p => p.isCompleted).length,
    };
  }

  /**
   * Get all students progress for a course (teacher view)
   */
  async getCourseStudentsProgress(teacherId, courseId) {
    const course = await Course.findOne({
      where: { id: courseId, createdBy: teacherId },
    });

    if (!course) {
      throw { status: 403, message: 'Bạn không có quyền xem khóa học này' };
    }

    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'avatar'],
      }],
    });

    const studentsProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const progressCount = await LectureProgress.count({
          where: {
            userId: enrollment.userId,
            courseId,
            isCompleted: true,
          },
        });

        const lastProgress = await LectureProgress.findOne({
          where: { userId: enrollment.userId, courseId },
          order: [['lastAccessedAt', 'DESC']],
        });

        return {
          student: enrollment.User,
          progressPercent: enrollment.progressPercent,
          completedLectures: progressCount,
          lastAccessedAt: lastProgress?.lastAccessedAt || null,
        };
      })
    );

    return {
      course: {
        id: course.id,
        title: course.title,
      },
      totalStudents: enrollments.length,
      studentsProgress,
      totalLectures: await this.countCourseLectures(courseId),
    };
  }

  /**
   * Count total lectures in a course
   */
  async countCourseLectures(courseId) {
    return Lecture.count({
      include: [{
        model: Chapter,
        where: { courseId },
        required: true,
      }],
    });
  }

  /**
   * ADMIN: Get overall progress statistics
   */
  async getAdminStatistics() {
    const [totalStudents, totalCourses, totalEnrollments, totalCompletedLectures] = await Promise.all([
      User.count({ where: { role: 'student' } }),
      Course.count(),
      Enrollment.count(),
      LectureProgress.count({ where: { isCompleted: true } })
    ]);

    const activeStudents = await LectureProgress.count({
      distinct: true,
      col: 'userId'
    });

    return {
      totalStudents,
      activeStudents,
      totalCourses,
      totalEnrollments,
      totalCompletedLectures,
      averageProgress: totalEnrollments > 0 ? await Enrollment.sum('progressPercent') / totalEnrollments : 0
    };
  }

  /**
   * ADMIN: Get progress for any course (override ownership)
   */
  async getAdminCourseProgress(courseId) {
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'title']
    });

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'avatar'],
      }],
    });

    const studentsProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const progressCount = await LectureProgress.count({
          where: {
            userId: enrollment.userId,
            courseId,
            isCompleted: true,
          },
        });

        const lastProgress = await LectureProgress.findOne({
          where: { userId: enrollment.userId, courseId },
          order: [['lastAccessedAt', 'DESC']],
        });

        return {
          student: enrollment.User,
          progressPercent: enrollment.progressPercent,
          completedLectures: progressCount,
          lastAccessedAt: lastProgress?.lastAccessedAt || null,
        };
      })
    );

    return {
      course,
      totalStudents: enrollments.length,
      studentsProgress,
      totalLectures: await this.countCourseLectures(courseId),
    };
  }

  /**
   * ADMIN: Reset student progress
   */
  async resetUserProgress(adminId, userId, courseId = null) {
    const where = { userId };
    if (courseId) where.courseId = courseId;

    const deletedCount = await LectureProgress.destroy({ where });

    if (courseId) {
      await Enrollment.update(
        { progressPercent: 0 },
        { where: { userId, courseId } }
      );
    } else {
      await Enrollment.update(
        { progressPercent: 0 },
        { where: { userId } }
      );
    }

    // Log to Audit Log (Using existing AiAuditLog for now or a generic one if exists)
    const { AiAuditLog } = db.models;
    if (AiAuditLog) {
      await AiAuditLog.create({
        userId: adminId,
        action: 'RESET_PROGRESS',
        details: JSON.stringify({ targetUserId: userId, courseId, deletedCount }),
        status: 'success'
      });
    }

    return { deletedCount };
  }

  /**
   * ADMIN: Bulk update progress (Force complete)
   */
  async bulkUpdateProgress(adminId, { studentIds, courseId, lectureIds, isCompleted }) {
    const results = [];
    const status = isCompleted ? 'force_completed' : 'active';
    const watchedPercent = isCompleted ? 100 : 0;

    for (const userId of studentIds) {
      for (const lectureId of lectureIds) {
        const [progress, created] = await LectureProgress.findOrCreate({
          where: { userId, lectureId },
          defaults: {
            courseId,
            watchedPercent,
            isCompleted,
            status,
            completedAt: isCompleted ? new Date() : null,
            lastAccessedAt: new Date()
          }
        });

        if (!created) {
          await progress.update({
            watchedPercent,
            isCompleted,
            status,
            completedAt: isCompleted ? new Date() : (progress.completedAt || null),
            lastAccessedAt: new Date()
          });
        }
        results.push(progress);
      }
      // Update course overall progress
      await this.updateCourseProgress(userId, courseId);
    }

    const { AiAuditLog } = db.models;
    if (AiAuditLog) {
      await AiAuditLog.create({
        userId: adminId,
        action: 'BULK_UPDATE_PROGRESS',
        details: JSON.stringify({ studentIds, courseId, lectureIds, isCompleted }),
        status: 'success'
      });
    }

    return { updatedCount: results.length };
  }

  /**
   * ADMIN: Get Audit Logs
   */
  async getAuditLogs() {
    const { AiAuditLog } = db.models;
    if (!AiAuditLog) return [];

    return await AiAuditLog.findAll({
      where: {
        action: ['RESET_PROGRESS', 'BULK_UPDATE_PROGRESS']
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * ADMIN: Export progress data (CSV format)
   */
  async exportProgressData(courseId) {
    const data = await this.getAdminCourseProgress(courseId);
    
    let csv = 'Student Name,Email,Progress %,Completed Lectures,Total Lectures,Last Accessed\n';
    
    data.studentsProgress.forEach(sp => {
      const lastAccessed = sp.lastAccessedAt ? new Date(sp.lastAccessedAt).toLocaleString() : 'Never';
      csv += `"${sp.student.name}","${sp.student.email}",${sp.progressPercent},${sp.completedLectures},${data.totalLectures},"${lastAccessed}"\n`;
    });

    return csv;
  }
}

module.exports = new ProgressService();
