const cloudinary = require('cloudinary').v2;
const cloudinaryConfig = require('../config/cloudinary');

if (cloudinaryConfig.cloudName && cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret) {
  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
  });
}

const uploadLectureMedia = (file) => new Promise((resolve, reject) => {
  if (!file || !file.buffer) {
    return reject(new Error('File upload không hợp lệ'));
  }

  if (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret) {
    return reject(new Error('Cloudinary chưa được cấu hình đầy đủ'));
  }

  const options = {
    folder: cloudinaryConfig.folder,
    resource_type: 'auto',
  };

  const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
    if (error) {
      return reject(error);
    }

    resolve({
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format,
    });
  });

  uploadStream.end(file.buffer);
});

module.exports = {
  uploadLectureMedia,
};

