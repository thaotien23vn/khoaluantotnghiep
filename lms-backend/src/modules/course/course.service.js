const { Op } = require('sequelize');
const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');

const { Course, User, Category, Enrollment, Chapter, Lecture } = db.models;

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
    ? course.Chapters.map((chapter) => ({
        id: chapter.id.toString(),
        title: chapter.title,
        lessons: chapter.lectures
          ? chapter.lectures.map((lecture) => ({
              id: lecture.id.toString(),
              title: lecture.title,
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
          : [],
      }))
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

    const where = { published: true };
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
    // Check if it's a numeric ID or slug
    const isNumeric = /^\d+$/.test(String(courseIdOrSlug));
    const where = { published: true };
    
    if (isNumeric) {
      where.id = courseIdOrSlug;
    } else {
      where.slug = courseIdOrSlug;
    }

    const course = await Course.findOne({
      where,
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
          include: [{ model: Lecture, as: 'lectures' }],
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

    if (status === 'published') {
      where.published = true;
    }
    if (status === 'draft') {
      where.published = false;
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
   * Set course published status
   */
  async setCoursePublished(courseId, userId, role, published) {
    if (typeof published !== 'boolean') {
      throw { status: 400, message: 'Trường published phải là boolean' };
    }

    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền thay đổi trạng thái khóa học này' };
    }

    await course.update({
      published,
      lastUpdated: new Date(),
    });

    return {
      message: published ? 'Đã publish khóa học' : 'Đã chuyển khóa học về draft',
      course,
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
      include: [{ model: Lecture, as: 'lectures' }],
      order: [
        ['order', 'ASC'],
        ['lectures', 'order', 'ASC'],
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
}

module.exports = new CourseService();
