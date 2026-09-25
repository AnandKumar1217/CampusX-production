import { Router } from "express";
import multer from "multer";
import { AppError, asyncHandler, sendSuccess } from "../utils/http.js";
import { cloudinaryService } from "../services/cloudinary.js";
import { Post } from "../models/Social.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

export const uploadRouter = Router();

uploadRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) {
      throw new AppError(400, "No file uploaded", "FILE_REQUIRED");
    }

    if (!request.file.mimetype.startsWith("image/")) {
      throw new AppError(400, "Only image uploads are allowed", "INVALID_FILE_TYPE");
    }

    let result;
    try {
      result = await cloudinaryService.uploadImage(request.file.buffer, request.user!._id.toString());
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw new AppError(500, "Cloudinary upload failed", "UPLOAD_FAILED");
    }

    return sendSuccess(response, {
      url: result.secure_url,
      publicId: result.public_id,
      type: "image",
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    }, "File uploaded successfully");
  }),
);

uploadRouter.delete(
  "/:publicId",
  asyncHandler(async (request, response) => {
    const publicId = request.params.publicId as string;
    if (!publicId) throw new AppError(400, "Missing publicId");
    const asset = await cloudinaryService.getAsset(publicId).catch(() => null);
    if (!asset) {
      throw new AppError(404, "Asset not found", "NOT_FOUND");
    }

    if (!asset.tags || !asset.tags.includes(`user_${request.user!._id}`)) {
      throw new AppError(403, "Not authorized to delete this asset", "FORBIDDEN");
    }

    const isUsed = await Post.exists({ "media.publicId": publicId });
    const isUsedInEvent = await import("../models/Commerce.js").then(m => m.Event.exists({ imagePublicId: publicId }));
    if (isUsed || isUsedInEvent) {
      throw new AppError(400, "Asset is attached to a post or event and cannot be deleted here", "IN_USE");
    }

    await cloudinaryService.deleteImage(publicId);
    return sendSuccess(response, null, "Asset deleted");
  }),
);
