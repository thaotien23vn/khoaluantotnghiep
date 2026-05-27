const db = require('../../models');
const { Op } = require('sequelize');

const {
  LearningPath,
  PathCourse,
  UserLearningPath,
  Category,
  Course,
  Enrollment,
  LectureProgress,
  User,
} = db.models;

class LearningPathService {
  /**
   * Get all learning paths with their categories
   */
  async getAllPaths() {
    const paths = await LearningPath.findAll({
      where: { isActive: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description', 'icon', 'sortOrder'],
        },
        {
          model: PathCourse,
          as: 'pathCourses',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'slug', 'imageUrl', 'skill', 'level', 'status', 'isRequired'],
              where: { deletedAt: null },
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: Category, as: 'category' }, 'sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return paths;
  }

  /**
   * Get user's learning path progress
   */
  async getMyProgress(userId) {
    // 1. Get user's current path for currentLevel
    const userPath = await UserLearningPath.findOne({
      where: { userId, status: { [Op.in]: ['active', 'completed'] } },
      include: [
        {
          model: LearningPath,
          as: 'learningPath',
          include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'description', 'icon', 'sortOrder'] }],
        },
      ],
    });

    if (!userPath) {
      return null;
    }

    const currentLevel = userPath.currentLevel;

    // 2. Get ALL active learning paths with their courses
    const allPaths = await LearningPath.findAll({
      where: { isActive: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description', 'icon', 'sortOrder'],
        },
        {
          model: PathCourse,
          as: 'pathCourses',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'slug', 'imageUrl', 'skill', 'level', 'status', 'isRequired'],
              where: { deletedAt: null },
              required: false,
            },
          ],
        },
      ],
      order: [[{ model: Category, as: 'category' }, 'sortOrder', 'ASC']],
    });

    // 3. Get ALL user enrollments across all courses
    const allEnrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId', 'progressPercent', 'status'],
    });

    const enrollmentMap = Object.fromEntries(
      allEnrollments.map(e => [e.courseId, Number(e.progressPercent || 0)])
    );
    const enrolledCourseIds = new Set(allEnrollments.map(e => e.courseId));

    // 4. Build progress for each category path
    const levelProgress = allPaths.map(path => {
      const categoryName = path.category?.name || 'Không phân loại';

      const courses = (path.pathCourses || [])
        .filter(pc => pc.course)
        .map(pc => {
          const progress = enrollmentMap[pc.course.id] || 0;
          return {
            courseId: pc.course.id,
            title: pc.course.title,
            slug: pc.course.slug,
            skill: pc.course.skill,
            isRequired: !!pc.course.isRequired,
            progress,
            isEnrolled: enrolledCourseIds.has(pc.course.id),
          };
        });

      const completedCourses = courses.filter(c => c.progress >= 100).length;
      return {
        category: categoryName,
        totalCourses: courses.length,
        completedCourses,
        progressPercent: courses.length > 0 ? Math.round((completedCourses / courses.length) * 100) : 0,
        courses,
      };
    });

    const totalCourses = levelProgress.reduce((sum, l) => sum + l.totalCourses, 0);
    const totalCompleted = levelProgress.reduce((sum, l) => sum + l.completedCourses, 0);

    return {
      userPathId: userPath.id,
      currentLevel,
      overallProgress: totalCourses > 0 ? Math.round((totalCompleted / totalCourses) * 100) : 0,
      pathName: userPath.learningPath?.name || 'Lộ trình học tập',
      pathSlug: userPath.learningPath?.slug || '',
      levels: levelProgress,
    };
  }

  /**
   * Get single learning path detail with courses
   */
  async getPathById(pathId, userId = null) {
    const path = await LearningPath.findOne({
      where: { id: pathId, isActive: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'description', 'icon', 'sortOrder'],
        },
        {
          model: PathCourse,
          as: 'pathCourses',
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'slug', 'imageUrl', 'skill', 'level', 'price', 'status', 'isRequired'],
              where: { deletedAt: null },
              required: false,
            },
          ],
          order: [['orderIndex', 'ASC']],
        },
      ],
    });

    if (!path) {
      throw { status: 404, message: 'Không tìm thấy lộ trình' };
    }

    // If userId provided, include enrollment status
    let enrollments = [];
    if (userId) {
      const courseIds = (path.pathCourses || [])
        .filter(pc => pc.course)
        .map(pc => pc.course.id);
      if (courseIds.length > 0) {
        enrollments = await Enrollment.findAll({
          where: { userId, courseId: { [Op.in]: courseIds } },
          attributes: ['courseId', 'progressPercent', 'status'],
        });
      }
    }

    const enrollmentMap = Object.fromEntries(
      enrollments.map(e => [e.courseId, Number(e.progressPercent || 0)])
    );
    const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));

    const courses = (path.pathCourses || [])
      .filter(pc => pc.course)
      .map(pc => ({
        ...pc.course.toJSON(),
        orderIndex: pc.orderIndex,
        isRequired: pc.isRequired,
        isEnrolled: enrolledCourseIds.has(pc.course.id),
        progressPercent: enrollmentMap[pc.course.id] || 0,
      }));

    return {
      id: path.id,
      name: path.name,
      slug: path.slug,
      description: path.description,
      category: path.category,
      courses,
    };
  }

  /**
   * Check if user can enroll in a course
   */
  async canEnrollCourse(userId, courseId) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }
    // Allow free enrollment without level prerequisites
    return { allowed: true };
  }

  /**
   * Update level progress after course completion
   */
  async updateLevelProgress(userId, courseId) {
    const userPath = await UserLearningPath.findOne({
      where: { userId, status: 'active' },
    });

    if (!userPath) return;

    // Recalculate overall progress
    const progress = await this.getMyProgress(userId);
    if (progress) {
      userPath.overallProgress = progress.overallProgress;
      await userPath.save();
    }

    return progress;
  }
}

module.exports = new LearningPathService();
