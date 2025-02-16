import { NextApiRequest, NextApiResponse } from 'next';
import { errorHandler } from '@/middleware/error-handler';

export function apiHandler(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      await handler(req, res);
    } catch (err) {
      errorHandler(err, req, res);
    }
  };
} 