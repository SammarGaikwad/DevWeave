import morgan from 'morgan';
import { env } from '../config/env.js';

// Custom morgan format omitting sensitive headers
export const httpLogger = morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined', {
  skip: (req) => req.url === '/api/health',
});
