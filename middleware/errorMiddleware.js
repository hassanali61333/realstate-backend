const multer = require('multer');

/** 404 handler for unknown routes. */
const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

/** Central error handler. Normalises Mongoose, JWT and Multer errors. */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Server error';

  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5MB or smaller' : err.message;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value: ' + Object.keys(err.keyValue || {}).join(', ');
  } else if (/Only JPG/.test(message)) {
    status = 400;
  }

  if (process.env.NODE_ENV !== 'production') console.error(err);
  res.status(status).json({ message });
};

module.exports = { notFound, errorHandler };
