import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "16MB" } }).onUploadComplete(
    ({ file }) => {
      console.log("Upload complete", file);
    }
  ),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
