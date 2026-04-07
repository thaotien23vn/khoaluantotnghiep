const request = require('supertest');
const app = require('../app');
const db = require('../models');
const { loginByRole } = require('./testAuth');

describe('Teacher content CRUD (chapters/lectures)', () => {
  it('should create/update/delete chapter and lecture for a test course', async () => {
    const token = await loginByRole('teacher');

    const uniq = Date.now();
    const courseTitle = `it_seed_teacher_content_course_${uniq}`;

    const createCourseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: courseTitle, description: 'seed', price: 0, published: false });

    expect(createCourseRes.statusCode).toBe(201);
    const courseId = createCourseRes.body?.data?.course?.id;
    expect(courseId).toBeTruthy();

    const createChapterRes = await request(app)
      .post(`/api/teacher/chapters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId, title: `it_seed_chapter_${uniq}`, order: 1 });

    expect(createChapterRes.statusCode).toBe(201);
    const chapterId = createChapterRes.body?.data?.chapter?.id;
    expect(chapterId).toBeTruthy();

    const updateChapterRes = await request(app)
      .put(`/api/teacher/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `it_seed_chapter_${uniq}_updated`, order: 2 });

    expect(updateChapterRes.statusCode).toBe(200);
    expect(updateChapterRes.body).toHaveProperty('success', true);

    const createLectureRes = await request(app)
      .post(`/api/teacher/chapters/${chapterId}/lectures`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', `it_seed_lecture_${uniq}`)
      .field('type', 'video')
      .field('contentUrl', 'https://example.com/video.mp4');

    expect(createLectureRes.statusCode).toBe(201);
    const lectureId = createLectureRes.body?.data?.lecture?.id;
    expect(lectureId).toBeTruthy();

    const updateLectureRes = await request(app)
      .put(`/api/teacher/lectures/${lectureId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', `it_seed_lecture_${uniq}_updated`)
      .field('contentUrl', 'https://example.com/video2.mp4');

    expect(updateLectureRes.statusCode).toBe(200);
    expect(updateLectureRes.body).toHaveProperty('success', true);

    const deleteLectureRes = await request(app)
      .delete(`/api/teacher/lectures/${lectureId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteLectureRes.statusCode).toBe(200);
    expect(deleteLectureRes.body).toHaveProperty('success', true);

    const deleteChapterRes = await request(app)
      .delete(`/api/teacher/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteChapterRes.statusCode).toBe(200);
    expect(deleteChapterRes.body).toHaveProperty('success', true);

    const deleteCourseRes = await request(app)
      .delete(`/api/teacher/courses/${courseId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteCourseRes.statusCode).toBe(200);
    expect(deleteCourseRes.body).toHaveProperty('success', true);

    // best-effort cleanup
    await db.models.Lecture.destroy({ where: { id: lectureId } });
    await db.models.Chapter.destroy({ where: { id: chapterId } });
    await db.models.Course.destroy({ where: { id: courseId } });
  });
});
