/**
 * Upload Handler - Handle file uploads to R2
 */

import type { Env } from "../index";

// Allowed MIME types for uploads
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface UploadedFile {
  originalName: string;
  filename: string;
  r2Key: string;
  size: number;
  mimetype: string;
  url: string;
  path: string; // Container-accessible path for agent to use
}

/**
 * Handle multipart file upload
 */
export async function handleUpload(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const contentType = request.headers.get("Content-Type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return Response.json(
        { success: false, error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files: File[] = [];

    for (const entry of formData.getAll("images")) {
      // FormData entries can be File or string - we only want Files
      if (typeof entry !== "string" && "arrayBuffer" in entry) {
        files.push(entry as File);
      }
    }

    if (files.length === 0) {
      return Response.json(
        { success: false, error: "No files uploaded" },
        { status: 400 }
      );
    }

    // Validate file count
    if (files.length > 10) {
      return Response.json(
        { success: false, error: "Maximum 10 files allowed" },
        { status: 400 }
      );
    }

    const uploadedFiles: UploadedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type (${file.type})`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      // Generate unique filename
      const ext = file.name.substring(file.name.lastIndexOf("."));
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const filename = `${uniqueSuffix}${ext}`;
      const r2Key = `uploads/${filename}`;

      // Upload to R2
      try {
        const arrayBuffer = await file.arrayBuffer();
        await env.STORAGE.put(r2Key, arrayBuffer, {
          httpMetadata: {
            contentType: file.type,
          },
          customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        });

        uploadedFiles.push({
          originalName: file.name,
          filename,
          r2Key,
          size: file.size,
          mimetype: file.type,
          url: `/uploads/${filename}`,
          path: `/storage/uploads/${filename}`, // Container-accessible path
        });

        console.log(`Uploaded: ${file.name} -> ${r2Key}`);
      } catch (uploadError: any) {
        errors.push(`${file.name}: Upload failed - ${uploadError.message}`);
      }
    }

    // Return results
    if (uploadedFiles.length === 0) {
      return Response.json(
        { success: false, error: "All uploads failed", errors },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      count: uploadedFiles.length,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
