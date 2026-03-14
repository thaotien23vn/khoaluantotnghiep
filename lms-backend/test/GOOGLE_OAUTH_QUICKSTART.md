# Google OAuth Setup Guide

## 🔧 Quick Setup

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API or People API
4. Go to Credentials → Create Credentials → OAuth client ID
5. Select "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
7. Copy Client ID and Client Secret

### 2. Update .env File

Replace these lines in your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_actual_google_client_id
GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

### 3. Restart Server

```bash
npm run dev
```

### 4. Test Google OAuth

1. Visit: `http://localhost:5000/api/auth/google`
2. You should be redirected to Google login page
3. After login, you'll be redirected back to your frontend

## 🚀 Frontend Integration

### Add Google Login Button

```javascript
const loginWithGoogle = () => {
  window.location.href = 'http://localhost:5000/api/auth/google';
};
```

### Handle Callback

Create a route in your frontend to handle the callback:

```javascript
// In your frontend router (e.g., /auth/callback)
const AuthCallback = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const user = urlParams.get('user');
    
    if (token && user) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', user);
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/login?error=auth_failed';
    }
  }, []);
  
  return <div>Loading...</div>;
};
```

## 📱 Current Status

✅ **Backend Integration Complete**
- Google OAuth endpoints configured
- Database schema updated with `google_id` field
- Error handling implemented
- Session management configured

⚠️ **Action Required**
- Get Google OAuth credentials
- Update `.env` file with actual credentials
- Implement frontend integration

## 🔍 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google` | GET | Initiates Google OAuth flow |
| `/api/auth/google/callback` | GET | Handles Google OAuth callback |

## 🛠️ Troubleshooting

### "Google OAuth chưa được cấu hình"
- Update `.env` with actual Google credentials
- Restart server

### "redirect_uri_mismatch"
- Check callback URL in Google Console
- Ensure it matches `http://localhost:5000/api/auth/google/callback`

### Database Issues
- Run `npm run db:sync` to sync models
- Check if `google_id` column exists in users table
