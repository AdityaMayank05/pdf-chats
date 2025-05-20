import { createOpenAI } from "@ai-sdk/openai";
import { type Message, streamText } from "ai";
import { getContext } from "@/lib/context";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export async function POST(req: Request) {
  try {
    const { messages, chatId }: { messages: Message[]; chatId: string } = await req.json();

    // Get chat from DB
    const _chats = await db.select().from(chats).where(eq(chats.id, Number(chatId)));
    if (_chats.length !== 1) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const fileKey = _chats[0].fileKey;
    const fileName = _chats[0].pdfName || "uploaded document";
    const lastMessage = messages[messages.length - 1];

    console.log(`Processing query for PDF: ${fileName} (fileKey: ${fileKey})`);

    // Generate context from fileKey + last message
    const context = await getContext(lastMessage.content, fileKey);
    
    if (!context || context.trim() === "") {
      console.warn("No context retrieved from PDF");
    } else {
      console.log(`Retrieved ${context.length} characters of context from PDF`);
    }

    // Enhanced system prompt with better RAG instructions
    const systemPrompt = `You are an AI assistant specialized in answering questions based on the provided PDF document "${fileName}".

    IMPORTANT INSTRUCTIONS:
    1. Base your answers EXCLUSIVELY on the information provided in the CONTEXT BLOCK below.
    2. If the answer cannot be found in the context, clearly state: "I don't see information about this in the document. Could you rephrase your question or ask about something else covered in the document?"
    3. Do not make up or infer information not present in the context.
    4. When referencing specific parts of the document, mention the page number if available (e.g., "As mentioned on page 5...").
    5. Provide concise, accurate answers that directly address the user's question.
    6. If the context is insufficient but you have some partial information, share what you can find and explain what's missing.
    
    START CONTEXT BLOCK
    ${context}
    END OF CONTEXT BLOCK
    
    Remember: You are answering questions about "${fileName}". Only use information from the context above.`;

    // Generate response using AI SDK with a more capable model
    const result = await streamText({
      model: openai("gpt-4o"), // Using a more capable model for better RAG performance
      system: systemPrompt,
      messages,
      temperature: 0.2, // Lower temperature for more factual responses
      maxTokens: 1500, // Limit response length
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
