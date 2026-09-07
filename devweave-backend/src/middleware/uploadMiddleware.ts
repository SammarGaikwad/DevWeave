import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    files: 100,
    fileSize: 5 * 1024 * 1024, // 5 MB per file limit
    fieldSize: 10 * 1024 * 1024,
  },
});
