/**
 * @jest-environment node
 *
 * Unit tests for Course Service - Duration Fields
 */

const courseService = require('../modules/course/course.service');
const { models } = require('../models');
const { Course, User, Category, Chapter, Lecture, Enrollment } = models;

describe('Course Service - Duration Fields', () => {
  
  describe('createCourse', () => {
    test('should save and return all duration fields', async () => {
      const mockCourseData = {
        title: 'Test Course',
        description: 'Test description',
        categoryId: 1,
        level: 'beginner',
        price: 100000,
        durationType: 'fixed',
        durationValue: 6,
        durationUnit: 'months',
        renewalDiscountPercent: 20,
        gracePeriodDays: 7,
        createdBy: 1,
      };

      // Mock Course.findOne for generateUniqueSlug
      jest.spyOn(Course, 'findOne').mockResolvedValue(null);
      
      // Mock Course.create
      const mockCreatedCourse = {
        id: 1,
        ...mockCourseData,
        toJSON: () => ({ id: 1, ...mockCourseData }),
      };
      
      jest.spyOn(Course, 'create').mockResolvedValue(mockCreatedCourse);

      const result = await courseService.createCourse(
        1, // userId
        'teacher', // userRole
        { name: 'Test', username: 'test', role: 'teacher' }, // userInfo
        mockCourseData
      );

      // Verify duration fields in response
      expect(result.course.durationType).toBe('fixed');
      expect(result.course.durationValue).toBe(6);
      expect(result.course.durationUnit).toBe('months');
      expect(result.course.renewalDiscountPercent).toBe(20);
      expect(result.course.gracePeriodDays).toBe(7);
    });
  });

  describe('updateCourse', () => {
    test('should update duration fields correctly', async () => {
      const courseId = 1;
      const updateData = {
        durationType: 'subscription',
        durationValue: 12,
        durationUnit: 'months',
        renewalDiscountPercent: 30,
        gracePeriodDays: 14,
      };

      // Mock findByPk
      const mockCourse = {
        id: courseId,
        createdBy: 1,
        update: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: courseId, ...updateData, createdBy: 1 }),
      };
      
      jest.spyOn(Course, 'findByPk').mockResolvedValue(mockCourse);
      
      // Mock findOne for slug check
      jest.spyOn(Course, 'findOne').mockResolvedValue(null);

      const result = await courseService.updateCourse(
        courseId,
        1, // userId
        'teacher', // userRole
        updateData
      );

      // Verify save was called (updateCourse uses .save() not .update())
      expect(mockCourse.save).toHaveBeenCalled();
      
      // Verify duration fields were set on course object
      expect(mockCourse.durationType).toBe('subscription');
      expect(mockCourse.durationValue).toBe(12);
      expect(mockCourse.durationUnit).toBe('months');
      expect(mockCourse.renewalDiscountPercent).toBe(30);
      expect(mockCourse.gracePeriodDays).toBe(14);
    });
  });

  describe('getCourseContentForOwner', () => {
    test('should return course with duration fields', async () => {
      const courseId = 1;
      const userId = 1;
      const role = 'teacher';

      // Mock course with duration fields and owner
      const mockCourse = {
        id: courseId,
        title: 'Test Course',
        createdBy: userId, // Same as requesting user
        durationType: 'fixed',
        durationValue: 6,
        durationUnit: 'months',
        renewalDiscountPercent: 20,
        gracePeriodDays: 7,
      };

      jest.spyOn(Course, 'findByPk').mockResolvedValue({
        ...mockCourse,
        toJSON: () => mockCourse,
      });

      // Mock chapters
      jest.spyOn(Chapter, 'findAll').mockResolvedValue([]);

      const result = await courseService.getCourseContentForOwner(courseId, userId, role);

      // Verify duration fields in response
      expect(result.course.durationType).toBe('fixed');
      expect(result.course.durationValue).toBe(6);
      expect(result.course.durationUnit).toBe('months');
      expect(result.course.renewalDiscountPercent).toBe(20);
      expect(result.course.gracePeriodDays).toBe(7);
    });
  });

  describe('getEnrolledCourseContent', () => {
    test('should return full content with duration for enrolled student', async () => {
      const courseId = 1;
      const userId = 2;

      // Mock enrollment check
      const mockEnrollment = {
        id: 1,
        courseId: 1,
        userId: 2,
        status: 'active',
        progressPercent: 0,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        enrollmentStatus: 'active',
      };

      jest.spyOn(Enrollment, 'findOne').mockResolvedValue(mockEnrollment);

      // Mock course with duration
      const mockCourse = {
        id: courseId,
        title: 'Test Course',
        description: 'Test',
        imageUrl: '/test.jpg',
        level: 'Cơ bản',
        price: 100000,
        durationType: 'fixed',
        durationValue: 6,
        durationUnit: 'months',
        renewalDiscountPercent: 20,
        gracePeriodDays: 7,
      };

      jest.spyOn(Course, 'findByPk').mockResolvedValue(mockCourse);

      // Mock chapters with lectures
      const mockChapters = [
        {
          id: 1,
          title: 'Chapter 1',
          order: 1,
          get: jest.fn().mockReturnValue({
            id: 1,
            title: 'Chapter 1',
            order: 1,
            lectures: [
              {
                id: 1,
                title: 'Lecture 1',
                contentUrl: 'https://video.com/1.mp4',
                type: 'video',
                duration: 600,
                isPreview: false,
                attachments: null,
              },
            ],
          }),
        },
      ];

      jest.spyOn(Chapter, 'findAll').mockResolvedValue(mockChapters);

      const result = await courseService.getEnrolledCourseContent(courseId, userId);

      // Verify response structure
      expect(result.course).toBeDefined();
      expect(result.course.durationType).toBe('fixed');
      expect(result.course.durationValue).toBe(6);
      expect(result.chapters).toBeDefined();
      expect(result.enrollment).toBeDefined();
      expect(result.enrollment.status).toBe('active');

      // Verify lecture has videoUrl
      const lecture = result.chapters[0].lectures[0];
      expect(lecture.videoUrl).toBe('https://video.com/1.mp4');
    });

    test('should reject non-enrolled student', async () => {
      const courseId = 1;
      const userId = 3;

      // Mock no enrollment found
      jest.spyOn(Enrollment, 'findOne').mockResolvedValue(null);

      await expect(
        courseService.getEnrolledCourseContent(courseId, userId)
      ).rejects.toMatchObject({
        status: 403,
        message: 'Bạn chưa ghi danh vào khóa học này',
      });
    });
  });
});
