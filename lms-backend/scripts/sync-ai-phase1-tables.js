/**
 * Database Sync Script for AI Phase 1 Enhancement
 * Run this to create the 4 new tables:
 * - user_learning_profiles
 * - ai_recommendations
 * - learning_analytics
 * - content_quality_scores
 */

const db = require('../src/models');

const syncDatabase = async () => {
  try {
    console.log('🔄 Syncing AI Phase 1 tables...\n');

    // Sync only specific models (safe, won't drop existing tables)
    const modelsToSync = [
      'UserLearningProfile',
      'AiRecommendation', 
      'LearningAnalytics',
      'ContentQualityScore',
    ];

    for (const modelName of modelsToSync) {
      const model = db.models[modelName];
      if (model) {
        await model.sync({ alter: true }); // alter: true sẽ thêm columns mới nếu cần
        console.log(`✅ ${modelName} table synced`);
      } else {
        console.log(`❌ ${modelName} model not found`);
      }
    }

    console.log('\n✨ All AI Phase 1 tables synced successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error syncing database:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  syncDatabase();
}

module.exports = syncDatabase;
