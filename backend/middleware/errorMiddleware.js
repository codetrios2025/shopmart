export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode;
  if (!statusCode && err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  } else if (!statusCode && err.code === 11000) {
    statusCode = 409;
  } else if (
    !statusCode &&
    (err.name === "ValidationError" || err.name === "CastError")
  ) {
    statusCode = 400;
  } else if (!statusCode) {
    statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  }
  res.status(statusCode).json({
    success: false,
    message: err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
