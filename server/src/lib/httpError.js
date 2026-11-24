// An error with an HTTP status code. Throw it anywhere; the error handler sends it to the browser.
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

module.exports = { HttpError };
