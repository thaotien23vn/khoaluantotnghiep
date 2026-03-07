const multer = require('multer');

const storage = multer.memoryStorage();

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const maxUploadBytes = Number.isFinite(MAX_UPLOAD_MB) && MAX_UPLOAD_MB > 0
  ? Math.floor(MAX_UPLOAD_MB * 1024 * 1024)
  : 50 * 1024 * 1024;

const allowedMimeTypes = [
  'video/mp4',
  'video/webm',
  'video/x-m4v',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Định dạng file không được hỗ trợ'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: maxUploadBytes,
  },
  fileFilter,
});

module.exports = upload;
module.exports.handleUploadError = (err, req, res, next) => {
  if (!err) return next();

  // Multer known errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `File quá lớn. Giới hạn tối đa ${MAX_UPLOAD_MB}MB`,
    });
  }

  // Custom fileFilter errors
  return res.status(400).json({
    success: false,
    message: err.message || 'Upload file thất bại',
  });
};

