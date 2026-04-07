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

  const where = { courseId: { [Op.in]: courseIds } };

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

  const schedule = events.map((event) => {
    const startParts = toDateParts(event.startAt);
    const endParts = toDateParts(event.endAt);
    return {
      id: String(event.id),
      courseId: String(event.courseId),
      courseTitle: event.course?.title || '',
      title: event.title,
      type: event.type,
      status: event.status,
      description: event.description || undefined,
      zoomLink: event.zoomLink || undefined,
      location: event.location || undefined,
      startAt: event.startAt,
      endAt: event.endAt,
      date: startParts.date,
      startTime: startParts.time,
      endTime: endParts.time,
    };
  });

  return { schedule, meta: { total, limit, offset } };
}

// Valid event types and statuses
const VALID_EVENT_TYPES = ['lesson', 'assignment', 'exam', 'event'];
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

/**
 * Check if event type is valid
 */
const isValidEventType = (type) => VALID_EVENT_TYPES.includes(String(type).toLowerCase());

/**
 * Check if event status is valid
 */
const isValidEventStatus = (status) => VALID_EVENT_STATUSES.includes(String(status).toLowerCase());

/**
 * Schedule Service - Business logic for schedule operations
 */
class ScheduleService {
  /**
   * Get student's schedule
   */
  async getMySchedule(userId, query) {
    const { courseId: courseIdFilter, type, status, page = 1, limit = 20 } = query;
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    if (courseIds.length === 0) {
      return { schedule: [], meta: { total: 0, limit, offset } };
    }

    if (courseIdFilter != null && !courseIds.includes(parseInt(courseIdFilter))) {
      throw { status: 403, message: 'Bạn không có quyền xem lịch học của khóa học này' };
    }

    const where = { courseId: courseIdFilter != null ? parseInt(courseIdFilter) : { [Op.in]: courseIds } };
    if (type) where.type = type;
    if (status) where.status = status;

    const total = await ScheduleEvent.count({ where });
    const events = await ScheduleEvent.findAll({
      where,
      include: [{ 
        model: Course, 
        as: 'course', 
        attributes: ['id', 'title'],
        required: false // LEFT JOIN to include events with null courseId
      }],
      order: [[literal(TYPE_ORDER_SQL), 'ASC'], ['startAt', 'ASC']],
      limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
      offset,
    });

    const schedule = events.map((event) => {
      const startParts = toDateParts(event.startAt);
      const endParts = toDateParts(event.endAt);
      return {
        id: String(event.id),
        courseId: event.courseId ? String(event.courseId) : null, // Handle null
        courseTitle: event.course?.title || '',
        title: event.title,
        type: event.type,
        status: event.status,
        description: event.description || undefined,
        zoomLink: event.zoomLink || undefined,
        location: event.location || undefined,
        startAt: event.startAt,
        endAt: event.endAt,
        date: startParts.date,
        startTime: startParts.time,
        endTime: endParts.time,
      };
    });

    return { schedule, meta: { total, limit, offset } };
  }

  /**
   * Get next upcoming schedule event
   */
  async getNextScheduleEvent(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    if (courseIds.length === 0) {
      return { event: null };
    }

    const now = new Date();
    const event = await ScheduleEvent.findOne({
      where: {
        courseId: { [Op.in]: courseIds },
        startAt: { [Op.gte]: now },
        status: { [Op.in]: ['upcoming', 'ongoing'] },
      },
      include: [{ 
        model: Course, 
        as: 'course', 
        attributes: ['id', 'title'],
        required: false
      }],
      order: [[literal(TYPE_ORDER_SQL), 'ASC'], ['startAt', 'ASC']],
    });

    if (!event) {
      return { event: null };
    }

    const startParts = toDateParts(event.startAt);
    const endParts = toDateParts(event.endAt);

    return {
      event: {
        id: String(event.id),
        courseId: event.courseId ? String(event.courseId) : null,
        courseTitle: event.course?.title || '',
        title: event.title,
        type: event.type,
        status: event.status,
        description: event.description || undefined,
        zoomLink: event.zoomLink || undefined,
        location: event.location || undefined,
        startAt: event.startAt,
        endAt: event.endAt,
        date: startParts.date,
        startTime: startParts.time,
        endTime: endParts.time,
      },
    };
  }

  /**
   * Update schedule event
   */
  async updateScheduleEvent(eventId, userId, userRole, updateData) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      throw { status: 404, message: 'Không tìm thấy lịch học' };
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = updateData || {};

    if (type != null && !isValidEventType(type)) {
      throw { status: 400, message: 'type không hợp lệ' };
    }
    if (status != null && !isValidEventStatus(status)) {
      throw { status: 400, message: 'status không hợp lệ' };
    }

    const nextStart = startAt != null ? parseDateTime(startAt) : event.startAt;
    const nextEnd = endAt != null ? parseDateTime(endAt) : event.endAt;
    if (!nextStart || !nextEnd) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
      throw { status: 400, message: 'endAt phải >= startAt' };
    }

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
   * Delete schedule event
   */
  async deleteScheduleEvent(eventId, userId, userRole) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      throw { status: 404, message: 'Không tìm thấy lịch học' };
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    await event.destroy();
    return { message: 'Xóa lịch học thành công' };
  }

  /**
   * List schedule events for a course
   */
  async listCourseScheduleEvents(courseId, userId, userRole) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const events = await ScheduleEvent.findAll({
      where: { courseId },
      order: [['startAt', 'ASC']],
    });

    return { events };
  }

  /**
   * Create schedule event for a course
   */
  async createCourseScheduleEvent(courseId, userId, userRole, eventData) {
    const course = await Course.findByPk(courseId);
    if (!course) {
      throw { status: 404, message: 'Không tìm thấy khóa học' };
    }

    if (userRole !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(userId)) {
      throw { status: 403, message: 'Bạn không có quyền truy cập khóa học này' };
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = eventData || {};

    if (!title || !type || !startAt || !endAt) {
      throw { status: 400, message: 'Thiếu dữ liệu bắt buộc: title, type, startAt, endAt' };
    }
    if (!isValidEventType(type)) {
      throw { status: 400, message: 'type không hợp lệ' };
    }
    if (status != null && !isValidEventStatus(status)) {
      throw { status: 400, message: 'status không hợp lệ' };
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (end.getTime() < start.getTime()) {
      throw { status: 400, message: 'endAt phải >= startAt' };
    }

    const event = await ScheduleEvent.create({
      courseId,
      title: String(title),
      type: String(type).toLowerCase(),
      startAt: start,
      endAt: end,
      status: status ? String(status) : undefined,
      description: description ? String(description) : undefined,
      zoomLink: zoomLink ? String(zoomLink) : undefined,
      location: location ? String(location) : undefined,
    });

    return { event };
  }

  /**
   * Create student schedule note/event
   */
  async createStudentNote(userId, noteData) {
    const { title, type, startAt, endAt, status, description, zoomLink, location, courseId } = noteData || {};

    if (!title || !startAt || !endAt) {
      throw { status: 400, message: 'Thiếu dữ liệu bắt buộc: title, startAt, endAt' };
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (end.getTime() < start.getTime()) {
      throw { status: 400, message: 'endAt phải >= startAt' };
    }

    const event = await ScheduleEvent.create({
      courseId: courseId || 1, // Default to course 1 if not provided
      title: String(title),
      type: type ? String(type).toLowerCase() : 'event',
      startAt: start,
      endAt: end,
      status: status ? String(status) : 'upcoming',
      description: description ? String(description) : undefined,
      zoomLink: zoomLink ? String(zoomLink) : undefined,
      location: location ? String(location) : undefined,
    });

    return { event };
  }

  /**
   * Update student schedule note
   */
  async updateStudentNote(eventId, userId, updateData) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      throw { status: 404, message: 'Không tìm thấy ghi chú' };
    }

    // For now, allow update without strict permission check
    // (students can update their own notes - we could add a createdBy field later)
    const { title, type, startAt, endAt, status, description, zoomLink, location } = updateData || {};

    const nextStart = startAt != null ? parseDateTime(startAt) : event.startAt;
    const nextEnd = endAt != null ? parseDateTime(endAt) : event.endAt;
    if (!nextStart || !nextEnd) {
      throw { status: 400, message: 'startAt/endAt không hợp lệ' };
    }
    if (new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
      throw { status: 400, message: 'endAt phải >= startAt' };
    }

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
   * Delete student schedule note
   */
  async deleteStudentNote(eventId, userId) {
    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      throw { status: 404, message: 'Không tìm thấy ghi chú' };
    }

    await event.destroy();
    return { message: 'Xóa ghi chú thành công' };
  }

  /**
   * Format event for response
   */
  formatEvent(event) {
    const startParts = toDateParts(event.startAt);
    const endParts = toDateParts(event.endAt);
    return {
      id: String(event.id),
      courseId: event.courseId ? String(event.courseId) : null,
      courseTitle: event.course?.title || '',
      title: event.title,
      type: event.type,
      status: event.status,
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
}

module.exports = new ScheduleService();
