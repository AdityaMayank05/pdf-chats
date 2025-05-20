import ChatComponent from "@/components/ChatComponent";
import ChatSideBar from "@/components/ChatSideBar";
import PDFViewer from "@/components/PDFViewer";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";
// import { checkSubscription } from "@/lib/subscription";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: 'Chat with PDF',
  description: 'Chat with your PDF documents using AI',
};

export default async function ChatPage({ params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const { userId } = await auth();
  if (!userId) {
    return redirect("/sign-in");
  }
  const _chats = await db.select().from(chats).where(eq(chats.userId, userId));
  if (!_chats) {
    return redirect("/");
  }
  if (!_chats.find((chat) => chat.id === parseInt(chatId))) {
    return redirect("/");
  }

  const currentChat = _chats.find((chat) => chat.id === parseInt(chatId));
  // const isPro = await checkSubscription();

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex w-full min-h-screen overflow-auto no-scrollbar">
        {/* chat sidebar */}
        <div className="flex-[1] max-w-xs">
          <ChatSideBar chats={_chats} chatId={parseInt(chatId)} /> {/**/}
        </div>
        {/* pdf viewer */}
        <div className="max-h-screen p-4 overflow-auto no-scrollbar flex-[5]">
          <PDFViewer pdf_url={currentChat?.pdfUrl || ""} />
        </div>
        {/* chat component */}
        <div className="flex-[3] border-l-4 border-l-slate-200 overflow-auto no-scrollbar">
          <ChatComponent chatId={parseInt(chatId)} />
        </div>
      </div>
    </div>
  );
}
