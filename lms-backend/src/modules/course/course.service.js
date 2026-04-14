const { Op } = require('sequelize');
const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const notificationService = require('../notification/notification.service');

const { Course, User, Category, Enrollment, Chapter, Lecture, Quiz } = db.models;

// Helper: build URL-friendly slug from title
const generateSlugFromTitle = (title) => {
  if (!title) return '';

  return title
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Ensure slug is unique by appending -1, -2, ...
const generateUniqueSlug = async (title) => {
  const baseSlug = generateSlugFromTitle(title) || 'course';
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await Course.findOne({ where: { slug } });
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

// Format course for public listing
const formatCourseForListing = (course) => ({
  id: course.id.toString(),
  title: course.title,
  teacher: course.creator ? course.creator.name : 'Giảng viên',
  teacherAvatar: `https://i.pravatar.cc/150?u=${course.creator?.username || 'teacher'}`,
  image: course.imageUrl || '/elearning-1.jpg',
  category: course.Category ? course.Category.name : 'Khác',
  rating: parseFloat(course.rating) || 0,
  reviewCount: course.reviewCount || 0,
  students: course.students || 0,
  level: course.level || 'Mọi cấp độ',
  totalLessons: course.totalLessons || 0,
  duration: course.duration || '0 giờ',
  description: course.description || '',
  willLearn: course.willLearn || [],
  requirements: course.requirements || [],
  curriculum: [],
  tags: course.tags || [],
  price: parseFloat(course.price) || 0,
  lastUpdated: course.lastUpdated || new Date().toISOString(),
});

// Format course detail with curriculum
const formatCourseDetail = (course) => {
  const curriculum = course.Chapters
    ? course.Chapters.map((chapter) => {
        const lectures = chapter.lectures
          ? chapter.lectures.map((lecture) => ({
              id: lecture.id.toString(),
              title: lecture.title,
              type: lecture.type || 'video',
              duration: lecture.duration
                ? `${Math.ceil(lecture.duration / 60)} phút`
                : '0 phút',
              isPreview: !!lecture.isPreview,
              videoUrl: lecture.contentUrl,
              content: lecture.content || '',
              attachments: (() => {
                if (!lecture.attachments) return [];
                if (Array.isArray(lecture.attachments)) return lecture.attachments;
                try {
                  const parsed = JSON.parse(String(lecture.attachments));
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })(),
            }))
          : [];
        
        const quizzes = chapter.quizzes
          ? chapter.quizzes.map((quiz) => ({
              id: `quiz-${quiz.id}`,
              title: quiz.title,
              type: 'quiz',
              duration: `${quiz.timeLimit || 30} phút`,
              isPreview: false,
              quizId: quiz.id.toString(),
            }))
          : [];
        
        return {
          id: chapter.id.toString(),
          title: chapter.title,
          lessons: [...lectures, ...quizzes],
        };
      })
    : [];

  return {
    id: course.id.toString(),
    title: course.title,
    teacher: course.creator ? course.creator.name : 'Giảng viên',
    teacherAvatar: `https://i.pravatar.cc/150?u=${course.creator?.username || 'teacher'}`,
    image: course.imageUrl || '/elearning-1.jpg',
    category: course.Category ? course.Category.name : 'Khác',
    rating: parseFloat(course.rating) || 0,
    reviewCount: course.reviewCount || 0,
    students: course.students || 0,
    level: course.level || 'Mọi cấp độ',
    totalLessons:
      course.totalLessons ||
      curriculum.reduce((acc, ch) => acc + ch.lessons.length, 0),
    duration:
      course.duration ||
      `${Math.ceil(curriculum.reduce((acc, ch) => acc + ch.lessons.reduce((lessonAcc, lesson) => lessonAcc + (lesson.duration || 0), 0), 0) / 60)} giờ`,
    description: course.description || '',
    willLearn: (() => {
      if (!course.willLearn) return [];
      if (Array.isArray(course.willLearn)) return course.willLearn;
      try {
        const parsed = JSON.parse(String(course.willLearn));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    requirements: (() => {
      if (!course.requirements) return [];
      if (Array.isArray(course.requirements)) return course.requirements;
      try {
        const parsed = JSON.parse(String(course.requirements));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    curriculum,
    tags: (() => {
      if (!course.tags) return [];
      if (Array.isArray(course.tags)) return course.tags;
      try {
        const parsed = JSON.parse(String(course.tags));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    price: parseFloat(course.price) || 0,
    lastUpdated: course.lastUpdated || new Date().toISOString(),
  };
};

// Parse JSON fields safely
const parseJsonField = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Course Service - Business logic for course operations
 */
class CourseService {
  /**
   * Get published courses with pagination and filters
   */
  async getPublishedCourses(query) {
    const {
      q,
      categoryId,
      level,
      minPrice,
      maxPrice,
      sort = 'newest',
      page = 1,
      limit = 20,
    } = query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = { status: 'published', published: true };
    if (q) {
      where.title = { [Op.like]: `%${q}%` };
    }
    if (categoryId) {
      where.categoryId = Number(categoryId);
    }
    if (level) {
      where.level = level;
    }
    if (minPrice != null || maxPrice != null) {
      where.price = {};
      if (minPrice != null && minPrice !== '') {
        where.price[Op.gte] = Number(minPrice);
      }
      if (maxPrice != null && maxPrice !== '') {
        where.price[Op.lte] = Number(maxPrice);
      }
    }

    const order = (() => {
      switch (sort) {
        case 'oldest':
          return [['createdAt', 'ASC'], ['id', 'ASC']];
        case 'price_asc':
          return [['price', 'ASC'], ['id', 'ASC']];
        case 'price_desc':
          return [['price', 'DESC'], ['id', 'DESC']];
        case 'rating_desc':
          return [['rating', 'DESC'], ['id', 'DESC']];
        case 'students_desc':
          return [['students', 'DESC'], ['id', 'DESC']];
        case 'newest':
        default:
          return [['createdAt', 'DESC'], ['id', 'DESC']];
      }
    })();

    const { rows: courses, count: total } = await Course.findAndCountAll({
      where,
      order,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username'],
        },
        {
          model: Category,
          attributes: ['id', 'name'],
        },
      ],
      limit: limitNum,
      offset,
    });

    const formattedCourses = courses.map(formatCourseForListing);

    return {
      courses: formattedCourses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get course detail with content
   */
  async getCourseDetail(courseIdOrSlug) {
    const isNumericId = /^\d+$/.test(courseIdOrSlug);
    const whereClause = isNumericId
      ? { id: Number(courseIdOrSlug), status: 'published', published: true }
      : { slug: courseIdOrSlug, status: 'published', published: true };

    const course = await Course.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username'],
        },
        {
          model: Category,
          attributes: ['id', 'name'],
        },
        {
          model: Chapter,
          as: 'Chapters',
          include: [
            { model: Lecture, as: 'lectures' },
            {
              model: Quiz,
              as: 'quizzes',
              where: { status: 'published' },
              required: false,
            },
          ],
        },
      ],
      order: [
        ['Chapters', 'order', 'ASC'],
        ['Chapters', 'lectures', 'order', 'ASC'],
      ],
    });

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    return formatCourseDetail(course);
  }

  /**
   * Get teacher's courses (or all for admin)
   */
  async getMyCourses(userId, role, query) {
    const {
      q,
      status = 'all',
      sort = 'newest',
      page = 1,
      limit = 50,
    } = query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (role === 'teacher') {
      where.createdBy = userId;
    }

    if (q) {
      where.title = { [Op.like]: `%${q}%` };
    }

    if (status !== 'all') {
      where.status = status;
    }

    const order = (() => {
      switch (sort) {
        case 'oldest':
          return [['createdAt', 'ASC'], ['id', 'ASC']];
        case 'updated_desc':
          return [['updatedAt', 'DESC'], ['id', 'DESC']];
        case 'newest':
        default:
          return [['createdAt', 'DESC'], ['id', 'DESC']];
      }
    })();

    const { rows: courses, count: total } = await Course.findAndCountAll({
      where,
      order,
      limit: limitNum,
      offset,
    });

    return {
      courses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Create a new course
   */
  async createCourse(userId, userRole, userInfo, courseData) {
    const {
      title,
      description,
      imageUrl,
      price,
      categoryId,
      published,
      level,
      duration,
      willLearn,
      requirements,
      tags,
    } = courseData;

    const slug = await generateUniqueSlug(title);

    const course = await Course.create({
      title,
      slug,
      description: description || '',
      imageUrl: imageUrl || null,
      price: price != null ? price : 0,
      published: !!published,
      categoryId: categoryId || null,
      createdBy: userId,
      level: level || 'Mọi cấp độ',
      duration: duration || null,
      willLearn: parseJsonField(willLearn),
      requirements: parseJsonField(requirements),
      tags: parseJsonField(tags),
    });

    return {
      course: {
        id: course.id.toString(),
        title: course.title,
        teacher: userInfo.name,
        teacherAvatar: `https://i.pravatar.cc/150?u=${userInfo.username}`,
        image: course.imageUrl || '/elearning-1.jpg',
        category: 'Khác',
        rating: 0,
        reviewCount: 0,
        students: 0,
        level: course.level,
        totalLessons: 0,
        duration: course.duration,
        description: course.description,
        willLearn: course.willLearn,
        requirements: course.requirements,
        curriculum: [],
        tags: course.tags,
        price: parseFloat(course.price),
        lastUpdated: course.updatedAt,
      },
    };
  }

  /**
   * Get course for owner (teacher's own or any for admin)
   */
  async getCourseForOwner(courseId, userId, role) {
    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    return { course };
  }

  /**
   * Update a course
   */
  async updateCourse(courseId, userId, role, updateData) {
    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền cập nhật khóa học này' };
    }

    const { title, description, imageUrl, price, categoryId, published } = updateData;

    if (title && title !== course.title) {
      course.slug = await generateUniqueSlug(title);
      course.title = title;
    }

    if (description != null) {
      course.description = description;
    }
    if (imageUrl !== undefined) {
      course.imageUrl = imageUrl || null;
    }
    if (price != null) {
      course.price = price;
    }
    if (categoryId !== undefined) {
      course.categoryId = categoryId;
    }
    if (published !== undefined) {
      course.published = !!published;
    }

    await course.save();

    return { course };
  }

  /**
   * Delete a course
   */
  async deleteCourse(courseId, userId, role) {
    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền xóa khóa học này' };
    }

    await course.destroy();

    return { message: 'Xóa khóa học thành công' };
  }

  /**
   * Set course published status - CHỈ ADMIN ĐƯỢC SỬ DỤNG
   * Teacher không thể tự publish, phải gửi yêu cầu duyệt
   */
  async setCoursePublished(courseId, userId, role, published) {
    // Chỉ admin được phép publish/unpublish trực tiếp
    if (role !== 'admin') {
      throw { status: 403, message: 'Chỉ admin mới có quyền publish/unpublish khóa học. Giáo viên vui lòng sử dụng chức năng "Gửi yêu cầu duyệt".' };
    }

    if (typeof published !== 'boolean') {
      throw { status: 400, message: 'Trường published phải là boolean' };
    }

    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    const newStatus = published ? 'published' : 'draft';

    await course.update({
      published,
      status: newStatus,
      reviewedBy: published ? userId : null,
      reviewedAt: published ? new Date() : null,
      lastUpdated: new Date(),
    });

    return {
      message: published ? 'Đã publish khóa học' : 'Đã chuyển khóa học về draft',
      course,
    };
  }

  /**
   * Teacher submit course for admin review
   * Giáo viên gửi yêu cầu duyệt khóa học
   */
  async submitCourseForReview(courseId, userId, role) {
    if (role !== 'teacher' && role !== 'admin') {
      throw { status: 403, message: 'Bạn không có quyền thực hiện hành động này' };
    }

    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    // Teacher chỉ được gửi review khóa học của mình
    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền gửi duyệt khóa học này' };
    }

    // Kiểm tra trạng thái hiện tại
    if (course.status === 'pending_review') {
      throw { status: 400, message: 'Khóa học đang chờ duyệt, không cần gửi lại' };
    }

    if (course.status === 'published') {
      throw { status: 400, message: 'Khóa học đã được publish, không cần gửi duyệt' };
    }

    await course.update({
      status: 'pending_review',
      lastUpdated: new Date(),
    });

    return {
      message: 'Đã gửi yêu cầu duyệt khóa học. Vui lòng chờ admin phê duyệt.',
      course,
    };
  }

  /**
   * Admin review course - approve or reject
   * Admin phê duyệt hoặc từ chối khóa học
   */
  async adminReviewCourse(courseId, userId, role, action, rejectionReason = null) {
    if (role !== 'admin') {
      throw { status: 403, message: 'Chỉ admin mới có quyền duyệt khóa học' };
    }

    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (action === 'approve') {
      await course.update({
        status: 'published',
        published: true,
        reviewedBy: userId,
        reviewedAt: new Date(),
        rejectionReason: null,
        lastUpdated: new Date(),
      });

      // Notify teacher that course was approved
      await notificationService.createNotification({
        userId: course.createdBy,
        title: 'Khóa học đã được phê duyệt',
        message: `Khóa học "${course.title}" của bạn đã được admin phê duyệt và publish.`,
        type: 'course_approved',
        payload: { courseId: course.id, courseTitle: course.title },
      });

      return {
        message: 'Đã phê duyệt và publish khóa học',
        course,
      };
    } else if (action === 'reject') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        throw { status: 400, message: 'Vui lòng cung cấp lý do từ chối' };
      }

      await course.update({
        status: 'rejected',
        published: false,
        reviewedBy: userId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
        lastUpdated: new Date(),
      });

      // Notify teacher that course was rejected
      await notificationService.createNotification({
        userId: course.createdBy,
        title: 'Khóa học bị từ chối',
        message: `Khóa học "${course.title}" của bạn đã bị từ chối. Lý do: ${rejectionReason}`,
        type: 'course_rejected',
        payload: { courseId: course.id, courseTitle: course.title, rejectionReason },
      });

      return {
        message: 'Đã từ chối khóa học',
        course,
      };
    } else {
      throw { status: 400, message: 'Hành động không hợp lệ. Chỉ chấp nhận: approve, reject' };
    }
  }

  /**
   * Get courses pending review (for admin)
   * Lấy danh sách khóa học đang chờ duyệt
   */
  async getPendingReviewCourses(query) {
    const { page = 1, limit = 20 } = query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const { rows: courses, count: total } = await Course.findAndCountAll({
      where: { status: 'pending_review' },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'username', 'email'],
        },
        {
          model: Category,
          attributes: ['id', 'name'],
        },
      ],
      limit: limitNum,
      offset,
    });

    return {
      courses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get course enrollments (for teacher or admin)
   */
  async getCourseEnrollments(courseId, userId, role) {
    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền xem danh sách học viên của khóa học này' };
    }

    const enrollments = await Enrollment.findAll({
      where: { courseId },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'username', 'email', 'role'],
        },
      ],
      order: [['enrolledAt', 'DESC']],
    });

    return {
      course: {
        id: course.id,
        title: course.title,
        createdBy: course.createdBy,
      },
      enrollments,
    };
  }

  /**
   * Get course content for owner/admin
   */
  async getCourseContentForOwner(courseId, userId, role) {
    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const chapters = await Chapter.findAll({
      where: { courseId: course.id },
      include: [
        { model: Lecture, as: 'lectures' },
        { 
          model: Quiz, 
          as: 'quizzes',
          required: false,
        },
      ],
      order: [
        ['order', 'ASC'],
        ['lectures', 'order', 'ASC'],
        ['quizzes', 'created_at', 'ASC'],
      ],
    });

    const formattedChapters = chapters.map((chapter) => {
      const chapterData = chapter.get({ plain: true });
      if (chapterData.lectures) {
        chapterData.lectures = chapterData.lectures.map((lecture) => ({
          ...lecture,
          attachments: (() => {
            if (!lecture.attachments) return [];
            if (Array.isArray(lecture.attachments)) return lecture.attachments;
            try {
              const parsed = JSON.parse(String(lecture.attachments));
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })(),
        }));
      }
      return chapterData;
    });

    return { course, chapters: formattedChapters };
  }

  /**
   * Toggle course publish status
   */
  async togglePublishStatus(courseId) {
    const { models } = require('../../models');
    const { Course } = models;
    
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    // Toggle published status
    course.published = !course.published;
    
    // If publishing, also set status to published
    if (course.published) {
      course.status = 'published';
    } else {
      course.status = 'draft';
    }
    
    await course.save();

    return course;
  }
}

module.exports = new CourseService();
