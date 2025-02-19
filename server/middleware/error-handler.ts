import { Request, Response, NextFunction } from 'express';
import { PostgresError } from 'postgres';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('API Error:', {
    path: req.path,
    method: req.method,
    error: err,
    stack: err.stack
  });

  // Handle Postgres errors
  if (err instanceof PostgresError) {
    return res.status(500).json({
      success: false,
      error: 'Database Error',
      details: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred with the database'
    });
  }

  // Handle validation errors
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors
    });
  }

  // Handle unauthorized errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      details: 'You must be logged in to access this resource'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
} 