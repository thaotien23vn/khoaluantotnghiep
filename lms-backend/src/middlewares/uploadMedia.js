const multer = require('multer');

const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'video/mp4',
  'video/x-m4v',
  'video/quicktime',
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
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter,
});

module.exports = upload;

