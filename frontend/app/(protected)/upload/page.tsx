"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useUploadStore } from "@/stores/upload-store";
import { api } from "@/services/api";

export default function UploadPage() {
  const router = useRouter();
  const { file, progress, status, error, setFile, setProgress, setStatus, setError, setDatasetId, reset } = useUploadStore();

  useEffect(() => { reset(); }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles[0];
      if (!f) return;
      if (!f.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }
      setFile(f);
      setStatus("uploading");
      setProgress(0);
      setError(undefined);

      try {
        const result = await api.uploadCSV(f, (progress) => {
          setProgress(progress);
        });
        setDatasetId(result.dataset_id);
        setStatus("complete");
        router.push(`/profile?dataset_id=${result.dataset_id}`);
      } catch (err: any) {
        setError(err.message || "Upload failed");
        setStatus("error");
      }
    },
    [router, setFile, setProgress, setStatus, setError, setDatasetId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    disabled: status === "uploading",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Upload your CSV
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Drag and drop a CSV file to get started. Max 100MB.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-slate-900 bg-slate-50"
            : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50"
        } ${status === "uploading" ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
            <svg
              className="w-8 h-8 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {status === "uploading" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">
                Uploading... {progress}%
              </p>
              <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-2">
                <div
                  className="bg-slate-900 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {file && (
                <p className="text-xs text-slate-400">{file.name}</p>
              )}
            </div>
          ) : status === "complete" ? (
            <div className="space-y-2">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                <svg
                  className="w-4 h-4 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-600">
                Upload complete! Redirecting...
              </p>
            </div>
          ) : error ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-600">{error}</p>
              <p className="text-xs text-slate-400">
                Try again with a valid CSV file
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">
                {isDragActive
                  ? "Drop your CSV here"
                  : "Drag & drop your CSV file here"}
              </p>
              <p className="text-xs text-slate-400">
                or click to browse files
              </p>
              <p className="text-xs text-slate-300">
                Supports .csv files up to 100MB
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
