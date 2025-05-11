"use client";

import { Inbox, Loader2 } from "lucide-react";
import React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-hot-toast";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthings";
import axios from "axios";

const FileUpload = () => {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);

  const { startUpload } = useUploadThing("pdfUploader");

  const mutation = useMutation({
    mutationFn: async ({
      file_url,
      file_name,
    }: {
      file_url: string;
      file_name: string;
    }) => {
      const response = await axios.post("/api/create-chat", {
        file_url,
        file_name,
      });

      return response.data;
    },
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large");
        return;
      }

      try {
        setUploading(true);

        const res = await startUpload([file]);
        if (!res || res.length === 0) {
          toast.error("Upload failed");
          return;
        }

        const uploadedFile = res[0];
        const file_url = uploadedFile.url; // UploadThing gives `url`
        const file_name = file.name;

        mutation.mutate(
          { file_url, file_name },
          {
            onSuccess: ({ chat_id }) => {
              toast.success("Chat created!");
              router.push(`/chat/${chat_id}`);
            },
            onError: (err) => {
              toast.error("Error creating chat");
              console.error(err);
            },
          }
        );
      } catch (error) {
        console.error(error);
        toast.error("Something went wrong");
      } finally {
        setUploading(false);
      }
    },
  });

  return (
    <div className="p-2 bg-white rounded-xl">
      <div
        {...getRootProps({
          className:
            "border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col",
        })}
      >
        <input {...getInputProps()} />
        {uploading || mutation.isPending ? (
          <>
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="mt-2 text-sm text-slate-400">Uploading...</p>
          </>
        ) : (
          <>
            <Inbox className="w-10 h-10 text-blue-500" />
            <p className="mt-2 text-sm text-slate-400">Drop PDF Here</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
