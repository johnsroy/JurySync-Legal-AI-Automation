import { OpenAI } from 'openai';
import { Storage } from '@google-cloud/storage';

export class DocumentProcessor {
  private openai: OpenAI;
  private storage: Storage;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.storage = new Storage({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
    });
  }

  async process(content: string, type: 'upload' | 'paste') {
    try {
      // Handle uploaded file
      if (type === 'upload') {
        const bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME!);
        const file = bucket.file(`documents/${Date.now()}.txt`);
        await file.save(content);
      }

      // Process content with AI
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a legal document processor. Extract and structure the key information."
          },
          {
            role: "user",
            content: content
          }
        ]
      });

      return {
        success: true,
        content: completion.choices[0].message.content
      };
    } catch (error) {
      console.error('Document processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Document processing failed'
      };
    }
  }
} 