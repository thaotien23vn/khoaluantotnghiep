const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const supabaseConfig = require('../config/supabase');

let supabase = null;
if (supabaseConfig.isConfigured()) {
  supabase = createClient(supabaseConfig.url, supabaseConfig.serviceKey);
}

const getPublicUrl = (path) => {
  const { data } = supabase.storage
    .from(supabaseConfig.bucket)
    .getPublicUrl(path);
  return data.publicUrl;
};

const uploadLectureMedia = async (file) => {
  if (!file || !file.buffer) {
    throw new Error('File upload không hợp lệ');
  }

  if (!supabaseConfig.isConfigured()) {
    throw new Error('Supabase chưa được cấu hình đầy đủ');
  }

  const ext = file.originalname.split('.').pop();
  const path = `lectures/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(supabaseConfig.bucket)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const publicUrl = getPublicUrl(path);

  return {
    url: publicUrl,
    publicId: path,
    bytes: file.buffer.length,
    format: ext,
  };
};

const deleteMedia = async (publicId) => {
  if (!supabaseConfig.isConfigured()) {
    throw new Error('Supabase chưa được cấu hình đầy đủ');
  }

  const { error } = await supabase.storage
    .from(supabaseConfig.bucket)
    .remove([publicId]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }

  return { success: true };
};

module.exports = {
  uploadLectureMedia,
  deleteMedia,
};

