import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

/**
 * Request logging that deliberately records only method, path, and status —
 * NOT client IP, headers, query, or body. For this threat model, request
 * metadata that ties an identity to activity is itself sensitive, so we keep
 * the absolute minimum needed to operate the service.
 */
export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  // Never attach the remote address.
  customProps: () => ({}),
});
