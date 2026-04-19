const db = require('../../models');
const courseAggregatesService = require('../../services/courseAggregates.service');
const mediaService = require('../../services/media.service');

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

    // 🛡️ Fix: Use Number() for consistent comparison
    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
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

    // 🛡️ Fix: Use Number() for consistent comparison
    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
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

    // 🛡️ Fix: Use Number() for consistent comparison
    if (role === 'teacher' && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền xóa chương này' };
    }

    // 🛡️ Lưu URLs để xóa sau khi transaction thành công
    const lectures = await Lecture.findAll({ where: { chapterId: chapter.id } });
    const mediaUrlsToDelete = lectures
      .filter((lecture) => lecture.contentUrl)
      .map((lecture) => lecture.contentUrl);

    // 🛡️ Fix: Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
    const transaction = await db.sequelize.transaction();
    try {
      // 🛡️ FIX E7: Cleanup LectureProgress trước khi xóa lectures
      const lectureIds = lectures.map((lecture) => lecture.id);
      if (lectureIds.length > 0) {
        await LectureProgress.destroy({ 
          where: { lectureId: { [Op.in]: lectureIds } }, 
          transaction 
        });
      }
      
      // Delete lectures first to avoid foreign key issues
      await Lecture.destroy({ where: { chapterId: chapter.id }, transaction });
      await chapter.destroy({ transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // 🛡️ Fix: Delete media AFTER transaction commits successfully
    // This prevents data loss if transaction fails
    for (const contentUrl of mediaUrlsToDelete) {
      try {
        await mediaService.deleteMediaByUrl(contentUrl);
      } catch (mediaErr) {
        console.error('Delete chapter lecture media (silent) error:', mediaErr);
      }
    }

    try {
      await courseAggregatesService.recomputeCourseTotalLessons(course.id);
    } catch (aggErr) {
      console.error('Recompute course totalLessons (silent) error:', aggErr);
    }

    return { message: 'Xóa chương và các bài giảng liên quan thành công' };
  }
}

module.exports = new ChapterService();
