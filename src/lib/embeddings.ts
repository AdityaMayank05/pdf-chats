import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,                    // your grmini key 
  // └─ if GRMINI_BASE_URL is unset, falls back to real OpenAI
});

export async function getEmbeddings(text: string): Promise<number[]> {
  const resp = await client.embeddings.create({
    model: "text-embedding-3-large",                      // choose whatever model your service supports
    input: text.replace(/\n/g, " "),
    dimensions:1024,
  });

  // The shape is identical to OpenAI’s—just return the embedding array
  return resp.data[0].embedding;
}