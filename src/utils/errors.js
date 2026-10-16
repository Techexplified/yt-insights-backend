// An error we expect and know how to describe to the client.
class AppError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

module.exports = { AppError };
