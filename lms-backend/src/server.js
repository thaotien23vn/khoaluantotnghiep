require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./models');

const PORT = process.env.PORT || 5000;

console.log('Starting server...');

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
})();