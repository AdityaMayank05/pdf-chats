import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { createHash } from "crypto";
import {
  Document,
  RecursiveCharacterTextSplitter,
} from "@pinecone-database/doc-splitter";
import { getEmbeddings } from "./embeddings";
import { convertToAscii } from "./utils";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Initialize Pinecone client
export const getPineconeClient = () => {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

type PDFPage = {
  pageContent: string;
  metadata: {
    loc: { pageNumber: number };
  };
};

// 🔄 Main function updated for UploadThing
export async function loadUploadthingFileIntoPinecone(fileUrl: string, fileKey: string) {
  // 1. Download PDF from UploadThing URL to local file system
  console.log("Downloading PDF from UploadThing...");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "uploadthing-"));
  const localFilePath = path.join(tempDir, path.basename(fileKey));

  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  await fs.writeFile(localFilePath, response.data);
  console.log("PDF saved locally:", localFilePath);

  // 2. Load and parse PDF
  const loader = new PDFLoader(localFilePath);
  const pages = (await loader.load()) as PDFPage[];

  // 3. Split into smaller document chunks
  const documents = await Promise.all(pages.map(prepareDocument));

  // 4. Generate vector embeddings
  const vectors = await Promise.all(documents.flat().map(embedDocument));

  // 5. Upload to Pinecone
  const client = await getPineconeClient();
  const pineconeIndex = await client.index("pdfchats");
  const namespace = pineconeIndex.namespace(convertToAscii(fileKey));

  console.log("Uploading vectors to Pinecone...");
  await namespace.upsert(vectors);

  return documents[0]; // Return first doc chunk (optional)
}

// Embedding logic
async function embedDocument(doc: Document) {
  try {
    const embeddings = await getEmbeddings(doc.pageContent);
    const hash = createHash("md5").update(doc.pageContent).digest("hex");

    return {
      id: hash,
      values: embeddings,
      metadata: {
        text: doc.metadata.text,
        pageNumber: doc.metadata.pageNumber,
      },
    } as PineconeRecord;
  } catch (error) {
    console.error("Error embedding document:", error);
    throw error;
  }
}

// Truncate helper
export const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

// PDF page prep logic
async function prepareDocument(page: PDFPage) {
  let { pageContent, metadata } = page;
  pageContent = pageContent.replace(/\n/g, "");

  const splitter = new RecursiveCharacterTextSplitter();
  const docs = await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: truncateStringByBytes(pageContent, 36000),
      },
    }),
  ]);
  return docs;
}
