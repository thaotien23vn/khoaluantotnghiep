const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');

const { Chapter, Course, Lecture } = db.models;

/**
 * Chapter Service - Business logic for chapter operations
 */
class ChapterService {
  /**
   * Create a chapter in a course
   */
  async createChapter(courseId, userId, role, chapterData) {
    const { title, order } = chapterData;

    const course = await Course.findByPk(courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền chỉnh sửa khóa học này' };
    }

    const chapter = await Chapter.create({
      title,
      order: order != null ? order : 0,
      courseId: course.id,
    });

    return { chapter };
  }

  /**
   * Update a chapter
   */
  async updateChapter(chapterId, userId, role, updateData) {
    const { title, order } = updateData;

    const chapter = await Chapter.findByPk(chapterId);

    if (!chapter) {
      throw { status: 404, message: 'Không tìm thấy chương' };
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học của chương này' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền chỉnh sửa chương này' };
    }

    if (title != null) {
      chapter.title = title;
    }
    if (order != null) {
      chapter.order = order;
    }

    await chapter.save();

    return { chapter };
  }

  /**
   * Delete a chapter and its lectures
   */
  async deleteChapter(chapterId, userId, role) {
    const chapter = await Chapter.findByPk(chapterId);

    if (!chapter) {
      throw { status: 404, message: 'Không tìm thấy chương' };
    }

    const course = await Course.findByPk(chapter.courseId);

    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học của chương này' };
    }

    if (role === 'teacher' && course.createdBy !== userId) {
      throw { status: 403, message: 'Bạn không có quyền xóa chương này' };
    }

    // Delete lectures first to avoid foreign key issues
    await Lecture.destroy({ where: { chapterId: chapter.id } });
    await chapter.destroy();

    try {
      await courseAggregatesService.recomputeCourseTotalLessons(course.id);
    } catch (aggErr) {
      console.error('Recompute course totalLessons (silent) error:', aggErr);
    }

    return { message: 'Xóa chương và các bài giảng liên quan thành công' };
  }
}

module.exports = new ChapterService();
