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
          attributes: ['id', 'name', 'cefrLevel', 'sortOrder'],
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
          include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'cefrLevel', 'sortOrder'] }],
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
          attributes: ['id', 'name', 'cefrLevel', 'sortOrder'],
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

    // 3. Get ALL courses for all CEFR levels (including extra courses not in any path)
    const CEFR_TO_DB_LEVEL = {
      'A1': 'Beginner',
      'A2': 'Elementary',
      'B1': 'Intermediate',
      'B2': 'Upper-Intermediate',
      'C1': 'Advanced',
      'C2': 'Proficiency',
    };
    const allCoursesForLevels = await Course.findAll({
      where: {
        level: { [Op.in]: Object.values(CEFR_TO_DB_LEVEL) },
        deletedAt: null,
      },
      attributes: ['id', 'title', 'slug', 'imageUrl', 'skill', 'level', 'status', 'isRequired'],
    });
    const extraCoursesByLevel = {};
    for (const c of allCoursesForLevels) {
      const mappedCefr = Object.entries(CEFR_TO_DB_LEVEL).find(([_, db]) => db === c.level)?.[0];
      if (mappedCefr) {
        if (!extraCoursesByLevel[mappedCefr]) extraCoursesByLevel[mappedCefr] = [];
        extraCoursesByLevel[mappedCefr].push(c);
      }
    }

    // 4. Get ALL user enrollments across all courses
    const allEnrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId', 'progressPercent', 'status'],
    });

    const enrollmentMap = Object.fromEntries(
      allEnrollments.map(e => [e.courseId, Number(e.progressPercent || 0)])
    );

    // 5. Build all 6 CEFR levels
    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const levelProgress = cefrLevels.map(level => {
      const path = allPaths.find(p => p.category?.cefrLevel === level);
      if (!path) {
        return { level, totalCourses: 0, completedCourses: 0, progressPercent: 0, courses: [] };
      }

      const pathCourses = (path.pathCourses || [])
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
            isEnrolled: !!enrollmentMap[pc.course.id],
          };
        });

      // Merge with extra courses at this level not in the learning path
      const pathCourseIds = new Set(pathCourses.map(c => c.courseId));
      const extraCourses = (extraCoursesByLevel[level] || [])
        .filter(c => !pathCourseIds.has(c.id))
        .map(c => ({
          courseId: c.id,
          title: c.title,
          slug: c.slug,
          skill: c.skill,
          isRequired: !!c.isRequired,
          progress: enrollmentMap[c.id] || 0,
          isEnrolled: !!enrollmentMap[c.id],
        }));
      const courses = [...pathCourses, ...extraCourses];

      // Skill-based completion: a level is done when each unique skill has >= 1 completed course.
      // This prevents requiring students to complete duplicate courses from multiple teachers.
      const uniqueSkills = [...new Set(courses.map(c => c.skill).filter(Boolean))];
      const completedSkills = uniqueSkills.filter(skill =>
        courses.some(c => c.skill === skill && c.progress >= 100)
      );
      const totalSkills = uniqueSkills.length || 1;
      const completedCourses = courses.filter(c => c.progress >= 100).length;
      return {
        level,
        totalCourses: courses.length,
        completedCourses,
        progressPercent: Math.round((completedSkills.length / totalSkills) * 100),
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
   * Advance user to next CEFR level if all courses in current level are completed
   */
  async advanceLevel(userId) {
    const userPath = await UserLearningPath.findOne({
      where: { userId, status: { [Op.in]: ['active', 'completed'] } },
      include: [
        {
          model: LearningPath,
          as: 'learningPath',
          include: [{ model: Category, as: 'category', attributes: ['id', 'cefrLevel'] }],
        },
      ],
    });

    if (!userPath) {
      throw { status: 404, message: 'Bạn chưa có lộ trình học tập' };
    }

    const currentLevel = userPath.currentLevel;
    if (!currentLevel) {
      throw { status: 400, message: 'Không xác định được cấp độ hiện tại' };
    }

    // Get all courses in current level via LearningPath -> PathCourse -> Course
    const currentPath = await LearningPath.findOne({
      where: { isActive: true },
      include: [
        {
          model: Category,
          as: 'category',
          where: { cefrLevel: currentLevel },
        },
        {
          model: PathCourse,
          as: 'pathCourses',
          include: [{ model: Course, as: 'course', attributes: ['id'] }],
        },
      ],
    });

    if (!currentPath) {
      throw { status: 404, message: `Không tìm thấy lộ trình cho cấp độ ${currentLevel}` };
    }

    const courseIds = (currentPath.pathCourses || [])
      .map(pc => pc.course?.id)
      .filter(Boolean);

    if (courseIds.length === 0) {
      throw { status: 404, message: `Không có khóa học nào trong cấp độ ${currentLevel}` };
    }

    // Check all courses have 100% progress
    const enrollments = await Enrollment.findAll({
      where: { userId, courseId: { [Op.in]: courseIds } },
      attributes: ['courseId', 'progressPercent'],
    });

    const enrollmentMap = Object.fromEntries(
      enrollments.map(e => [e.courseId, Number(e.progressPercent || 0)])
    );

    const allComplete = courseIds.every(id => enrollmentMap[id] >= 100);

    if (!allComplete) {
      throw { status: 403, message: 'Bạn chưa hoàn thành tất cả khóa học trong cấp độ hiện tại' };
    }

    // Advance to next level
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIdx = levels.indexOf(currentLevel);

    if (currentIdx === -1 || currentIdx >= levels.length - 1) {
      throw { status: 400, message: 'Bạn đã ở cấp độ cao nhất' };
    }

    const nextLevel = levels[currentIdx + 1];
    await userPath.update({ currentLevel: nextLevel });

    return { newLevel: nextLevel, previousLevel: currentLevel };
  }

  /**
   * Assign a learning path to user after placement test
   */
  async assignPath(userId, cefrLevel) {
    // Find the learning path matching this CEFR level
    const category = await Category.findOne({
      where: { cefrLevel },
      include: [
        {
          model: LearningPath,
          as: 'learningPath',
          where: { isActive: true },
          required: true,
        },
      ],
    });

    if (!category || !category.learningPath) {
      throw { status: 404, message: `Không tìm thấy lộ trình cho cấp độ ${cefrLevel}` };
    }

    const path = category.learningPath;

    // Check if user already has this path
    const existing = await UserLearningPath.findOne({
      where: { userId, pathId: path.id },
    });

    if (existing) {
      // Update current level if changed
      if (existing.currentLevel !== cefrLevel) {
        existing.currentLevel = cefrLevel;
        await existing.save();
      }
      return {
        assigned: true,
        updated: true,
        userPathId: existing.id,
        pathId: path.id,
        pathName: path.name,
        currentLevel: cefrLevel,
      };
    }

    // Create new user learning path
    const userPath = await UserLearningPath.create({
      userId,
      pathId: path.id,
      currentLevel: cefrLevel,
      overallProgress: 0,
      status: 'active',
      startedAt: new Date(),
    });

    return {
      assigned: true,
      updated: false,
      userPathId: userPath.id,
      pathId: path.id,
      pathName: path.name,
      currentLevel: cefrLevel,
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
          attributes: ['id', 'name', 'cefrLevel', 'sortOrder'],
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

    const courses = (path.pathCourses || [])
      .filter(pc => pc.course)
      .map(pc => ({
        ...pc.course.toJSON(),
        orderIndex: pc.orderIndex,
        isRequired: pc.isRequired,
        isEnrolled: !!enrollmentMap[pc.course.id],
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
   * Check if user can enroll in a course (level prerequisites)
   */
  async canEnrollCourse(userId, courseId) {
    const course = await Course.findByPk(courseId, {
      include: [
        {
          model: Category,
          attributes: ['cefrLevel', 'sortOrder'],
        },
      ],
    });

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    // Resolve CEFR level from category or fallback to course.level field
    const COURSE_LEVEL_TO_SORT = {
      'beginner': 1,
      'elementary': 2,
      'intermediate': 3,
      'upper-intermediate': 4,
      'advanced': 5,
      'proficiency': 6,
    };
    const CEFR_TO_SORT = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

    let targetSortOrder = null;
    if (course.Category?.cefrLevel) {
      targetSortOrder = course.Category.sortOrder ?? CEFR_TO_SORT[course.Category.cefrLevel] ?? null;
    } else if (course.level) {
      targetSortOrder = COURSE_LEVEL_TO_SORT[course.level?.toLowerCase()] ?? null;
    }

    // If truly no level info at all, allow freely
    if (targetSortOrder === null) {
      return { allowed: true };
    }

    const userPath = await UserLearningPath.findOne({
      where: { userId, status: 'active' },
      include: [
        {
          model: LearningPath,
          as: 'learningPath',
          include: [
            {
              model: Category,
              as: 'category',
              attributes: ['cefrLevel', 'sortOrder'],
            },
          ],
        },
      ],
    });

    // If user has no path yet, only allow A1 courses (sortOrder = 1)
    if (!userPath) {
      const targetSort = targetSortOrder;
      if (targetSort > 1) {
        return {
          allowed: false,
          reason: 'Bạn cần hoàn thành bài kiểm tra đầu vào để xác định lộ trình phù hợp',
        };
      }
      return { allowed: true };
    }

    const userLevelSort = CEFR_TO_SORT[userPath.currentLevel] || 1;
    const targetLevelSort = targetSortOrder;

    // Can always enroll in current level or below
    if (targetLevelSort <= userLevelSort) {
      return { allowed: true };
    }

    // For next level, require 80% completion of current level
    if (targetLevelSort === userLevelSort + 1) {
      const progress = await this.getMyProgress(userId);
      const currentLevelData = progress?.levels?.find(
        l => l.level === userPath.currentLevel
      );
      const levelProgress = currentLevelData?.progressPercent || 0;

      if (levelProgress >= 80) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Bạn cần hoàn thành ít nhất 80% cấp độ ${userPath.currentLevel} trước khi học cấp độ tiếp theo`,
        requiredProgress: 80,
        currentProgress: levelProgress,
      };
    }

    // Skip more than 1 level ahead — not allowed
    return {
      allowed: false,
      reason: 'Bạn không thể nhảy quá nhiều cấp độ. Hãy hoàn thành từng cấp độ một.',
    };
  }

  /**
   * Update level progress after course completion
   * Called when a course reaches 100%
   */
  async updateLevelProgress(userId, courseId) {
    const course = await Course.findByPk(courseId, {
      include: [{ model: Category }],
    });

    if (!course?.Category?.cefrLevel) return;

    const userPath = await UserLearningPath.findOne({
      where: { userId, status: 'active' },
      include: [{ model: LearningPath, as: 'learningPath' }],
    });

    if (!userPath) return;

    // Recalculate overall progress
    const progress = await this.getMyProgress(userId);
    if (progress) {
      userPath.overallProgress = progress.overallProgress;
      await userPath.save();
    }

    // Check if current level is complete (all required courses done)
    const currentLevelData = progress?.levels?.find(
      l => l.level === userPath.currentLevel
    );

    if (currentLevelData && currentLevelData.progressPercent >= 100) {
      // Advance to next level
      const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = levelOrder.indexOf(userPath.currentLevel);
      if (currentIndex >= 0 && currentIndex < levelOrder.length - 1) {
        userPath.currentLevel = levelOrder[currentIndex + 1];
        await userPath.save();
      } else if (currentIndex === levelOrder.length - 1) {
        // All levels complete
        userPath.status = 'completed';
        userPath.completedAt = new Date();
        await userPath.save();
      }
    }

    return progress;
  }
}

module.exports = new LearningPathService();
