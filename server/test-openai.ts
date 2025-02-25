import { OpenAI } from "openai";
import debug from "debug";

const log = debug("app:test-openai");

async function testOpenAIConnection() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    log("Testing OpenAI API connection...");
    const models = await openai.models.list();
    const hasRequiredModel = models.data.some(m => m.id === "gpt-4-1106-preview");
    
    if (!hasRequiredModel) {
      throw new Error("Required model 'gpt-4-1106-preview' is not available");
    }
    
    log("OpenAI connection test successful!");
    log("Required model is available");
    return true;
  } catch (error) {
    log("OpenAI connection test failed:", error);
    throw error;
  }
}

testOpenAIConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to connect to OpenAI:", error);
    process.exit(1);
  });
