"use client";

import { useState } from "react";
import { PortalUpload } from "@/generated/prisma/client";

export default function PortalUploadPanel({
  token,
  existingUploads,
}: {
  token: string;
  existingUploads: PortalUpload[];
}) {
  const [uploads, setUploads] = useState<PortalUpload[]>(existingUploads);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Max 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get Presigned URL
      const res = await fetch(`/api/portal/${token}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!res.ok) throw new Error("Failed to get presigned URL");
      const { uploadUrl, uploadRecord } = await res.json();

      // 2. Upload directly to S3
      const s3Res = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!s3Res.ok) throw new Error("Failed to upload file to S3");

      // 3. Update local state
      setUploads((prev) => [uploadRecord, ...prev]);
    } catch (err) {
      console.error(err);
      alert("Error uploading document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-xl font-semibold flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Upload Photos or Documents
      </h2>
      
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Share photos of damage or issues with the shop before you arrive.
      </p>

      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isUploading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Uploading...</p>
            ) : (
              <>
                <svg
                  className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 20 16"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                  />
                </svg>
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG or PDF (MAX. 10MB)
                </p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/png, image/jpeg, application/pdf"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-sm font-medium">{u.fileName}</span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {(u.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
