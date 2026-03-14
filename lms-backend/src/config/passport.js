const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../models');
const UserModel = db.models.User;

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here') {
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await UserModel.findOne({
            where: { googleId: profile.id },
          });

          if (user) {
            // User exists with Google ID
            return done(null, user);
          }

          // Check if user exists with same email
          user = await UserModel.findOne({
            where: { email: profile.emails[0].value },
          });

          if (user) {
            // Link Google account to existing user
            user.googleId = profile.id;
            user.isEmailVerified = true; // Google emails are verified
            await user.save();
            return done(null, user);
          }

          // Create new user from Google profile
          const newUser = await UserModel.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            username: `google_${profile.id}`, // Unique username
            passwordHash: 'google_oauth_user', // Placeholder password
            role: 'student',
            isEmailVerified: true, // Google emails are verified
            isActive: true,
          });

          return done(null, newUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
  
  console.log('✅ Google OAuth configured');
} else {
  console.warn('⚠️  Google OAuth credentials not configured. Google login will not work.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
