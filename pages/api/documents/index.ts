import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
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
          return res.status(200).json(documents);
        } catch (error) {
          console.error('Error fetching documents:', error);
          return res.status(500).json({ message: 'Failed to fetch documents' });
        }

      case 'POST':
        try {
          const document = await prisma.document.create({
            data: {
              ...req.body,
              userId: user.id,
              timestamp: new Date()
            }
          });
          return res.status(201).json(document);
        } catch (error) {
          console.error('Error creating document:', error);
          return res.status(500).json({ message: 'Failed to create document' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
} 