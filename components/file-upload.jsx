"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MAX_IMAGE_SIZE_MB } from "@/lib/constants";
import { CloudUpload } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

export const UploadDropzone = (props) => {
  const { isMulti = false, label, onUpload, disabled = false, maxSizeMB = MAX_IMAGE_SIZE_MB } = props;

  const [droppedFiles, setDroppedFiles] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const intervalRef = useRef(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Upload progress utility
  const startSimulatedProgress = () => {
    setUploadProgress(0);

    intervalRef.current = setInterval(() => {
      setUploadProgress((prevProgress) => {
        if (prevProgress >= 95) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return prevProgress;
        }
        return prevProgress + 5;
      });
    }, 500);
  };

  const resetUploadState = () => {
    setIsUploading(false);
    setUploadProgress(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (disabled) return;
    
    setIsUploading(true);
    startSimulatedProgress();

    try {
      setDroppedFiles(acceptedFiles);
      setUploadProgress(100);
      
      // Clear interval before calling onUpload
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      onUpload(acceptedFiles);
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      // Always reset uploading state
      // Small delay to show 100% progress briefly
      setTimeout(() => {
        resetUploadState();
      }, 500);
    }
  }, [disabled, onUpload]);

  const { getRootProps, getInputProps, fileRejections } = useDropzone({
    onDrop,
    multiple: isMulti,
    disabled: disabled || isUploading,
  });

  useEffect(() => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      const errorMessage = rejection.errors?.[0]?.message || "File rejected";
      toast.error(errorMessage);
    }
  }, [fileRejections]);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "mt-3 flex cursor-pointer items-center justify-center rounded-md border border-dashed p-3 py-12 hover:bg-muted/30",
        (isUploading || disabled) ? "pointer-events-none !cursor-not-allowed opacity-80" : ""
      )}
    >
      <input multiple={isMulti} {...getInputProps()} disabled={isUploading || disabled} />
      <div className="flex flex-col items-center gap-3 text-center !text-[#858585]">
        <CloudUpload size={48} className="text-gray-600" />
        <h4 className="!font-normal !text-[#858585]">
          <span className="font-semibold text-black underline">
            Click to upload
          </span>{" "}
          or drag and drop <br />
          Maximum file size {maxSizeMB} MB.
        </h4>
        {isUploading && (
          <div className="mx-auto mt-4 w-full max-w-xs">
            <Progress
              value={uploadProgress}
              className="h-1 w-full bg-zinc-200"
            />
          </div>
        )}
      </div>
    </div>
  );
};
