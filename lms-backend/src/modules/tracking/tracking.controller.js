const trackingService = require('./tracking.service');

class TrackingController {
  // POST /api/tracking/log
  async logActivity(req, res) {
    try {
      const {
        action,
        page,
        url,
        sessionId,
        metadata,
      } = req.body;

      // Get IP and user agent from request
      const ipAddress = req.headers['x-forwarded-for'] || 
                        req.socket.remoteAddress || 
                        null;
      
      const userAgent = req.headers['user-agent'] || null;
      const referrer = req.headers['referer'] || req.headers['referrer'] || null;

      // Get userId from authenticated user if available
      const userId = req.user?.id || null;

      const activity = await trackingService.logActivity({
        userId,
        action,
        page,
        url,
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent,
        referrer,
        sessionId,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: 'Activity logged',
        data: { activity },
      });
    } catch (error) {
      console.error('[TrackingController.logActivity] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log activity',
        error: error.message,
      });
    }
  }

  // GET /api/tracking/analytics
  async getAnalytics(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;

      const analytics = await trackingService.getAnalytics({
        page: parseInt(page),
        limit: parseInt(limit),
        search: search || '',
      });

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('[TrackingController.getAnalytics] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics',
        error: error.message,
      });
    }
  }

  // GET /api/tracking/user-activities
  async getUserActivities(req, res) {
    try {
      const userId = req.user?.id;
      const { limit = 50 } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const activities = await trackingService.getUserActivities(
        userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: { activities },
      });
    } catch (error) {
      console.error('[TrackingController.getUserActivities] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user activities',
        error: error.message,
      });
    }
  }

  // DELETE /api/tracking/clean (admin only)
  async cleanOldData(req, res) {
    try {
      const { daysToKeep = 90 } = req.query;

      const result = await trackingService.cleanOldData(parseInt(daysToKeep));

      res.json({
        success: true,
        message: `Cleaned ${result.deletedCount} old tracking records`,
        data: result,
      });
    } catch (error) {
      console.error('[TrackingController.cleanOldData] Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clean old data',
        error: error.message,
      });
    }
  }
}

module.exports = new TrackingController();
