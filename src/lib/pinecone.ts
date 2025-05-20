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

// Initialize Pinecone client (synchronous factory)
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

// Embedding logic (must be declared before use)
async function embedDocument(doc: Document): Promise<PineconeRecord> {
  const embeddings = await getEmbeddings(doc.pageContent);
  // Log embedding length for debugging
  console.log(`Embedding length for chunk id=${doc.metadata.pageNumber}: ${embeddings.length}`);

  const hash = createHash("md5").update(doc.pageContent).digest("hex");
  return {
    id: hash,
    values: embeddings,
    metadata: {
      text: doc.metadata.text,
      pageNumber: doc.metadata.pageNumber,
    },
  } as PineconeRecord;
}

// PDF page prep logic
async function prepareDocument(page: PDFPage): Promise<Document[]> {
  let { pageContent, metadata } = page;
  
  // Preserve some paragraph structure but remove excessive newlines
  pageContent = pageContent.replace(/\n{3,}/g, "\n\n");
  pageContent = pageContent.replace(/\s+/g, " ").trim();

  // Use a more sophisticated text splitter with better chunk size and overlap
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,      // Smaller chunks for more precise retrieval
    chunkOverlap: 200,    // Overlap to maintain context between chunks
    separators: ["\n\n", "\n", ".", "!", "?", ";", ":", " ", ""],
  });
  
  return await splitter.splitDocuments([
    new Document({
      pageContent,
      metadata: {
        pageNumber: metadata.loc.pageNumber,
        text: pageContent,  // Store the full text without truncation
      },
    }),
  ]);
}

// 🔄 Main function for ingestion and upload
export async function loadUploadthingFileIntoPinecone(
  fileUrl: string,
  fileKey: string
) {
  // 1. Download PDF
  console.log("Downloading PDF from UploadThing...");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "uploadthing-"));
  const localFilePath = path.join(tempDir, path.basename(fileKey));
  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  await fs.writeFile(localFilePath, response.data);
  console.log("PDF saved locally:", localFilePath);

  // 2. Load and parse PDF
  const loader = new PDFLoader(localFilePath);
  const pages = (await loader.load()) as PDFPage[];

  // 3. Split into chunks
  console.log(`Total pages loaded: ${pages.length}`);
  const documents = await Promise.all(pages.map(prepareDocument));
  const flatDocs = documents.flat();
  console.log(`Total document chunks: ${flatDocs.length}`);
  console.log(flatDocs[0].pageContent); // after splitting

  // 4. Generate embeddings
  const vectors = await Promise.all(flatDocs.map(embedDocument));

  // 5. Upload to Pinecone
  const client = getPineconeClient();
  const pineconeIndex = await client.index("pdf-chats");
  const namespaceName = convertToAscii(fileKey);
  const namespace = pineconeIndex.namespace(namespaceName);

  console.log("→ Uploading to Pinecone namespace:", namespaceName);
  console.log("→ Total vectors to upsert:", vectors.length);
  console.log("→ Uploading to Pinecone namespace:", namespaceName);
console.log("→ Total vectors to upsert:", vectors.length);

if (vectors.length === 0) {
  console.warn("No vectors to upsert – array is empty");
} else {
  const first = vectors[0];

  // Check that `values` and `metadata` are defined
  if (!first.values || !first.metadata) {
    console.warn("First vector missing `values` or `metadata`", first);
  } else {
    console.log("→ Sample vector payload:", {
      id: first.id,
      valuesSample: first.values.slice(0, 5),                // now safe
      metadataSample: {
        text: (first.metadata.text as string).substring(0, 50),       // safe, too
        pageNumber: first.metadata.pageNumber,
      },
    });
  }
}


  await namespace.upsert(vectors);
  console.log("✅ Upsert complete");

  // 6. Immediately verify ingestion
  const fetchRes = await namespace.fetch([vectors[0].id]);
  console.log("→ Fetch result for first vector:", fetchRes);

  // Return all document chunks for chat context
  return flatDocs; // <-- Now returns all chunks for chat context
}

/**
 * Search Pinecone for the most relevant PDF chunks for a given query.
 * @param query - The user's question or prompt.
 * @param fileKey - The fileKey used as the namespace.
 * @param topK - Number of relevant chunks to retrieve.
 */
export async function queryPdfContextFromPinecone(query: string, fileKey: string, topK = 5) {
  const client = getPineconeClient();
  const pineconeIndex = await client.index("pdf-chats");
  const namespaceName = convertToAscii(fileKey);
  const namespace = pineconeIndex.namespace(namespaceName);

  // Get embedding for the query
  const queryEmbedding = await getEmbeddings(query);

  // Query Pinecone for similar vectors
  const results = await namespace.query({
    topK,
    vector: queryEmbedding,
    includeMetadata: true,
  });

  // Return the most relevant chunks (with metadata)
  return results.matches?.map(match => ({
    score: match.score,
    text: match.metadata?.text,
    pageNumber: match.metadata?.pageNumber,
  })) ?? [];
}
