const db = require('../models');
const aiGateway = require('./aiGateway.service');
const aiPersonalization = require('./aiPersonalization.service');
const logger = require('../utils/logger');

const {
  UserLearningProfile,
  LearningAnalytics,
  AiRecommendation,
  Course,
  Chapter,
  Lecture,
  Quiz,
  Attempt,
  Enrollment,
} = db.models;

class AiLearningPathService {
  /**
   * Generate personalized learning path for user
   */
  async generateLearningPath(userId, courseId, options = {}) {
    try {
      // Get user's profile and progress - create if not exists
      let profile = await UserLearningProfile.findOne({
        where: { userId, courseId },
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'description'],
          },
        ],
      });

      // Auto-create profile if not exists
      if (!profile) {
        const course = await Course.findByPk(courseId, {
          attributes: ['id', 'title', 'description'],
        });
        
        if (!course) {
          throw {
            status: 404,
            message: 'Không tìm thấy khóa học',
            code: 'COURSE_NOT_FOUND',
          };
        }

        // Get course structure to count total lectures
        const chapters = await Chapter.findAll({
          where: { courseId },
          include: [{ model: Lecture, attributes: ['id'] }],
        });
        const totalLectures = chapters.reduce((sum, ch) => sum + (ch.lectures?.length || 0), 0);

        profile = await UserLearningProfile.create({
          userId,
          courseId,
          learningStyle: 'visual', // Default to visual instead of invalid 'adaptive'
          difficultyPreference: 'adaptive',
          averageScore: 0,
          completedLectures: 0,
          totalLectures: totalLectures || 0,
          weakTopics: [],
          strongTopics: [],
          totalStudyTime: 0,
          quizzesTaken: 0,
          averageQuizScore: 0,
        });

        // Reload with course association
        profile = await UserLearningProfile.findOne({
          where: { userId, courseId },
          include: [
            {
              model: Course,
              as: 'course',
              attributes: ['id', 'title', 'description'],
            },
          ],
        });
      }

      // Get course structure
      const courseStructure = await this.getCourseStructure(courseId);

      // Get user's current progress
      const progress = await this.getUserProgress(userId, courseId);

      // Get user's weak areas for prioritization
      const weakAreas = profile.weakTopics || [];

      // Generate the learning path
      const learningPath = await this.buildLearningPath({
        userId,
        courseId,
        profile,
        courseStructure,
        progress,
        weakAreas,
        options,
      });

      // Create AI recommendation for the learning path
      const recommendation = await this.createLearningPathRecommendation(
        userId,
        courseId,
        learningPath
      );

      return {
        learningPath,
        recommendation,
        profile: {
          learningStyle: 'visual', // Default to visual
          difficultyPreference: profile.difficultyPreference,
          averageScore: profile.averageScore,
          completedLectures: profile.completedLectures,
          totalLectures: profile.totalLectures,
        },
      };
    } catch (error) {
      logger.error('LEARNING_PATH_GENERATION_FAILED', {
        userId,
        courseId,
        options,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw {
        status: 500,
        message: 'Không thể tạo learning path: ' + error.message,
        code: 'LEARNING_PATH_GENERATION_FAILED',
      };
    }
  }

  /**
   * Get course structure with chapters and lectures
   */
  async getCourseStructure(courseId) {
    try {
      const chapters = await Chapter.findAll({
        where: { courseId },
        order: [['order', 'ASC']],
        include: [
          {
            model: Lecture,
            as: 'lectures',
            order: [['order', 'ASC']],
          },
        ],
      });

      return chapters.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        order: chapter.order,
        lectures: chapter.lectures?.map(lecture => ({
          id: lecture.id,
          title: lecture.title,
          order: lecture.order,
          estimatedDuration: lecture.duration || 30,
          difficulty: this.estimateLectureDifficulty(lecture),
        })),
      }));
    } catch (error) {
      logger.error('GET_COURSE_STRUCTURE_FAILED', {
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy course structure',
        code: 'GET_COURSE_STRUCTURE_FAILED',
      };
    }
  }

  /**
   * Estimate lecture difficulty based on content
   */
  estimateLectureDifficulty(lecture) {
    // This could be enhanced with AI analysis
    // For now, use simple heuristics
    const content = lecture.content || lecture.aiNotes || '';
    const wordCount = content.split(' ').length;
    
    if (wordCount < 500) return 'easy';
    if (wordCount > 2000) return 'hard';
    return 'medium';
  }

  /**
   * Get user progress
   */
  async getUserProgress(userId, courseId) {
    try {
      // Get completed lectures
      const completedLectures = await LearningAnalytics.findAll({
        where: {
          userId,
          courseId,
          eventType: 'lecture_complete',
        },
        attributes: ['lectureId', 'createdAt', 'duration'],
      });

      // Get quiz scores
      const quizResults = await LearningAnalytics.findAll({
        where: {
          userId,
          courseId,
          eventType: 'quiz_complete',
        },
        attributes: ['lectureId', 'score', 'maxScore', 'attempts'],
      });

      // Calculate performance by topic
      const completedLectureIds = completedLectures.map(l => l.lectureId);
      const averageScore = quizResults.length > 0
        ? quizResults.reduce((sum, q) => sum + (q.score / q.maxScore) * 100, 0) / quizResults.length
        : null;

      return {
        completedLectures: completedLectureIds,
        completedLectureDetails: completedLectures,
        quizResults,
        averageScore,
        lastActivity: completedLectures.length > 0
          ? completedLectures.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt
          : null,
      };
    } catch (error) {
      logger.error('GET_USER_PROGRESS_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy user progress',
        code: 'GET_USER_PROGRESS_FAILED',
      };
    }
  }

  /**
   * Build personalized learning path
   */
  async buildLearningPath(data) {
    const {
      userId,
      courseId,
      profile,
      courseStructure,
      progress,
      weakAreas,
      options,
    } = data;

    const {
      preferredStudyTime = profile.preferredStudyTime || 'morning',
      learningStyle = profile.learningStyle || 'visual',
      timeAvailable = 60, // minutes per day
      pace = profile.difficultyPreference === 'adaptive' ? 'adaptive' : 'steady',
    } = options;

    const learningPath = {
      userId,
      courseId,
      totalDuration: 0,
      stages: [],
      recommendations: [],
      milestones: [],
    };

    let currentStage = 1;
    let accumulatedTime = 0;

    // Build stages based on course structure
    for (const chapter of courseStructure) {
      const chapterLectures = (chapter.lectures || []);

      if (chapterLectures.length === 0) continue;

      const stage = {
        stage: currentStage,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        estimatedDuration: 0,
        items: [],
        focusAreas: [],
      };

      // Sort lectures based on weak areas and dependencies
      const sortedLectures = this.sortLecturesByPriority(
        chapterLectures,
        weakAreas,
        learningStyle,
        pace
      );

      for (const lecture of sortedLectures) {
        const isCompleted = progress.completedLectures.includes(lecture.id);
        const item = this.createLearningPathItem(lecture, learningStyle, weakAreas);
        item.status = isCompleted ? 'completed' : 'pending';
        
        stage.items.push(item);
        stage.estimatedDuration += lecture.estimatedDuration;
        accumulatedTime += lecture.estimatedDuration;

        // Add practice recommendations for weak areas
        if (weakAreas.some(area => 
          lecture.title.toLowerCase().includes(area.toLowerCase()) ||
          item.topics.some(topic => topic.toLowerCase().includes(area.toLowerCase()))
        )) {
          stage.focusAreas.push({
            lectureId: lecture.id,
            lectureTitle: lecture.title,
            reason: 'Focus area - identified as weak topic',
            recommendedPractice: ['quiz', 'exercise'],
          });
        }

        // Create milestone every ~180 minutes (3 hours)
        if (accumulatedTime >= 180) {
          learningPath.milestones.push({
            name: `Milestone ${learningPath.milestones.length + 1}`,
            lectureId: lecture.id,
            cumulativeDuration: accumulatedTime,
            checkpoint: {
              type: 'quiz',
              description: `Assessment checkpoint after ${Math.round(accumulatedTime / 60)} hours of study`,
            },
          });
          accumulatedTime = 0;
        }
      }

      if (stage.items.length > 0) {
        learningPath.stages.push(stage);
        learningPath.totalDuration += stage.estimatedDuration;
        currentStage++;
      }
    }

    // Add overall recommendations
    learningPath.recommendations = await this.generatePathRecommendations({
      profile,
      progress,
      weakAreas,
      timeAvailable,
      learningStyle,
      totalDuration: learningPath.totalDuration,
    });

    return learningPath;
  }

  /**
   * Sort lectures by priority
   */
  sortLecturesByPriority(lectures, weakAreas, learningStyle, pace) {
    return lectures.sort((a, b) => {
      // Priority 1: Weak areas
      const aIsWeak = weakAreas.some(area => 
        a.title.toLowerCase().includes(area.toLowerCase())
      );
      const bIsWeak = weakAreas.some(area => 
        b.title.toLowerCase().includes(area.toLowerCase())
      );

      if (aIsWeak && !bIsWeak) return -1;
      if (!aIsWeak && bIsWeak) return 1;

      // Priority 2: Order
      return a.order - b.order;
    });
  }

  /**
   * Create learning path item
   */
  createLearningPathItem(lecture, learningStyle, weakAreas) {
    const isFocusArea = weakAreas.some(area => 
      lecture.title.toLowerCase().includes(area.toLowerCase())
    );

    return {
      lectureId: lecture.id,
      title: lecture.title,
      estimatedDuration: lecture.estimatedDuration,
      difficulty: lecture.difficulty,
      type: 'lecture',
      learningStyle: this.getLearningStyleRecommendations(learningStyle, lecture),
      isFocusArea,
      recommendedNext: isFocusArea ? ['practice', 'quiz'] : ['next_lecture'],
      topics: [], // Could be filled with AI analysis
    };
  }

  /**
   * Get learning style recommendations
   */
  getLearningStyleRecommendations(learningStyle, lecture) {
    const recommendations = {
      visual: {
        tips: ['Use diagrams and flowcharts', 'Watch video content', 'Take visual notes'],
        resources: ['diagrams', 'videos', 'infographics'],
      },
      auditory: {
        tips: ['Listen to lectures multiple times', 'Discuss with peers', 'Record your explanations'],
        resources: ['audio_content', 'discussion_forums', 'recordings'],
      },
      kinesthetic: {
        tips: ['Practice hands-on exercises', 'Build projects', 'Take frequent breaks'],
        resources: ['practical_exercises', 'projects', 'interactive_content'],
      },
      reading: {
        tips: ['Read lecture notes carefully', 'Take detailed written notes', 'Read additional resources'],
        resources: ['text_content', 'notes', 'reading_materials'],
      },
      mixed: {
        tips: ['Combine different learning methods', 'Alternate between reading and practice'],
        resources: ['mixed_content', 'varied_resources'],
      },
    };

    return recommendations[learningStyle] || recommendations.mixed;
  }

  /**
   * Generate path recommendations
   */
  async generatePathRecommendations(data) {
    const {
      profile,
      progress,
      weakAreas,
      timeAvailable,
      learningStyle,
      totalDuration,
    } = data;

    const recommendations = [];

    // Study schedule recommendation
    const daysNeeded = Math.ceil(totalDuration / timeAvailable);
    const weeksNeeded = Math.ceil(daysNeeded / 5); // Assuming 5 study days per week

    recommendations.push({
      type: 'schedule',
      title: 'Đề xuất lịch học',
      description: `Hoàn thành trong ${weeksNeeded} tuần với ${Math.ceil(timeAvailable / 60)} giờ/ngày`,
      details: {
        totalDuration,
        dailyStudyTime: timeAvailable,
        daysNeeded,
        weeksNeeded,
        suggestedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      },
    });

    // Learning style recommendation
    if (learningStyle !== 'mixed') {
      recommendations.push({
        type: 'learning_style',
        title: 'Tối ưu cho phong cách học của bạn',
        description: `Điều chỉnh nội dung cho phong cách ${learningStyle}`,
        suggestions: this.getLearningStyleRecommendations(learningStyle, {}),
      });
    }

    // Weak areas recommendation
    if (weakAreas.length > 0) {
      recommendations.push({
        type: 'remediation',
        title: 'Tập trung vào điểm yếu',
        description: 'Ưu tiên các topic cần cải thiện',
        areas: weakAreas,
        suggestedPractice: ['extra_quizzes', 'additional_reading', 'peer_discussion'],
      });
    }

    // Difficulty adjustment
    if (profile.difficultyPreference === 'adaptive') {
      const avgScore = progress.averageScore;
      if (avgScore !== null) {
        let suggestedLevel = 'medium';
        if (avgScore < 60) suggestedLevel = 'beginner';
        if (avgScore > 85) suggestedLevel = 'advanced';

        recommendations.push({
          type: 'difficulty_adjustment',
          title: 'Điều chỉnh độ khó',
          description: `Dựa trên performance hiện tại (${avgScore.toFixed(1)}%), đề xuất level: ${suggestedLevel}`,
          currentLevel: profile.difficultyPreference,
          suggestedLevel,
        });
      }
    }

    return recommendations;
  }

  /**
   * Create learning path recommendation
   */
  async createLearningPathRecommendation(userId, courseId, learningPath) {
    try {
      const recommendation = await AiRecommendation.create({
        userId,
        courseId,
        type: 'study_path',
        title: 'Lộ trình học tập cá nhân hóa',
        description: `Lộ trình ${learningPath.stages.length} giai đoạn, tổng thời gian ${Math.round(learningPath.totalDuration / 60)} giờ`,
        priority: 'high',
        score: 9.0,
        reason: 'Generated based on learning profile and progress',
        metadata: {
          stages: learningPath.stages.length,
          totalDuration: learningPath.totalDuration,
          milestones: learningPath.milestones.length,
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      return recommendation;
    } catch (error) {
      logger.error('CREATE_LEARNING_PATH_RECOMMENDATION_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      // Non-critical, return null if fails
      return null;
    }
  }

  /**
   * Get user's current learning path
   */
  async getUserLearningPath(userId, courseId) {
    try {
      // Check if there's an active recommendation
      const activePath = await AiRecommendation.findOne({
        where: {
          userId,
          courseId,
          type: 'study_path',
          status: 'pending',
        },
        order: [['createdAt', 'DESC']],
      });

      if (!activePath) {
        // Generate new path
        return this.generateLearningPath(userId, courseId);
      }

      // Return existing path with current progress
      const currentProgress = await this.getUserProgress(userId, courseId);
      
      return {
        learningPath: activePath.metadata,
        recommendation: activePath,
        currentProgress,
      };
    } catch (error) {
      logger.error('GET_USER_LEARNING_PATH_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể lấy learning path',
        code: 'GET_USER_LEARNING_PATH_FAILED',
      };
    }
  }

  /**
   * Analyze knowledge gaps
   */
  async analyzeKnowledgeGaps(userId, courseId) {
    try {
      // Get quiz results
      const quizResults = await LearningAnalytics.findAll({
        where: {
          userId,
          courseId,
          eventType: 'quiz_complete',
        },
        include: [
          {
            model: Lecture,
            as: 'lecture',
            attributes: ['id', 'title'],
          },
        ],
      });

      // Identify gaps (scores < 60%)
      const gaps = quizResults
        .filter(result => (result.score / result.maxScore) * 100 < 60)
        .map(result => ({
          lectureId: result.lectureId,
          lectureTitle: result.lecture?.title || 'Unknown',
          score: (result.score / result.maxScore) * 100,
          attempts: result.attempts,
          gap: true,
        }));

      // Group by topic if possible
      const topics = gaps.map(gap => ({
        topic: gap.lectureTitle,
        lectures: [gap.lectureId],
        averageScore: gap.score,
        recommendation: 'Review and practice',
      }));

      return {
        gaps,
        topics,
        totalWeakAreas: gaps.length,
        averageScore: quizResults.length > 0
          ? quizResults.reduce((sum, q) => sum + (q.score / q.maxScore) * 100, 0) / quizResults.length
          : null,
      };
    } catch (error) {
      logger.error('ANALYZE_KNOWLEDGE_GAPS_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể phân tích knowledge gaps',
        code: 'ANALYZE_KNOWLEDGE_GAPS_FAILED',
      };
    }
  }

  /**
   * Generate practice quiz for knowledge gaps
   */
  async generateGapRemediationQuiz(userId, courseId, topic) {
    try {
      // Find lectures related to this topic
      const relatedLectures = await Lecture.findAll({
        include: [
          {
            model: Chapter,
            as: 'chapter',
            where: { courseId },
          },
        ],
        where: {
          title: {
            [db.Sequelize.Op.like]: `%${topic}%`,
          },
        },
        limit: 3,
      });

      if (relatedLectures.length === 0) {
        throw {
          status: 404,
          message: 'No lectures found for this topic',
          code: 'LECTURES_NOT_FOUND',
        };
      }

      // Generate practice questions
      const practiceQuestions = [];
      for (const lecture of relatedLectures) {
        const questions = await aiPersonalization.generatePracticeQuestions(
          lecture.id,
          { focusTopic: topic, difficulty: 'remediation' }
        );
        practiceQuestions.push(...questions);
      }

      return {
        topic,
        questions: practiceQuestions.slice(0, 10), // Limit to 10 questions
        relatedLectures: relatedLectures.map(l => ({
          id: l.id,
          title: l.title,
        })),
        recommendations: [
          'Review lecture content before attempting',
          'Focus on understanding concepts, not memorization',
          'Use available hints if stuck',
        ],
      };
    } catch (error) {
      logger.error('GENERATE_GAP_REMEDIATION_QUIZ_FAILED', {
        userId,
        courseId,
        topic,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo remediation quiz',
        code: 'GENERATE_GAP_REMEDIATION_QUIZ_FAILED',
      };
    }
  }

  /**
   * Update learning path progress
   */
  async updateLearningPathProgress(userId, courseId, lectureId, event) {
    try {
      // Update user profile
      await aiPersonalization.updateProfileFromAnalytics(userId, courseId);

      // Check if path needs adjustment
      const shouldAdjustPath = await this.shouldAdjustPath(userId, courseId);
      
      if (shouldAdjustPath) {
        // Mark current path as outdated and generate new one
        await AiRecommendation.update(
          { status: 'completed' },
          {
            where: {
              userId,
              courseId,
              type: 'study_path',
              status: 'pending',
            },
          }
        );

        // Generate new path
        await this.generateLearningPath(userId, courseId);
      }

      return { updated: true, pathAdjusted: shouldAdjustPath };
    } catch (error) {
      logger.error('UPDATE_LEARNING_PATH_PROGRESS_FAILED', {
        userId,
        courseId,
        lectureId,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể cập nhật learning path progress',
        code: 'UPDATE_LEARNING_PATH_PROGRESS_FAILED',
      };
    }
  }

  /**
   * Check if learning path needs adjustment
   */
  async shouldAdjustPath(userId, courseId) {
    try {
      const profile = await UserLearningProfile.findOne({
        where: { userId, courseId },
      });

      if (!profile) return false;

      // Adjust if performance significantly changed
      if (profile.averageScore !== null) {
        const recentScores = await LearningAnalytics.findAll({
          where: {
            userId,
            courseId,
            eventType: 'quiz_complete',
            createdAt: {
              [db.Sequelize.Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        });

        if (recentScores.length >= 2) {
          const recentAvg = recentScores.reduce((sum, s) => 
            sum + (s.score / s.maxScore) * 100, 0) / recentScores.length;
          
          // Adjust if difference > 15%
          return Math.abs(recentAvg - profile.averageScore) > 15;
        }
      }

      return false;
    } catch (error) {
      logger.error('SHOULD_ADJUST_PATH_CHECK_FAILED', {
        userId,
        courseId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get study schedule recommendation
   */
  async getStudyScheduleRecommendation(userId, courseId, constraints = {}) {
    try {
      const {
        availableHoursPerDay = 2,
        preferredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        deadline = null,
      } = constraints;

      const learningPath = await this.getUserLearningPath(userId, courseId);
      const remainingMinutes = learningPath.learningPath?.totalDuration || 0;

      // Calculate days needed
      const daysPerWeek = preferredDays.length;
      const minutesPerWeek = daysPerWeek * availableHoursPerDay * 60;
      const weeksNeeded = Math.ceil(remainingMinutes / minutesPerWeek);

      const schedule = {
        totalWeeks: weeksNeeded,
        dailyHours: availableHoursPerDay,
        studyDays: preferredDays,
        milestones: [],
        weeklyGoals: [],
      };

      // Create weekly goals
      for (let week = 1; week <= weeksNeeded; week++) {
        schedule.weeklyGoals.push({
          week,
          targetMinutes: Math.min(minutesPerWeek, remainingMinutes - (week - 1) * minutesPerWeek),
          focus: `Giai đoạn ${Math.ceil(week / (weeksNeeded / learningPath.learningPath?.stages?.length || 1))}`,
        });
      }

      return schedule;
    } catch (error) {
      logger.error('GET_STUDY_SCHEDULE_RECOMMENDATION_FAILED', {
        userId,
        courseId,
        constraints,
        error: error.message,
      });
      throw {
        status: 500,
        message: 'Không thể tạo study schedule recommendation',
        code: 'GET_STUDY_SCHEDULE_RECOMMENDATION_FAILED',
      };
    }
  }
}

module.exports = new AiLearningPathService();
