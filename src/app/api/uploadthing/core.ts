import { createUploadthing, type FileRouter } from "uploadthing/next";

// Check if environment variables are available
const hasEnvVars = !!(process.env.UPLOADTHING_SECRET && process.env.UPLOADTHING_APP_ID);
if (!hasEnvVars) {
  console.error("UploadThing environment variables are missing!");
}

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(() => {
      // This code runs on your server before upload
      console.log("UploadThing middleware running");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return {};
    })
    .onUploadComplete(({ file, metadata }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for file:", file.name);
      
      // Return any data you want to be accessible in the client
      return { uploadedBy: "pdf-chats" };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
