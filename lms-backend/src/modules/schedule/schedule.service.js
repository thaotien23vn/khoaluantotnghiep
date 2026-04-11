const { Op, literal } = require('sequelize');
const db = require('../../models');

const { ScheduleEvent, Course, Enrollment } = db.models;

/**
 * Get teacher's schedule for courses they own
 */
async function getTeacherSchedule(teacherId, query) {
  const { month, year, page = 1, limit = 50 } = query;

  // Get all courses owned by this teacher
  const teacherCourses = await Course.findAll({
    where: { createdBy: teacherId },
    attributes: ['id', 'title'],
  });

  const courseIds = teacherCourses.map((c) => c.id);

  if (courseIds.length === 0) {
    return { schedule: [], meta: { total: 0, limit, offset: 0 } };
  }

  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const where = { courseId: { [Op.in]: courseIds }, isPersonalNote: false };

  // Filter by month/year if provided
  if (month && year) {
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    where.startAt = { [Op.between]: [startOfMonth, endOfMonth] };
  } else if (month) {
    const currentYear = new Date().getFullYear();
    const startOfMonth = new Date(currentYear, parseInt(month) - 1, 1);
    const endOfMonth = new Date(currentYear, parseInt(month), 0, 23, 59, 59);
    where.startAt = { [Op.between]: [startOfMonth, endOfMonth] };
  }

  const total = await ScheduleEvent.count({ where });
  const events = await ScheduleEvent.findAll({
    where,
    include: [{ model: Course, as: 'course', attributes: ['id', 'title'] }],
    order: [['startAt', 'ASC']],
    limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100),
    offset,
  });

  const schedule = events.map(formatEventRow);
  return { schedule, meta: { total, limit, offset } };
}

// Valid event types and statuses
const VALID_EVENT_TYPES = ['lesson', 'assignment', 'exam', 'event', 'live'];
const VALID_EVENT_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

// SQL for ordering by type priority
const TYPE_ORDER_SQL = "CASE type WHEN 'exam' THEN 0 WHEN 'assignment' THEN 1 WHEN 'lesson' THEN 2 ELSE 3 END";

/**
 * Parse date to parts
 */
const toDateParts = (date) => {
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`,
  };
};

/**
 * Parse datetime string
 */
const parseDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isValidEventType = (type) => VALID_EVENT_TYPES.includes(String(type).toLowerCase());
const isValidEventStatus = (status) => VALID_EVENT_STATUSES.includes(String(status).toLowerCase());

/**
 * Format a single event row for API response
 */
function formatEventRow(event) {
  const startParts = toDateParts(event.startAt);
  const endParts = toDateParts(event.endAt);
  return {
    id: String(event.id),
    courseId: event.courseId ? String(event.courseId) : null,
    courseTitle: event.course?.title || '',
    title: event.title,
    type: event.type,
    status: event.status,
    isPersonalNote: event.isPersonalNote || false,
    description: event.description || undefined,
    zoomLink: event.zoomLink || undefined,
    location: event.location || undefined,
    startAt: event.startAt,
    endAt: event.endAt,
    date: startParts.date,
    startTime: startParts.time,
    endTime: endParts.time,
  };
}

/**
 * Schedule Service - Business logic for schedule operations
 */
class ScheduleService {
  /**
   * Get student's schedule — combines course events (enrolled courses) + personal notes
   */
  async getMySchedule(userId, query) {
    const { courseId: courseIdFilter, type, status, month, year, page = 1, limit = 20 } = query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    // Validate that filtered courseId belongs to student
    if (courseIdFilter != null && !courseIds.includes(parseInt(courseIdFilter))) {
      throw { status: 403, message: 'Bạn không có quyền xem lịch học của khóa học này' };
    }

    // Build month/year date range filter
    let dateRange = null;
    if (month && year) {
      dateRange = {
        [Op.between]: [
          new Date(parseInt(year), parseInt(month) - 1, 1),
          new Date(parseInt(year), parseInt(month), 0, 23, 59, 59),
        ],
      };
    } else if (month) {
      const currentYear = new Date().getFullYear();
      dateRange = {
        [Op.between]: [
          new Date(currentYear, parseInt(month) - 1, 1),
          new Date(currentYear, parseInt(month), 0, 23, 59, 59),
        ],
      };
    }

    // Build conditions — course events visible to student
    const courseEventWhere = {
      isPersonalNote: false,
      courseId: courseIdFilter != null
        ? parseInt(courseIdFilter)
        : courseIds.length > 0 ? { [Op.in]: courseIds } : { [Op.in]: [-1] },
    };
    if (type) courseEventWhere.type = type;
    if (status) courseEventWhere.status = status;
    if (dateRange) courseEventWhere.startAt = dateRange;

    // Personal notes condition
    const personalNoteWhere = {
      isPersonalNote: true,
      createdBy: userId,
    };
    if (type) personalNoteWhere.type = type;
    if (status) personalNoteWhere.status = status;
    if (dateRange) personalNoteWhere.startAt = dateRange;

    // If filtering by specific courseId, skip personal notes (they have no courseId)
    const includePersonalNotes = courseIdFilter == null;

    // Count both sets
    const courseEventCount = courseIds.length > 0 || courseIdFilter != null
      ? await ScheduleEvent.count({ where: courseEventWhere })
      : 0;
    const personalNoteCount = includePersonalNotes
      ? await ScheduleEvent.count({ where: personalNoteWhere })
      : 0;
    const total = courseEventCount + personalNoteCount;

    // Fetch combined events
    const courseEvents = courseIds.length > 0 || courseIdFilter != null
      ? await ScheduleEvent.findAll({
          where: courseEventWhere,
          include: [{ model: Course, as: 'course', attributes: ['id', 'title'], required: false }],
          order: [['startAt', 'ASC']],
        })
      : [];

    const personalNotes = includePersonalNotes
      ? await ScheduleEvent.findAll({
          where: personalNoteWhere,
          order: [['startAt', 'ASC']],
        })
      : [];

    // Merge and sort by startAt then type priority
    const TYPE_PRIORITY = { exam: 0, assignment: 1, lesson: 2 };
    const allEvents = [...courseEvents, ...personalNotes].sort((a, b) => {
      const timeDiff = new Date(a.startAt) - new Date(b.startAt);
      if (timeDiff !== 0) return timeDiff;
      return (TYPE_PRIORITY[a.type] ?? 3) - (TYPE_PRIORITY[b.type] ?? 3);
    });

    // Apply pagination on merged result
    const paginatedEvents = allEvents.slice(offset, offset + limitNum);
    const schedule = paginatedEvents.map(formatEventRow);

    return { schedule, meta: { total, page: pageNum, limit: limitNum } };
  }

  /**
   * Get next upcoming schedule event for student
   */
  async getNextScheduleEvent(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    const now = new Date();

    // Find next course event
    let event = null;
    if (courseIds.length > 0) {
      event = await ScheduleEvent.findOne({
        where: {
          courseId: { [Op.in]: courseIds },
          isPersonalNote: false,
          startAt: { [Op.gte]: now },
          status: { [Op.in]: ['upcoming', 'ongoing'] },
        },
        include: [{ model: Course, as: 'course', attributes: ['id', 'title'], required: false }],
        order: [[literal(TYPE_ORDER_SQL), 'ASC'], ['startAt', 'ASC']],
      });
    }

    // If no course event, check personal notes
    if (!event) {
      event = await ScheduleEvent.findOne({
        where: {
          isPersonalNote: true,
          createdBy: userId,
          startAt: { [Op.gte]: now },
          status: { [Op.in]: ['upcoming', 'ongoing'] },
        },
        order: [['startAt', 'ASC']],
      });
    }

    if (!event) return { event: null };

    return { event: formatEventRow(event) };
  }

  /**
   * Update schedule event (teacher/admin only — course events)
   */
  async updateScheduleEvent(eventId, userId, userRole, updateData) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) throw { status: 404, message: 'Không tìm thấy lịch học' };

    // Prevent teacher from editing personal notes of students
    if (event.isPersonalNote) {
      throw { status: 403, message: 'Không thể chỉnh sửa ghi chú cá nhân qua API này' };
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = updateData || {};

    if (type != null && !isValidEventType(type)) throw { status: 400, message: 'type không hợp lệ' };
    if (status != null && !isValidEventStatus(status)) throw { status: 400, message: 'status không hợp lệ' };

    const nextStart = startAt != null ? parseDateTime(startAt) : event.startAt;
    const nextEnd = endAt != null ? parseDateTime(endAt) : event.endAt;
    if (!nextStart || !nextEnd) throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    if (new Date(nextEnd) < new Date(nextStart)) throw { status: 400, message: 'endAt phải >= startAt' };

    await event.update({
      title: title != null ? String(title) : event.title,
      type: type != null ? String(type).toLowerCase() : event.type,
      startAt: nextStart,
      endAt: nextEnd,
      status: status != null ? String(status).toLowerCase() : event.status,
      description: description !== undefined ? (description != null ? String(description) : null) : event.description,
      zoomLink: zoomLink !== undefined ? (zoomLink != null ? String(zoomLink) : null) : event.zoomLink,
      location: location !== undefined ? (location != null ? String(location) : null) : event.location,
    });

    return { event };
  }

  /**
   * Delete schedule event (teacher/admin only)
   */
  async deleteScheduleEvent(eventId, userId, userRole) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) throw { status: 404, message: 'Không tìm thấy lịch học' };

    if (event.isPersonalNote) {
      throw { status: 403, message: 'Không thể xóa ghi chú cá nhân qua API này' };
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    await event.destroy();
    return { message: 'Xóa lịch học thành công' };
  }

  /**
   * List schedule events for a course (teacher/admin view)
   */
  async listCourseScheduleEvents(courseId, userId, userRole) {
    const course = await Course.findByPk(courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const events = await ScheduleEvent.findAll({
      where: { courseId, isPersonalNote: false },
      order: [['startAt', 'ASC']],
    });

    return { events };
  }

  /**
   * Create schedule event for a course (teacher/admin)
   */
  async createCourseScheduleEvent(courseId, userId, userRole, eventData) {
    const course = await Course.findByPk(courseId);
    if (!course) throw { status: 404, message: 'Không tìm thấy khóa học' };

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = eventData || {};

    if (!title || !type || !startAt || !endAt) {
      throw { status: 400, message: 'Thiếu dữ liệu bắt buộc: title, type, startAt, endAt' };
    }
    if (!isValidEventType(type)) throw { status: 400, message: 'type không hợp lệ' };
    if (status != null && !isValidEventStatus(status)) throw { status: 400, message: 'status không hợp lệ' };

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (end < start) throw { status: 400, message: 'endAt phải >= startAt' };

    const event = await ScheduleEvent.create({
      courseId,
      createdBy: userId,
      isPersonalNote: false,
      title: String(title),
      type: String(type).toLowerCase(),
      startAt: start,
      endAt: end,
      status: status ? String(status) : 'upcoming',
      description: description ? String(description) : null,
      zoomLink: zoomLink ? String(zoomLink) : null,
      location: location ? String(location) : null,
    });

    return { event };
  }

  /**
   * Create student personal schedule note — FIXED: no courseId hardcode, use createdBy + isPersonalNote
   */
  async createStudentNote(userId, noteData) {
    const { title, type, startAt, endAt, status, description, zoomLink, location } = noteData || {};

    if (!title || !startAt || !endAt) {
      throw { status: 400, message: 'Thiếu dữ liệu bắt buộc: title, startAt, endAt' };
    }
    if (type && !isValidEventType(type)) {
      throw { status: 400, message: `type không hợp lệ. Chấp nhận: ${VALID_EVENT_TYPES.join(', ')}` };
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (end < start) throw { status: 400, message: 'endAt phải >= startAt' };

    const event = await ScheduleEvent.create({
      courseId: null,           // Personal notes have no courseId
      createdBy: userId,        // Track ownership
      isPersonalNote: true,     // Mark as personal note — not a course event
      title: String(title),
      type: type ? String(type).toLowerCase() : 'event',
      startAt: start,
      endAt: end,
      status: status ? String(status) : 'upcoming',
      description: description ? String(description) : null,
      zoomLink: zoomLink ? String(zoomLink) : null,
      location: location ? String(location) : null,
    });

    return { event: formatEventRow(event) };
  }

  /**
   * Update student personal note — FIXED: ownership check via createdBy
   */
  async updateStudentNote(eventId, userId, updateData) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) throw { status: 404, message: 'Không tìm thấy ghi chú' };

    // Ownership check — student can only edit their own notes
    if (!event.isPersonalNote) {
      throw { status: 403, message: 'Không thể chỉnh sửa lịch học của khóa học' };
    }
    if (Number(event.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền chỉnh sửa ghi chú này' };
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = updateData || {};

    if (type != null && !isValidEventType(type)) {
      throw { status: 400, message: `type không hợp lệ. Chấp nhận: ${VALID_EVENT_TYPES.join(', ')}` };
    }

    const nextStart = startAt != null ? parseDateTime(startAt) : event.startAt;
    const nextEnd = endAt != null ? parseDateTime(endAt) : event.endAt;
    if (!nextStart || !nextEnd) throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    if (new Date(nextEnd) < new Date(nextStart)) throw { status: 400, message: 'endAt phải >= startAt' };

    await event.update({
      title: title != null ? String(title) : event.title,
      type: type != null ? String(type).toLowerCase() : event.type,
      startAt: nextStart,
      endAt: nextEnd,
      status: status != null ? String(status).toLowerCase() : event.status,
      description: description !== undefined ? (description != null ? String(description) : null) : event.description,
      zoomLink: zoomLink !== undefined ? (zoomLink != null ? String(zoomLink) : null) : event.zoomLink,
      location: location !== undefined ? (location != null ? String(location) : null) : event.location,
    });

    return { event: formatEventRow(event) };
  }

  /**
   * Delete student personal note — FIXED: ownership check via createdBy
   */
  async deleteStudentNote(eventId, userId) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) throw { status: 404, message: 'Không tìm thấy ghi chú' };

    if (!event.isPersonalNote) {
      throw { status: 403, message: 'Không thể xóa lịch học của khóa học' };
    }
    if (Number(event.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền xóa ghi chú này' };
    }

    await event.destroy();
    return { message: 'Xóa ghi chú thành công' };
  }

  /**
   * Format event for response (alias kept for compatibility)
   */
  formatEvent(event) {
    return formatEventRow(event);
  }
}

module.exports = new ScheduleService();
module.exports.getTeacherSchedule = getTeacherSchedule;
