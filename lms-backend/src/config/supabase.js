/**
 * Supabase configuration
 * Replaces Cloudinary for file storage
 */
module.exports = {
  url: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_KEY,
  bucket: process.env.SUPABASE_BUCKET || 'lms-media',
  
  isConfigured() {
    return !!(this.url && this.serviceKey);
  }
};
