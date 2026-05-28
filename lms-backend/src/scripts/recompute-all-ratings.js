const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize, connectDB, models } = require('../models');
const { recomputeCourseRating } = require('../services/courseAggregates.service');

async function main() {
  await connectDB();
  const { Course } = models;

  const courses = await Course.findAll({ attributes: ['id', 'title'] });
  console.log(`🔧 Recomputing ratings for ${courses.length} courses...`);

  for (const course of courses) {
    try {
      await recomputeCourseRating(course.id);
      console.log(`  ✓ ${course.title.slice(0, 40)}`);
    } catch (err) {
      console.error(`  ✗ ${course.title.slice(0, 40)}: ${err.message}`);
    }
  }

  console.log('\n✅ Done!');
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
