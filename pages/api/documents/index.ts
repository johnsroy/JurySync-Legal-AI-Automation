import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set proper headers
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized' 
      });
    }

    switch (req.method) {
      case 'GET':
        try {
          const documents = await prisma.document.findMany({
            where: {
              userId: user.id
            },
            orderBy: {
              timestamp: 'desc'
            }
          });

          return res.status(200).json({ 
            success: true,
            data: documents 
          });
        } catch (error) {
          console.error('Database error:', error);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to fetch documents'
          });
        }

      case 'POST':
        try {
          if (!req.body) {
            return res.status(400).json({
              success: false,
              message: 'No document data provided'
            });
          }

          const document = await prisma.document.create({
            data: {
              ...req.body,
              userId: user.id,
              timestamp: new Date()
            }
          });

          return res.status(201).json({ 
            success: true,
            data: document 
          });
        } catch (error) {
          console.error('Database error:', error);
          return res.status(500).json({ 
            success: false,
            message: 'Failed to create document'
          });
        }

      default:
        return res.status(405).json({ 
          success: false,
          message: `Method ${req.method} Not Allowed` 
        });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error'
    });
  }
} 