const request = require('supertest');
const app = require('../../app');
const db = require('../../models');
const { loginByRole } = require('../testAuth');

describe('Enrollment and Course Access Integration Test', () => {
  let studentToken;
  let teacherToken;
  let adminToken;
  let testCourse;
  let testChapter;
  let testLecture;
  const createdCourseIds = [];
  const createdChapterIds = [];
  const createdLectureIds = [];

  beforeAll(async () => {
    studentToken = await loginByRole('student');
    teacherToken = await loginByRole('teacher');
    adminToken = await loginByRole('admin');

    // 1. Teacher creates a course
    const courseRes = await request(app)
      .post('/api/teacher/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Access Test Course',
        description: 'Testing enrollment access',
        price: 0
      });
    expect(courseRes.statusCode).toBe(201);
    testCourse = courseRes.body.data.course;
    createdCourseIds.push(testCourse.id);

    // Publish the course
    const publishRes = await request(app)
      .put(`/api/teacher/courses/${testCourse.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ published: true });
    expect(publishRes.statusCode).toBe(200);

    // 2. Teacher adds a chapter
    const chapterRes = await request(app)
      .post(`/api/teacher/chapters`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ courseId: testCourse.id, title: 'Chapter 1', order: 1 });
    expect(chapterRes.statusCode).toBe(201);
    testChapter = chapterRes.body.data.chapter;
    createdChapterIds.push(testChapter.id);

    // 3. Teacher adds a lecture
    const lectureRes = await request(app)
      .post(`/api/teacher/chapters/${testChapter.id}/lectures`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Lecture 1', content: 'Secret content', type: 'text', order: 1 });
    expect(lectureRes.statusCode).toBe(201);
    testLecture = lectureRes.body.data.lecture;
    createdLectureIds.push(testLecture.id);

    // Ensure enrollment exists for deterministic assertions.
    const enrollRes = await request(app)
      .post(`/api/student/enroll/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect([201, 409]).toContain(enrollRes.statusCode);
  });

  afterAll(async () => {
    const { Enrollment, Lecture, Chapter, Course } = db.models;
    await Enrollment.destroy({ where: { courseId: createdCourseIds } });
    await Lecture.destroy({ where: { id: createdLectureIds } });
    await Chapter.destroy({ where: { id: createdChapterIds } });
    await Course.destroy({ where: { id: createdCourseIds } });
  });

  it('should allow access to course detail after enrollment', async () => {
    const res = await request(app)
      .get(`/api/courses/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    
    // Course detail includes curriculum with chapters/lectures
    const courseData = res.body.data.course || res.body.data;

    const curriculum = courseData.curriculum || [];
    expect(curriculum.length).toBeGreaterThan(0);
    
    // Check that curriculum has the lecture
    const firstItem = curriculum[0];
    expect(firstItem.title).toBeDefined();
    
    // Curriculum can contain either chapters or lectures directly
    // Check for any lessons/lectures in the curriculum
    const hasContent = curriculum.some(item => 
      item.lectures?.length > 0 || 
      item.Lectures?.length > 0 ||
      item.lessons?.length > 0 ||
      item.type === 'lecture' ||
      item.content
    );
    expect(hasContent).toBe(true);
  });

  it('should track progress when student updates progress', async () => {
    const progressRes = await request(app)
      .put(`/api/student/progress/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ progressPercent: 50 });

    expect(progressRes.statusCode).toBe(200);
    expect(progressRes.body.success).toBe(true);

    // Verify progress
    const enrollRes = await request(app)
      .get(`/api/student/enrollments/course/${testCourse.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    
    expect(enrollRes.body.data.enrollment.progressPercent).toBe(50);
  });
});
