import { Pinecone } from "@pinecone-database/pinecone";
import { convertToAscii } from "./utils";
import { getEmbeddings } from "./embeddings";

export async function getMatchesFromEmbeddings(
  embeddings: number[],
  fileKey: string
) {
  try {
    const client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    const pineconeIndex = await client.index("pdf-chats");
    const namespace = pineconeIndex.namespace(convertToAscii(fileKey));
    const queryResult = await namespace.query({
      topK: 8, // Increased from 5 to 8 for more context
      vector: embeddings,
      includeMetadata: true,
    });
    console.log("Query result:", queryResult);
    return queryResult.matches || [];
  } catch (error) {
    console.log("error querying embeddings", error);
    throw error;
  }
}

export async function getContext(query: string, fileKey: string) {
  if (!fileKey) {
    console.warn("No fileKey provided for context retrieval");
    return "";
  }

  try {
    // Generate embeddings for the query
    const queryEmbeddings = await getEmbeddings(query);
    console.log("Query embedding length:", queryEmbeddings.length);
    console.log("Namespace for query:", convertToAscii(fileKey));

    // Get matches from Pinecone
    const matches = await getMatchesFromEmbeddings(queryEmbeddings, fileKey);

    // Use all retrieved matches regardless of score since we're getting low scores
    // Sort by score in descending order to get the most relevant ones first
    const qualifyingDocs = matches
      .filter((match) => match.score && match.score > 0.45) // Much lower threshold
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    if (qualifyingDocs.length === 0) {
      // If still no matches, just use all matches regardless of score
      console.warn("No qualifying documents found with sufficient relevance score, using all matches");
      const allDocs = matches.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      if (allDocs.length === 0) {
        return "No content could be retrieved from the uploaded PDF.";
      }
      
      // Use all documents instead of returning an error message
      console.log("Using all available documents regardless of score");
      qualifyingDocs.push(...allDocs);
    }
    
    console.log(`Found ${qualifyingDocs.length} qualifying documents with scores ranging from ${qualifyingDocs[0].score} to ${qualifyingDocs[qualifyingDocs.length-1].score}`);

    type Metadata = {
      text: string;
      pageNumber: number;
    };

    // Extract text and add page number references
    const docsWithPageInfo = qualifyingDocs.map((match) => {
      const metadata = match.metadata as Metadata;
      return `[Page ${metadata.pageNumber}] ${metadata.text}`;
    });

    // Join the documents and limit to 4000 characters (increased from 3000)
    const contextText = docsWithPageInfo.join("\n\n").substring(0, 4000);
    console.log("Final context to LLM:", contextText.substring(0, 200) + "...");
    console.log(`Retrieved ${qualifyingDocs.length} relevant chunks from PDF`);

    return contextText;
  } catch (error) {
    console.error("Error retrieving context from PDF:", error);
    return "Error retrieving context from the uploaded PDF.";
  }
}
