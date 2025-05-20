import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
import { loadUploadthingFileIntoPinecone } from "@/lib/pinecone"; // <-- Adapted function
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// /api/create-chat
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { file_url, file_name } = body; // UploadThing typically returns a URL

    console.log(file_url, file_name);

    await loadUploadthingFileIntoPinecone(file_url, file_name); // Adapted function that takes URL from UploadThing

    const chat_id = await db
      .insert(chats)
      .values({
        fileKey: file_name, // You can still call it fileKey if needed
        pdfName: file_name,
        pdfUrl: file_url,
        userId,
      })
      .returning({
        insertedId: chats.id,
      });

    return NextResponse.json(
      {
        chat_id: chat_id[0].insertedId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}
