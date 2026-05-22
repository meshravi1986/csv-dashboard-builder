"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useUploadStore } from "@/stores/upload-store";
import { api } from "@/services/api";

export default function UploadPage() {
  const router = useRouter();
  const { file, progress, status, error, setFile, setProgress, setStatus, setError, setDatasetId, reset } = useUploadStore();
  const [columnMatch, setColumnMatch] = useState<any>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionTag, setVersionTag] = useState("");
  const [versionCreating, setVersionCreating] = useState(false);

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

        if (result.column_match) {
          setColumnMatch(result.column_match);
          setShowVersionModal(true);
        } else {
          router.push(`/profile?dataset_id=${result.dataset_id}`);
        }
      } catch (err: any) {
        setError(err.message || "Upload failed");
        setStatus("error");
      }
    },
    [router, setFile, setProgress, setStatus, setError, setDatasetId]
  );

  const handleCreateVersion = async () => {
    if (!columnMatch) return;
    setVersionCreating(true);
    try {
      const store = useUploadStore.getState();
      const dsId = store.dataset_id;
      if (!dsId) return;
      const result = await api.createDashboardVersion(
        columnMatch.dashboard_id,
        dsId,
        versionTag || `v${(columnMatch.version_number || 0) + 1}`
      );
      router.push(`/dashboard/${result.id}`);
    } catch (err: any) {
      setError(err.message || "Version creation failed");
      setShowVersionModal(false);
    } finally {
      setVersionCreating(false);
    }
  };

  const handleNewDashboard = () => {
    const store = useUploadStore.getState();
    if (store.dataset_id) {
      router.push(`/profile?dataset_id=${store.dataset_id}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
    disabled: status === "uploading",
  });

  if (showVersionModal && columnMatch) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Matching Dataset Found</h2>
              <p className="text-sm text-slate-500">
                This file has the same columns as &quot;{columnMatch.dashboard_title}&quot;
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Would you like to create a new version of the existing dashboard (reusing its layout, metrics, and chart types) or set up a brand new dashboard from scratch?
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Version Tag <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                placeholder="e.g. Monthly Refresh"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreateVersion}
                disabled={versionCreating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {versionCreating ? "Creating..." : "Create Version"}
              </button>
              <button
                onClick={handleNewDashboard}
                disabled={versionCreating}
                className="flex-1 px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                New Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                Upload complete!
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
