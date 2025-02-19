import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('API Error:', {
    path: req.path,
    method: req.method,
    error: err
  });

  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors
    });
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
} 