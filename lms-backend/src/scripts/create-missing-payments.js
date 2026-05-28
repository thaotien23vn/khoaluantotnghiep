const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize, connectDB, models } = require('../models');

async function main() {
  await connectDB();
  const { Enrollment, Course, Payment } = models;

  // Find all paid enrollments without a completed payment
  const enrollments = await Enrollment.findAll({
    where: { enrollmentType: 'paid' },
    include: [{ model: Course, as: 'Course', attributes: ['id', 'price'] }],
  });

  console.log(`🔧 Found ${enrollments.length} paid enrollments`);

  let created = 0;
  let skipped = 0;

  for (const en of enrollments) {
    const existing = await Payment.findOne({
      where: { userId: en.userId, courseId: en.courseId, status: 'completed' },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const price = Number(en.Course?.price || 0);
    if (price === 0) {
      skipped++;
      continue;
    }

    try {
      await Payment.create({
        userId: en.userId,
        courseId: en.courseId,
        amount: price,
        currency: 'USD',
        provider: 'mock',
        providerTxn: `MIGRATE-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
        status: 'completed',
        paymentDetails: {
          initiatedAt: en.enrolledAt ? en.enrolledAt.toISOString() : new Date().toISOString(),
          processedAt: new Date().toISOString(),
          source: 'migration',
        },
      });
      created++;
    } catch (err) {
      console.error(`  ✗ Failed for enrollment ${en.id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Created ${created} payments, skipped ${skipped}`);
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
