import { prisma } from '../lib/prisma';
import { Document, DocumentAnalysis } from '@prisma/client';

export class DocumentService {
  async saveDocument(data: {
    fileName: string;
    documentType: string;
    industry: string;
    complianceStatus: string;
    content: string;
    metadata: any;
    userId: string;
  }) {
    return await prisma.document.create({
      data: {
        ...data,
        timestamp: new Date(),
      },
    });
  }

  async getDocuments(userId: string) {
    return await prisma.document.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  async deleteDocument(id: string, userId: string) {
    return await prisma.document.delete({
      where: {
        id,
        userId,
      },
    });
  }
} 