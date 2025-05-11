// lib/uploadthings.ts
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core"; // adjust path as needed

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
