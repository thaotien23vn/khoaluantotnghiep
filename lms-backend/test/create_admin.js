// Create Bootstrap Admin Account
// Run this with: node create_admin.js

require('dotenv').config();
const db = require('./src/models');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    console.log('Creating bootstrap admin account...');
    
    // Hash password
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create admin user
    const admin = await db.models.User.create({
      name: 'Admin User',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: passwordHash,
      role: 'admin',
      isEmailVerified: true
    });
    
    console.log('✅ Admin account created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('User ID:', admin.id);
    console.log('');
    console.log('Now you can run the security test:');
    console.log('ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 ./test-security.sh');
    
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log('⚠️  Admin account already exists');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
    } else {
      console.error('❌ Error creating admin:', error);
    }
  } finally {
    await db.sequelize.close();
  }
}

createAdmin();
