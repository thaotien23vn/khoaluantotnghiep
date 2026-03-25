require('dotenv').config();
const { sequelize } = require('./index');

(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ All models were synchronized successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ sync error', err);
    process.exit(1);
  }
})();
