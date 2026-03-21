const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const mediaService = require('../../services/media.service');

const { Lecture, Chapter, Course } = db.models;

/**
 * Parse attachments safely
 */
const parseAttachments = (attachments) => {
  if (attachments === undefined) return null;
  if (attachments === null || attachments === '') return null;
  if (typeof attachments === 'object') return attachments;
  try {
    return JSON.parse(String(attachments));
  } catch {
    return null;
  }
};

/**
 * Lesson Service - Business logic for lesson operations
 */
class LessonService {
  /**
   * Create a lesson in a chapter
   */
  async createLesson(chapterId, userId, role, lessonData, file) {
    const {
      title,
      type,
      content,
      contentUrl,
      duration,
      order,
      isPreview,
      attachments,
    } = lessonData;

    if (!title || !type) {
      throw { status: 400, message: 'Tiêu đề và loại bài giảng là bắt buộc' };
    }

    const chapter = await Chapter.findByPk(chapterId);

    if (!chapter) {
      throw { status: 404, message: 'Không tìm thấy chương' };
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học của chương này' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền thêm bài giảng cho chương này' };
    }

    let finalContentUrl = contentUrl || null;

    if (file) {
      try {
        const uploadResult = await mediaService.uploadLectureMedia(file);
        finalContentUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('Lỗi upload media lên Cloudinary:', uploadError);
        throw { status: 500, message: 'Lỗi upload media lên Cloudinary. Vui lòng thử lại sau' };
      }
    }

    const lecture = await Lecture.create({
      title,
      type,
      contentUrl: finalContentUrl,
      duration: duration != null ? duration : null,
      isPreview:
        isPreview !== undefined
          ? String(isPreview) === 'true' || isPreview === true
          : false,
      attachments: parseAttachments(attachments),
      content: content || null,
      order: order != null ? order : 0,
      chapterId: chapter.id,
    });

    try {
      await courseAggregatesService.recomputeCourseTotalLessons(course.id);
    } catch (aggErr) {
      console.error('Recompute course totalLessons (silent) error:', aggErr);
    }

    return { lecture };
  }

  /**
   * Update a lesson
   */
  async updateLesson(lessonId, userId, role, updateData, file) {
    const {
      title,
      type,
      content,
      contentUrl,
      duration,
      order,
      isPreview,
      attachments,
    } = updateData;

    const lecture = await Lecture.findByPk(lessonId);

    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy bài giảng' };
    }

    const chapter = await Chapter.findByPk(lecture.chapterId);

    if (!chapter) {
      throw { status: 404, message: 'Không tìm thấy chương của bài giảng này' };
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học của chương này' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền chỉnh sửa bài giảng này' };
    }

    let finalContentUrl =
      contentUrl !== undefined ? contentUrl : lecture.contentUrl;

    if (file) {
      try {
        const uploadResult = await mediaService.uploadLectureMedia(file);
        finalContentUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('Lỗi upload media lên Cloudinary:', uploadError);
        throw { status: 500, message: 'Lỗi upload media lên Cloudinary. Vui lòng thử lại sau' };
      }
    }

    if (title != null) {
      lecture.title = title;
    }
    if (type != null) {
      lecture.type = type;
    }
    if (content !== undefined) {
      lecture.content = content;
    }
    if (finalContentUrl !== undefined) {
      lecture.contentUrl = finalContentUrl;
    }
    if (duration !== undefined) {
      lecture.duration = duration;
    }
    if (isPreview !== undefined) {
      lecture.isPreview = String(isPreview) === 'true' || isPreview === true;
    }
    if (attachments !== undefined) {
      if (attachments === null || attachments === '') {
        lecture.attachments = null;
      } else if (typeof attachments === 'object') {
        lecture.attachments = attachments;
      } else {
        try {
          lecture.attachments = JSON.parse(String(attachments));
        } catch {
          lecture.attachments = lecture.attachments;
        }
      }
    }
    if (order !== undefined) {
      lecture.order = order;
    }

    await lecture.save();

    return { lecture };
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(lessonId, userId, role) {
    const lecture = await Lecture.findByPk(lessonId);

    if (!lecture) {
      throw { status: 404, message: 'Không tìm thấy bài giảng' };
    }

    const chapter = await Chapter.findByPk(lecture.chapterId);

    if (!chapter) {
      throw { status: 404, message: 'Không tìm thấy chương của bài giảng này' };
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học của chương này' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền xóa bài giảng này' };
    }

    await lecture.destroy();

    try {
      await courseAggregatesService.recomputeCourseTotalLessons(course.id);
    } catch (aggErr) {
      console.error('Recompute course totalLessons (silent) error:', aggErr);
    }

    return { message: 'Xóa bài giảng thành công' };
  }
}

module.exports = new LessonService();
