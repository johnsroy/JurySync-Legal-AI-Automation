import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.query;

  switch (req.method) {
    case 'GET':
      try {
        const document = await prisma.document.findUnique({
          where: { id: String(id) }
        });
        return res.status(200).json(document);
      } catch (error) {
        console.error('Error fetching document:', error);
        return res.status(500).json({ message: 'Failed to fetch document' });
      }

    case 'DELETE':
      try {
        await prisma.document.delete({
          where: { id: String(id) }
        });
        return res.status(200).json({ message: 'Document deleted successfully' });
      } catch (error) {
        console.error('Error deleting document:', error);
        return res.status(500).json({ message: 'Failed to delete document' });
      }

    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 