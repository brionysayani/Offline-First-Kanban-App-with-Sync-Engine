const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? undefined : 'dev-secret');

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required in production');
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret,
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
