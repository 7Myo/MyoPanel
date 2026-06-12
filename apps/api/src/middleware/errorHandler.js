export function notFound(_req, _res, next) {
  const error = new Error("Route introuvable.");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  const payload = {
    error: {
      message: error.message || "Erreur serveur.",
      details: error.details
    }
  };

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json(payload);
}
