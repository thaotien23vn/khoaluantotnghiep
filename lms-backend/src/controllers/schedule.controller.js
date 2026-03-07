const db = require('../models');
const { Op } = require('sequelize');

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

const TYPE_PRIORITY = {
  exam: 1,
  assignment: 2,
  live: 3,
  lesson: 4,
};

const getTypePriority = (type) => TYPE_PRIORITY[String(type || '').toLowerCase()] ?? 999;

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

    const limitRaw = normalizeLimitOffset(req.query.limit, 100);
    const offsetRaw = normalizeLimitOffset(req.query.offset, 0);
    const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)));
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

    if (from || to) {
      const startAt = {};
      if (from) startAt[Op.gte] = from;
      if (to) {
        const endOfDay = new Date(to);
        endOfDay.setUTCHours(23, 59, 59, 999);
        startAt[Op.lte] = endOfDay;
      }
      where.startAt = startAt;
    } else if (month != null && year != null) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      where.startAt = { [Op.gte]: start, [Op.lte]: end };
    } else if (year != null && month == null) {
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      where.startAt = { [Op.gte]: start, [Op.lte]: end };
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
      order: [['startAt', 'ASC']],
      limit,
      offset,
    });

    const schedule = events
      .map((event) => {
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
      })
      .sort((a, b) => {
        const pA = getTypePriority(a.type);
        const pB = getTypePriority(b.type);
        if (pA !== pB) return pA - pB;
        const tA = new Date(a.startAt).getTime();
        const tB = new Date(b.startAt).getTime();
        return tA - tB;
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

const isValidEventType = (value) => ['exam', 'assignment', 'live', 'lesson'].includes(String(value || '').toLowerCase());

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
