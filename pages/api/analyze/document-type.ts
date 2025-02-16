import { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { content } = req.body;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a legal document classifier. Analyze the document content and determine its type."
        },
        {
          role: "user",
          content: `Classify this document content: ${content.substring(0, 1000)}...`
        }
      ],
    });

    const documentType = completion.data.choices[0]?.message?.content || "Unknown";
    
    return res.status(200).json({ documentType });
  } catch (error) {
    console.error('Document analysis error:', error);
    return res.status(500).json({ message: 'Analysis failed' });
  }
} 