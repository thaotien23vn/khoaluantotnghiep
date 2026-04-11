const db = require('../../models');
const { Op } = require('sequelize');

const {
  LectureProgress,
  Enrollment,
  Course,
  Lecture,
  Chapter,
  User,
  Quiz,
  ScheduleEvent,
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
      include: [{ model: Chapter, as: 'chapter', attributes: ['courseId'] }],
    });

    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy bài giảng' };
    }

    const courseId = lecture.chapter.courseId;

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
      // Only advance watchedPercent, never regress
      const newWatched = Math.max(progress.watchedPercent, watched);
      const nowCompleted = progress.isCompleted || isCompleted;
      progress.watchedPercent = newWatched;
      progress.isCompleted = nowCompleted;
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
        as: 'chapter',
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
      include: [{ model: Course, attributes: ['id', 'title', 'slug'] }],
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    const totalLectures = await this.countCourseLectures(courseId);

    const progressList = await LectureProgress.findAll({
      where: { userId, courseId },
      include: [{
        model: Lecture,
        attributes: ['id', 'title', 'type', 'duration'],
        include: [{
          model: Chapter,
          as: 'chapter',
          attributes: ['id', 'title', 'order'],
        }],
      }],
      order: [['lastAccessedAt', 'DESC']],
    });

    const completedLectures = progressList.filter(p => p.isCompleted).length;

    return {
      course: enrollment.Course,
      courseProgress: Number(enrollment.progressPercent),
      enrolledAt: enrollment.enrolledAt,
      lecturesProgress: progressList,
      totalLectures,
      completedLectures,
      isCompleted: totalLectures > 0 && completedLectures >= totalLectures,
    };
  }

  /**
   * Get last accessed lecture for a course (Continue Learning)
   */
  async getLastAccessedLecture(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    // Find the last accessed lecture progress record
    const lastProgress = await LectureProgress.findOne({
      where: { userId, courseId },
      include: [{
        model: Lecture,
        attributes: ['id', 'title', 'type', 'duration', 'chapterId'],
        include: [{
          model: Chapter,
          as: 'chapter',
          attributes: ['id', 'title', 'order', 'courseId'],
        }],
      }],
      order: [['lastAccessedAt', 'DESC']],
    });

    // If no progress yet, find the first lecture in the course
    let nextLecture = null;
    if (!lastProgress || lastProgress.isCompleted) {
      // Find first incomplete/next lecture
      const allLectures = await Lecture.findAll({
        include: [{
          model: Chapter,
          as: 'chapter',
          where: { courseId },
          required: true,
          attributes: ['id', 'title', 'order'],
        }],
        order: [
          [{ model: Chapter, as: 'chapter' }, 'order', 'ASC'],
          ['order', 'ASC'],
        ],
      });

      const completedIds = new Set(
        (await LectureProgress.findAll({
          where: { userId, courseId, isCompleted: true },
          attributes: ['lectureId'],
        })).map(p => p.lectureId)
      );

      nextLecture = allLectures.find(l => !completedIds.has(l.id)) || allLectures[0] || null;
    }

    return {
      courseId,
      progressPercent: Number(enrollment.progressPercent),
      lastAccessed: lastProgress ? {
        lectureId: lastProgress.lectureId,
        lectureTitle: lastProgress.Lecture?.title,
        chapterId: lastProgress.Lecture?.chapterId,
        chapterTitle: lastProgress.Lecture?.chapter?.title,
        watchedPercent: Number(lastProgress.watchedPercent),
        isCompleted: lastProgress.isCompleted,
        lastAccessedAt: lastProgress.lastAccessedAt,
      } : null,
      nextLecture: nextLecture ? {
        lectureId: nextLecture.id,
        lectureTitle: nextLecture.title,
        chapterId: nextLecture.chapterId,
        chapterTitle: nextLecture.chapter?.title,
        type: nextLecture.type,
      } : null,
    };
  }

  /**
   * Get certificate eligibility for a student on a course
   */
  async getCertificateEligibility(userId, courseId) {
    const enrollment = await Enrollment.findOne({
      where: { userId, courseId },
      include: [{ model: Course, attributes: ['id', 'title', 'slug', 'imageUrl'] }],
    });

    if (!enrollment) {
      throw { status: 404, message: 'Bạn chưa đăng ký khóa học này' };
    }

    const totalLectures = await this.countCourseLectures(courseId);
    const completedLectures = await LectureProgress.count({
      where: { userId, courseId, isCompleted: true },
    });

    const progressPercent = totalLectures > 0
      ? Math.round((completedLectures / totalLectures) * 100)
      : 0;

    const isEligible = progressPercent === 100 && totalLectures > 0;

    // Check quiz pass requirement (all published quizzes must be passed)
    const quizzesPassed = await this._checkAllQuizzesPassed(userId, courseId);

    return {
      courseId,
      course: enrollment.Course,
      isEligible: isEligible && quizzesPassed.allPassed,
      progressPercent,
      totalLectures,
      completedLectures,
      quizRequirement: quizzesPassed,
      completedAt: isEligible ? enrollment.updatedAt : null,
      certificateData: isEligible && quizzesPassed.allPassed ? {
        studentId: userId,
        courseId,
        courseTitle: enrollment.Course?.title,
        issuedAt: new Date().toISOString(),
        // In real scenario, generate a unique certificate token
        certificateId: `CERT-${courseId}-${userId}-${Date.now()}`,
      } : null,
    };
  }

  /**
   * Check if student passed all published quizzes in a course
   */
  async _checkAllQuizzesPassed(userId, courseId) {
    try {
      const { Quiz, Attempt } = db.models;
      const publishedQuizzes = await Quiz.findAll({
        where: { courseId, status: 'published' },
        attributes: ['id', 'title', 'passingScore'],
      });

      if (publishedQuizzes.length === 0) {
        return { allPassed: true, total: 0, passed: 0, quizDetails: [] };
      }

      const quizDetails = await Promise.all(
        publishedQuizzes.map(async (quiz) => {
          const bestAttempt = await Attempt.findOne({
            where: { userId, quizId: quiz.id, passed: true },
            order: [['percentageScore', 'DESC']],
          });
          return {
            quizId: quiz.id,
            quizTitle: quiz.title,
            required: true,
            passed: !!bestAttempt,
            bestScore: bestAttempt?.percentageScore || null,
          };
        })
      );

      const passed = quizDetails.filter(q => q.passed).length;
      return {
        allPassed: passed === publishedQuizzes.length,
        total: publishedQuizzes.length,
        passed,
        quizDetails,
      };
    } catch (err) {
      console.error('Quiz pass check error (silent):', err);
      return { allPassed: true, total: 0, passed: 0, quizDetails: [] };
    }
  }

  /**
   * Get student dashboard — aggregate summary in one call
   */
  async getStudentDashboard(userId) {
    // 1. Enrollment summary
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [{
        model: Course,
        as: 'Course',
        attributes: ['id', 'title', 'slug', 'imageUrl'],
      }],
      order: [['enrolledAt', 'DESC']],
    });

    const totalEnrolled = enrollments.length;
    const inProgress = enrollments.filter(e => Number(e.progressPercent) > 0 && Number(e.progressPercent) < 100).length;
    const completedCourses = enrollments.filter(e => Number(e.progressPercent) >= 100).length;
    const notStarted = enrollments.filter(e => Number(e.progressPercent) === 0).length;

    // 2. Recent progress (last 5 accessed courses)
    const courseIds = enrollments.map(e => e.courseId);
    let recentProgress = [];
    if (courseIds.length > 0) {
      const lastAccessed = await LectureProgress.findAll({
        where: { userId, courseId: { [Op.in]: courseIds } },
        attributes: ['courseId', 'lastAccessedAt'],
        order: [['lastAccessedAt', 'DESC']],
      });

      // Get unique courseIds in order of last access
      const seenCourseIds = new Set();
      const recentCourseIds = [];
      for (const lp of lastAccessed) {
        if (!seenCourseIds.has(lp.courseId)) {
          seenCourseIds.add(lp.courseId);
          recentCourseIds.push(lp.courseId);
          if (recentCourseIds.length >= 5) break;
        }
      }

      recentProgress = recentCourseIds.map(cId => {
        const enrollment = enrollments.find(e => e.courseId === cId);
        const lastLectureAccess = lastAccessed.find(lp => lp.courseId === cId);
        return {
          courseId: cId,
          courseTitle: enrollment?.Course?.title,
          courseSlug: enrollment?.Course?.slug,
          courseImage: enrollment?.Course?.imageUrl,
          progressPercent: Number(enrollment?.progressPercent || 0),
          lastAccessedAt: lastLectureAccess?.lastAccessedAt,
          enrolledAt: enrollment?.enrolledAt,
        };
      });
    }

    // 3. Quiz summary
    let quizSummary = { pending: 0, completed: 0, passed: 0 };
    if (courseIds.length > 0) {
      try {
        const { Quiz, Attempt } = db.models;
        const publishedQuizzes = await Quiz.findAll({
          where: { courseId: { [Op.in]: courseIds }, status: 'published' },
          attributes: ['id'],
        });
        const quizIds = publishedQuizzes.map(q => q.id);
        if (quizIds.length > 0) {
          const completedAttempts = await Attempt.findAll({
            where: { userId, quizId: { [Op.in]: quizIds }, completedAt: { [Op.ne]: null } },
            attributes: ['quizId', 'passed'],
          });
          const attemptedQuizIds = new Set(completedAttempts.map(a => a.quizId));
          const passedQuizIds = new Set(
            completedAttempts.filter(a => a.passed).map(a => a.quizId)
          );
          quizSummary = {
            total: quizIds.length,
            pending: quizIds.length - attemptedQuizIds.size,
            completed: attemptedQuizIds.size,
            passed: passedQuizIds.size,
          };
        }
      } catch (err) {
        console.error('Dashboard quiz summary error (silent):', err);
      }
    }

    // 4. Next schedule event — reuse schedule service
    let nextEvent = null;
    try {
      const { ScheduleEvent } = db.models;
      const { Op: SeqOp, literal } = require('sequelize');
      const now = new Date();
      if (courseIds.length > 0) {
        const event = await ScheduleEvent.findOne({
          where: {
            courseId: { [Op.in]: courseIds },
            isPersonalNote: false,
            startAt: { [Op.gte]: now },
            status: { [Op.in]: ['upcoming', 'ongoing'] },
          },
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'], required: false }],
          order: [['startAt', 'ASC']],
        });
        if (event) {
          nextEvent = {
            id: String(event.id),
            title: event.title,
            type: event.type,
            courseTitle: event.course?.title,
            startAt: event.startAt,
            status: event.status,
          };
        }
      }
    } catch (err) {
      console.error('Dashboard next event error (silent):', err);
    }

    // 5. Learning streak (days with at least one lecture accessed in last 30 days)
    let streak = { current: 0, longest: 0 };
    try {
      if (courseIds.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentActivity = await LectureProgress.findAll({
          where: {
            userId,
            courseId: { [Op.in]: courseIds },
            lastAccessedAt: { [Op.gte]: thirtyDaysAgo },
          },
          attributes: ['lastAccessedAt'],
          order: [['lastAccessedAt', 'DESC']],
        });

        if (recentActivity.length > 0) {
          // Get unique dates
          const dates = [...new Set(
            recentActivity.map(a => a.lastAccessedAt.toISOString().slice(0, 10))
          )].sort((a, b) => b.localeCompare(a));

          let current = 0;
          const today = new Date().toISOString().slice(0, 10);
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

          if (dates[0] === today || dates[0] === yesterday) {
            current = 1;
            for (let i = 1; i < dates.length; i++) {
              const a = new Date(dates[i - 1]);
              const b = new Date(dates[i]);
              const diff = Math.round((a - b) / 86400000);
              if (diff === 1) current++;
              else break;
            }
          }

          // Longest streak
          let longest = 1;
          let running = 1;
          for (let i = 1; i < dates.length; i++) {
            const a = new Date(dates[i - 1]);
            const b = new Date(dates[i]);
            if (Math.round((a - b) / 86400000) === 1) {
              running++;
              longest = Math.max(longest, running);
            } else {
              running = 1;
            }
          }
          streak = { current, longest };
        }
      }
    } catch (err) {
      console.error('Dashboard streak error (silent):', err);
    }

    return {
      enrollments: {
        total: totalEnrolled,
        inProgress,
        completed: completedCourses,
        notStarted,
      },
      recentProgress,
      quizzes: quizSummary,
      nextEvent,
      streak,
    };
  }

  /**
   * Get teacher's view of student progress — FIXED: eliminated N+1 queries
   */
  async getTeacherStudentProgress(teacherId, courseId, studentId) {
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
        progressPercent: Number(enrollment?.progressPercent || 0),
        enrolledAt: enrollment?.enrolledAt,
      },
      lecturesProgress: progressList,
      lastAccessed: progressList[0]?.lastAccessedAt || null,
      totalLectures: await this.countCourseLectures(courseId),
      completedLectures: progressList.filter(p => p.isCompleted).length,
    };
  }

  /**
   * Get all students progress for a course — FIXED: N+1 eliminated via single aggregate queries
   */
  async getCourseStudentsProgress(teacherId, courseId) {
    const course = await Course.findOne({
      where: { id: courseId, createdBy: teacherId },
    });

    if (!course) {
      throw { status: 403, message: 'Bạn không có quyền xem khóa học này' };
    }

    const totalLectures = await this.countCourseLectures(courseId);

    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'avatar'],
      }],
    });

    if (enrollments.length === 0) {
      return {
        course: { id: course.id, title: course.title },
        totalStudents: 0,
        studentsProgress: [],
        totalLectures,
      };
    }

    const studentIds = enrollments.map(e => e.userId);

    // Single query: count completed lectures per student
    const completedCounts = await LectureProgress.findAll({
      where: {
        userId: { [Op.in]: studentIds },
        courseId,
        isCompleted: true,
      },
      attributes: [
        'userId',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'completedCount'],
      ],
      group: ['userId'],
      raw: true,
    });

    // Single query: last access per student
    const lastAccesses = await LectureProgress.findAll({
      where: {
        userId: { [Op.in]: studentIds },
        courseId,
      },
      attributes: [
        'userId',
        [db.sequelize.fn('MAX', db.sequelize.col('last_accessed_at')), 'lastAccessedAt'],
      ],
      group: ['userId'],
      raw: true,
    });

    const completedMap = Object.fromEntries(
      completedCounts.map(r => [r.userId, parseInt(r.completedCount, 10)])
    );
    const lastAccessMap = Object.fromEntries(
      lastAccesses.map(r => [r.userId, r.lastAccessedAt])
    );

    const studentsProgress = enrollments.map(enrollment => ({
      student: enrollment.User,
      progressPercent: Number(enrollment.progressPercent),
      completedLectures: completedMap[enrollment.userId] || 0,
      lastAccessedAt: lastAccessMap[enrollment.userId] || null,
      enrolledAt: enrollment.enrolledAt,
    }));

    return {
      course: { id: course.id, title: course.title },
      totalStudents: enrollments.length,
      studentsProgress,
      totalLectures,
    };
  }

  /**
   * Count total lectures in a course
   */
  async countCourseLectures(courseId) {
    return Lecture.count({
      include: [{
        model: Chapter,
        as: 'chapter',
        where: { courseId },
        required: true,
      }],
    });
  }
}

module.exports = new ProgressService();
