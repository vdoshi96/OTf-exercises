export function contentSecurityPolicy(
  frameSource: "'none'" | "https://www.tiktok.com",
  development = false,
) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" +
      (development ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'" + (development ? " ws:" : ""),
    "frame-src " + frameSource,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

export const defaultContentSecurityPolicy = contentSecurityPolicy(
  "'none'",
  process.env.NODE_ENV === "development",
);

export const tiktokContentSecurityPolicy = contentSecurityPolicy(
  "https://www.tiktok.com",
  process.env.NODE_ENV === "development",
);
