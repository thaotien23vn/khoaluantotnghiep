const db = require('../models');
const { Op, literal } = require('sequelize');

const { Enrollment, Course, ScheduleEvent } = db.models;

const normalizeMonthYear = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
};

const normalizeLimitOffset = (value, fallback) => {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const normalizePage = (value, fallback) => {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

const parseDateOnly = (value) => {
  if (value == null || value === '') return null;
  const str = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const pad2 = (n) => String(n).padStart(2, '0');

const toDateParts = (dt) => {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
};

const TYPE_ORDER_SQL = "CASE type WHEN 'exam' THEN 1 WHEN 'assignment' THEN 2 WHEN 'live' THEN 3 WHEN 'lesson' THEN 4 ELSE 999 END";

const isValidEventType = (value) => ['exam', 'assignment', 'live', 'lesson'].includes(String(value || '').toLowerCase());

const isValidEventStatus = (value) => ['upcoming', 'completed', 'missed', 'ongoing'].includes(String(value || '').toLowerCase());

const parseDateTime = (value) => {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

/**
 * GET /api/student/schedule
 * Query:
 * - month: 1-12
 * - year: 4-digit year
 */
exports.getMySchedule = async (req, res) => {
  try {
    const userId = req.user?.id;

    const month = normalizeMonthYear(req.query.month);
    const year = normalizeMonthYear(req.query.year);
    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);

    const type = req.query.type != null ? String(req.query.type) : null;
    const status = req.query.status != null ? String(req.query.status) : null;
    const courseIdFilter = req.query.courseId != null ? Number(req.query.courseId) : null;

    const pageRaw = normalizePage(req.query.page, null);
    const pageSizeRaw = normalizePage(req.query.pageSize, null);

    const limitRaw = normalizeLimitOffset(req.query.limit, pageSizeRaw != null ? pageSizeRaw : 100);
    const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)));

    const offsetRaw = normalizeLimitOffset(
      req.query.offset,
      pageRaw != null ? Math.max(0, Math.floor(pageRaw) - 1) * limit : 0,
    );
    const offset = Math.max(0, Math.floor(offsetRaw));

    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    if (courseIds.length === 0) {
      return res.json({
        success: true,
        message: 'Lịch học của bạn',
        data: {
          schedule: [],
          meta: { total: 0, limit, offset },
        },
      });
    }

    if (courseIdFilter != null && !courseIds.includes(courseIdFilter)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch học của khóa học này',
      });
    }

    const where = {
      courseId: courseIdFilter != null ? courseIdFilter : { [Op.in]: courseIds },
    };
    if (type) where.type = type;
    if (status) where.status = status;

    const overlapWhere = [];
    if (from || to) {
      const rangeStart = from ? new Date(from) : null;
      const rangeEnd = to ? (() => {
        const endOfDay = new Date(to);
        endOfDay.setUTCHours(23, 59, 59, 999);
        return endOfDay;
      })() : null;

      if (rangeStart) overlapWhere.push({ endAt: { [Op.gte]: rangeStart } });
      if (rangeEnd) overlapWhere.push({ startAt: { [Op.lte]: rangeEnd } });
    } else if (month != null && year != null) {
      const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const rangeEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      overlapWhere.push({ endAt: { [Op.gte]: rangeStart } });
      overlapWhere.push({ startAt: { [Op.lte]: rangeEnd } });
    } else if (year != null && month == null) {
      const rangeStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const rangeEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      overlapWhere.push({ endAt: { [Op.gte]: rangeStart } });
      overlapWhere.push({ startAt: { [Op.lte]: rangeEnd } });
    }

    if (overlapWhere.length > 0) {
      where[Op.and] = overlapWhere;
    }

    const total = await ScheduleEvent.count({ where });
    const events = await ScheduleEvent.findAll({
      where,
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title'],
        },
      ],
      order: [[literal(TYPE_ORDER_SQL), 'ASC'], ['startAt', 'ASC']],
      limit,
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

    res.json({
      success: true,
      message: 'Lịch học của bạn',
      data: {
        schedule,
        meta: { total, limit, offset },
      },
    });
  } catch (error) {
    console.error('Lỗi lấy lịch học:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

exports.getNextScheduleEvent = async (req, res) => {
  try {
    const userId = req.user?.id;

    const enrollments = await Enrollment.findAll({
      where: { userId },
      attributes: ['courseId'],
    });
    const courseIds = enrollments.map((e) => Number(e.courseId)).filter((id) => Number.isFinite(id));

    if (courseIds.length === 0) {
      return res.json({
        success: true,
        message: 'Sự kiện sắp tới',
        data: { event: null },
      });
    }

    const now = new Date();
    const event = await ScheduleEvent.findOne({
      where: {
        courseId: { [Op.in]: courseIds },
        startAt: { [Op.gte]: now },
        status: { [Op.in]: ['upcoming', 'ongoing'] },
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title'],
        },
      ],
      order: [[literal(TYPE_ORDER_SQL), 'ASC'], ['startAt', 'ASC']],
    });

    if (!event) {
      return res.json({
        success: true,
        message: 'Sự kiện sắp tới',
        data: { event: null },
      });
    }

    const startParts = toDateParts(event.startAt);
    const endParts = toDateParts(event.endAt);

    res.json({
      success: true,
      message: 'Sự kiện sắp tới',
      data: {
        event: {
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
        },
      },
    });
  } catch (error) {
    console.error('Lỗi lấy sự kiện sắp tới:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: error.message,
    });
  }
};

exports.updateScheduleEvent = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ success: false, message: 'eventId không hợp lệ' });
    }

    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }

    if (req.user?.role !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập khóa học này' });
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = req.body || {};

    if (type != null && !isValidEventType(type)) {
      return res.status(400).json({ success: false, message: 'type không hợp lệ' });
    }
    if (status != null && !isValidEventStatus(status)) {
      return res.status(400).json({ success: false, message: 'status không hợp lệ' });
    }

    const nextStart = startAt != null ? parseDateTime(startAt) : event.startAt;
    const nextEnd = endAt != null ? parseDateTime(endAt) : event.endAt;
    if (!nextStart || !nextEnd) {
      return res.status(400).json({ success: false, message: 'startAt/endAt không hợp lệ' });
    }
    if (new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
      return res.status(400).json({ success: false, message: 'endAt phải >= startAt' });
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

    res.json({
      success: true,
      message: 'Cập nhật lịch học thành công',
      data: { event },
    });
  } catch (error) {
    console.error('Lỗi cập nhật schedule event:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

exports.deleteScheduleEvent = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ success: false, message: 'eventId không hợp lệ' });
    }

    const event = await ScheduleEvent.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch học' });
    }

    const course = await Course.findByPk(event.courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }

    if (req.user?.role !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập khóa học này' });
    }

    await event.destroy();
    res.json({ success: true, message: 'Xóa lịch học thành công' });
  } catch (error) {
    console.error('Lỗi xóa schedule event:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

/**
 * GET /api/teacher/courses/:courseId/schedule-events
 * List schedule events for a course (teacher's own course or any for admin).
 */
exports.listCourseScheduleEvents = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ success: false, message: 'courseId không hợp lệ' });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }

    if (req.user?.role !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập khóa học này' });
    }

    const events = await ScheduleEvent.findAll({
      where: { courseId },
      order: [['startAt', 'ASC']],
    });

    res.json({
      success: true,
      message: 'Danh sách lịch học của khóa học',
      data: { events },
    });
  } catch (error) {
    console.error('Lỗi lấy schedule events:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

/**
 * POST /api/teacher/courses/:courseId/schedule-events
 * Create schedule event for a course (teacher's own course or any for admin).
 */
exports.createCourseScheduleEvent = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ success: false, message: 'courseId không hợp lệ' });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }

    if (req.user?.role !== 'admin' && course.createdBy && Number(course.createdBy) !== Number(req.user?.id)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập khóa học này' });
    }

    const { title, type, startAt, endAt, status, description, zoomLink, location } = req.body || {};

    if (!title || !type || !startAt || !endAt) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu dữ liệu bắt buộc: title, type, startAt, endAt',
      });
    }
    if (!isValidEventType(type)) {
      return res.status(400).json({ success: false, message: 'type không hợp lệ' });
    }

    if (status != null && !isValidEventStatus(status)) {
      return res.status(400).json({ success: false, message: 'status không hợp lệ' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'startAt/endAt không hợp lệ' });
    }
    if (end.getTime() < start.getTime()) {
      return res.status(400).json({ success: false, message: 'endAt phải >= startAt' });
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

    res.status(201).json({
      success: true,
      message: 'Tạo lịch học thành công',
      data: { event },
    });
  } catch (error) {
    console.error('Lỗi tạo schedule event:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};
