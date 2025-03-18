import { Request, Response, NextFunction } from 'express';
import debug from 'debug';

const log = debug('app:error-handler');

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  log('Error caught by middleware:', err);
  
  // Don't expose internal error details to client
  const statusCode = err.statusCode || 500;
  const message = err.expose ? err.message : 'An unexpected error occurred';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: req.id // If you have request IDs
  });
}; 