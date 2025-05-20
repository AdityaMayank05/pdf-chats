import { queryPdfContextFromPinecone } from "./pinecone";
import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

// Placeholder for your language model call
async function callYourLanguageModel(prompt: string): Promise<string> {
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo", // or your preferred model
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
    temperature: 0.2,
  });
  return completion.data.choices[0].message?.content ?? "";
}

export async function handleChat(userQuery: string, fileKey: string) {
  // 1. Retrieve relevant context from Pinecone
  const contextChunks = await queryPdfContextFromPinecone(userQuery, fileKey, 5);
  const contextText = contextChunks.map(chunk => chunk.text).join("\n");

  // 2. Build prompt for the language model
  const prompt = `Use the following PDF context to answer the question:\n${contextText}\n\nQuestion: ${userQuery}`;

  // 3. Call your language model API with the prompt
  const answer = await callYourLanguageModel(prompt);

  return answer;
}