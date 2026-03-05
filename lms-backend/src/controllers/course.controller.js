const { Op } = require('sequelize');
const db = require('../models');
const mediaService = require('../services/media.service');

const { Course, Chapter, Lecture, User, Category, Enrollment } = db.models;

// Helper: build URL-friendly slug from title (basic, no extra dependency)
const generateSlugFromTitle = (title) => {
  if (!title) return '';

  return title
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // spaces to dashes
    .replace(/-+/g, '-'); // collapse dashes
};

// Ensure slug is unique by appending -1, -2, ...
const generateUniqueSlug = async (title) => {
  const baseSlug = generateSlugFromTitle(title) || 'course';
  let slug = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // check if slug exists
    // use findOne with limit 1 for efficiency
    const existing = await Course.findOne({ where: { slug } });
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

// ============= PUBLIC: LIST PUBLISHED COURSES =============
exports.getPublishedCourses = async (req, res) => {
  try {
    const { q } = req.query;

    const where = { published: true };
    if (q) {
      where.title = { [Op.like]: `%${q}%` };
    }

    const courses = await Course.findAll({
      where,
      order: [['createdAt', 'DESC']],
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
    });

    // Format data để khớp với frontend
    const formattedCourses = courses.map(course => ({
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
      curriculum: [], // Sẽ được populate trong course detail
      tags: course.tags || [],
      price: parseFloat(course.price) || 0,
      lastUpdated: course.lastUpdated || new Date().toISOString(),
    }));

    res.json({
      success: true,
      data: {
        courses: formattedCourses,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: COURSE ENROLLMENTS (STUDENTS + PROGRESS) =============

/**
 * @desc    Get enrollments for a course (teacher's own course or any for admin)
 * @route   GET /api/teacher/courses/:courseId/enrollments
 * @access  Private (Teacher & Admin)
 */
exports.getCourseEnrollmentsForOwner = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem danh sách học viên của khóa học này',
      });
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

    return res.json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          createdBy: course.createdBy,
        },
        enrollments,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách học viên khóa học (teacher):', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= PUBLIC: COURSE DETAIL (WITH CONTENT) =============
exports.getCourseDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findOne({
      where: { id, published: true },
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
          include: [Lecture],
        },
      ],
      order: [
        [Chapter, 'order', 'ASC'],
        [Chapter, Lecture, 'order', 'ASC'],
      ],
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    // Format curriculum để khớp với frontend
    const curriculum = course.Chapters ? course.Chapters.map(chapter => ({
      id: chapter.id.toString(),
      title: chapter.title,
      lessons: chapter.Lectures ? chapter.Lectures.map(lecture => ({
        id: lecture.id.toString(),
        title: lecture.title,
        duration: lecture.duration ? `${Math.ceil(lecture.duration / 60)} phút` : '0 phút',
        isPreview: false, // Mặc định, có thể thêm logic sau
        videoUrl: lecture.contentUrl,
        attachments: [], // Có thể mở rộng sau
      })) : [],
    })) : [];

    // Format course data
    const formattedCourse = {
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
      totalLessons: course.totalLessons || curriculum.reduce((acc, ch) => acc + ch.lessons.length, 0),
      duration: course.duration || `${Math.ceil(curriculum.reduce((acc, ch) => acc + ch.lessons.reduce((lessonAcc, lesson) => lessonAcc + (lesson.duration || 0), 0), 0) / 60)} giờ`,
      description: course.description || '',
      willLearn: course.willLearn || [],
      requirements: course.requirements || [],
      curriculum,
      tags: course.tags || [],
      price: parseFloat(course.price) || 0,
      lastUpdated: course.lastUpdated || new Date().toISOString(),
    };

    res.json({
      success: true,
      data: {
        course: formattedCourse,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: LIST OWN (OR ALL) COURSES =============
exports.getMyCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Debug logs to track the actual user ID and role
    console.log('DEBUG getMyCourses - User ID:', userId);
    console.log('DEBUG getMyCourses - User Role:', role);
    console.log('DEBUG getMyCourses - Full User Object:', JSON.stringify(req.user, null, 2));

    const where = {};
    if (role === 'teacher') {
      where.createdBy = userId;
      console.log('DEBUG getMyCourses - Filtering courses for teacher ID:', userId);
    } else if (role === 'admin') {
      console.log('DEBUG getMyCourses - Admin user, fetching all courses');
    }

    const courses = await Course.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    console.log('DEBUG getMyCourses - Found courses count:', courses.length);
    if (courses.length > 0) {
      console.log('DEBUG getMyCourses - Course IDs and creators:', 
        courses.map(c => ({ id: c.id, createdBy: c.createdBy, title: c.title }))
      );
    }

    res.json({
      success: true,
      data: {
        courses,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy khóa học của giảng viên:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: CREATE COURSE =============
exports.createCourse = async (req, res) => {
  try {
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
      tags
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề khóa học không được để trống',
      });
    }

    const slug = await generateUniqueSlug(title);

    const course = await Course.create({
      title,
      slug,
      description: description || '',
      imageUrl: imageUrl || null,
      price: price != null ? price : 0,
      published: !!published,
      categoryId: categoryId || null,
      createdBy: req.user.id,
      // Thêm các field mới
      level: level || 'Mọi cấp độ',
      duration: duration || null,
      willLearn: willLearn || [],
      requirements: requirements || [],
      tags: tags || [],
    });

    res.status(201).json({
      success: true,
      message: 'Tạo khóa học thành công',
      data: {
        course: {
          id: course.id.toString(),
          title: course.title,
          teacher: req.user.name,
          teacherAvatar: `https://i.pravatar.cc/150?u=${req.user.username}`,
          image: course.imageUrl || '/elearning-1.jpg',
          category: 'Khác', // Sẽ update khi có category
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
      },
    });
  } catch (error) {
    console.error('Lỗi tạo khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: GET SINGLE COURSE (OWN COURSE OR ANY FOR ADMIN) =============
exports.getCourseForOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập khóa học này',
      });
    }

    res.json({
      success: true,
      data: {
        course,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: UPDATE COURSE =============
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật khóa học này',
      });
    }

    const { title, description, imageUrl, price, categoryId, published } = req.body;

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

    res.json({
      success: true,
      message: 'Cập nhật khóa học thành công',
      data: {
        course,
      },
    });
  } catch (error) {
    console.error('Lỗi cập nhật khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: DELETE COURSE =============
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const course = await Course.findByPk(id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa khóa học này',
      });
    }

    await course.destroy();

    res.json({
      success: true,
      message: 'Xóa khóa học thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// ============= TEACHER/ADMIN: COURSE CONTENT MANAGEMENT =============

// List chapters + lectures for a course (for owner/admin)
exports.getCourseContentForOwner = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const course = await Course.findByPk(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập khóa học này',
      });
    }

    const chapters = await Chapter.findAll({
      where: { courseId: course.id },
      include: [Lecture],
      order: [
        ['order', 'ASC'],
        [Lecture, 'order', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: {
        course,
        chapters,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy nội dung khóa học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Create chapter in a course
exports.createChapter = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { title, order } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề chương không được để trống',
      });
    }

    const course = await Course.findByPk(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa khóa học này',
      });
    }

    const chapter = await Chapter.create({
      title,
      order: order != null ? order : 0,
      courseId: course.id,
    });

    res.status(201).json({
      success: true,
      message: 'Tạo chương mới thành công',
      data: {
        chapter,
      },
    });
  } catch (error) {
    console.error('Lỗi tạo chương:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Update chapter
exports.updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { title, order } = req.body;

    const chapter = await Chapter.findByPk(id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chương',
      });
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học của chương này',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa chương này',
      });
    }

    if (title != null) {
      chapter.title = title;
    }
    if (order != null) {
      chapter.order = order;
    }

    await chapter.save();

    res.json({
      success: true,
      message: 'Cập nhật chương thành công',
      data: {
        chapter,
      },
    });
  } catch (error) {
    console.error('Lỗi cập nhật chương:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Delete chapter (and its lectures)
exports.deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const chapter = await Chapter.findByPk(id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chương',
      });
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học của chương này',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa chương này',
      });
    }

    // delete lectures first to avoid foreign key issues (if any)
    await Lecture.destroy({ where: { chapterId: chapter.id } });
    await chapter.destroy();

    res.json({
      success: true,
      message: 'Xóa chương và các bài giảng liên quan thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa chương:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Create lecture in a chapter
exports.createLecture = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { title, type, contentUrl, duration, order } = req.body;

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề và loại bài giảng là bắt buộc',
      });
    }

    const chapter = await Chapter.findByPk(chapterId);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chương',
      });
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học của chương này',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm bài giảng cho chương này',
      });
    }

    let finalContentUrl = contentUrl || null;

    if (req.file) {
      try {
        const uploadResult = await mediaService.uploadLectureMedia(req.file);
        finalContentUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('Lỗi upload media lên Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Lỗi upload media. Vui lòng thử lại sau',
          error: uploadError.message,
        });
      }
    }

    const lecture = await Lecture.create({
      title,
      type,
      contentUrl: finalContentUrl,
      duration: duration != null ? duration : null,
      order: order != null ? order : 0,
      chapterId: chapter.id,
    });

    res.status(201).json({
      success: true,
      message: 'Tạo bài giảng mới thành công',
      data: {
        lecture,
      },
    });
  } catch (error) {
    console.error('Lỗi tạo bài giảng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Update lecture
exports.updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { title, type, contentUrl, duration, order } = req.body;

    const lecture = await Lecture.findByPk(id);

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng',
      });
    }

    const chapter = await Chapter.findByPk(lecture.chapterId);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chương của bài giảng này',
      });
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học của chương này',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa bài giảng này',
      });
    }

    let finalContentUrl = contentUrl !== undefined ? contentUrl : lecture.contentUrl;

    if (req.file) {
      try {
        const uploadResult = await mediaService.uploadLectureMedia(req.file);
        finalContentUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('Lỗi upload media lên Cloudinary:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Lỗi upload media. Vui lòng thử lại sau',
          error: uploadError.message,
        });
      }
    }

    if (title != null) {
      lecture.title = title;
    }
    if (type != null) {
      lecture.type = type;
    }
    if (finalContentUrl !== undefined) {
      lecture.contentUrl = finalContentUrl;
    }
    if (duration !== undefined) {
      lecture.duration = duration;
    }
    if (order !== undefined) {
      lecture.order = order;
    }

    await lecture.save();

    res.json({
      success: true,
      message: 'Cập nhật bài giảng thành công',
      data: {
        lecture,
      },
    });
  } catch (error) {
    console.error('Lỗi cập nhật bài giảng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

// Delete lecture
exports.deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const lecture = await Lecture.findByPk(id);

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài giảng',
      });
    }

    const chapter = await Chapter.findByPk(lecture.chapterId);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chương của bài giảng này',
      });
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khóa học của chương này',
      });
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bài giảng này',
      });
    }

    await lecture.destroy();

    res.json({
      success: true,
      message: 'Xóa bài giảng thành công',
    });
  } catch (error) {
    console.error('Lỗi xóa bài giảng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

