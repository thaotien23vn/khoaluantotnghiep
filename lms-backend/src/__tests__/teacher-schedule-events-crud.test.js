const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

describe('Teacher schedule-events CRUD (safe)', () => {
  it('should create, list, update, and delete schedule event for a test course', async () => {
    const token = await loginByRole('teacher');

    const uniq = Date.now();
    const courseTitle = `it_seed_teacher_schedule_course_${uniq}`;

    const createCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: courseTitle, description: 'seed', price: 0, published: true });

    expect(createCourseRes.statusCode).toBe(201);
    const courseId = createCourseRes.body?.data?.course?.id;
    expect(courseId).toBeTruthy();

    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const endAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const createRes = await request(app)
      .post(`/api/teacher/courses/${courseId}/schedule-events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `it_seed_event_${uniq}`,
        type: 'lesson',
        startAt,
        endAt,
        status: 'upcoming',
      });

    expect([200, 201]).toContain(createRes.statusCode);
    expect(createRes.body).toHaveProperty('success', true);

    const eventId = createRes.body?.data?.event?.id || createRes.body?.data?.scheduleEvent?.id;
    expect(eventId).toBeTruthy();

    const listRes = await request(app)
      .get(`/api/teacher/courses/${courseId}/schedule-events`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body).toHaveProperty('success', true);

    const updateRes = await request(app)
      .put(`/api/teacher/schedule-events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `it_seed_event_${uniq}_updated` });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('success', true);

    const deleteRes = await request(app)
      .delete(`/api/teacher/schedule-events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body).toHaveProperty('success', true);

    const deleteCourseRes = await request(app)
      .delete(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteCourseRes.statusCode).toBe(200);

    await db.models.ScheduleEvent.destroy({ where: { id: eventId } });
    await db.models.Course.destroy({ where: { id: courseId } });
  });
});
