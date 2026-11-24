const multer = require('multer');
const { HttpError } = require('../lib/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Route not found'));
}

// Turns every error into a JSON reply: { error: "message", details? }.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let body = { error: 'Something went wrong. Please try again' };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: err.message, ...(err.details ? { details: err.details } : {}) };
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    body = { error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Upload failed' };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    body = { error: 'Request body is not valid JSON' };
  } else if (err.code === 'P2002') {
    status = 409;
    body = { error: 'That username or email is already taken' };
  } else if (err.code === 'P2025') {
    status = 404;
    body = { error: 'Not found' };
  } else {
    console.error(err);
  }

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
