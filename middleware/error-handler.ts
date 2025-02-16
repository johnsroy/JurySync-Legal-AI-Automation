import { NextApiRequest, NextApiResponse } from 'next';

export function errorHandler(err: any, req: NextApiRequest, res: NextApiResponse) {
  console.error('API Error:', err);

  // Always set content type
  res.setHeader('Content-Type', 'application/json');

  if (typeof err === 'string') {
    return res.status(400).json({
      success: false,
      message: err
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
} 