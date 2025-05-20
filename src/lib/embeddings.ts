import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

export async function getEmbeddings(input: unknown): Promise<number[]> {
  // 1. Coerce to string and sanitize
  const text =
    typeof input === "string"
      ? input
      : input == null
      ? ""
      : String(input);
  const sanitized = text.replace(/\n/g, " ");

  // 2. Call the Gemini embed endpoint
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: [sanitized],
    config: { taskType: "SEMANTIC_SIMILARITY" },
  });

  // 3. Validate presence
  if (!response.embeddings || response.embeddings.length === 0) {
    throw new Error("No embeddings returned from Gemini");
  }

  const first: unknown = response.embeddings[0];
  // 4. Confirm it has a `.values` array
  // Define a proper interface for the embedding response
  interface EmbeddingResponse {
    values: number[];
  }

  if (
    typeof first !== "object" ||
    first === null ||
    !Array.isArray((first as EmbeddingResponse).values)
  ) {
    throw new Error("Unexpected embedding format");
  }

  // 5. Return the raw float vector
  return (first as EmbeddingResponse).values;
}
