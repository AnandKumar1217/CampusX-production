import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const cloudinaryService = {
  uploadImage: async (buffer: Buffer, userId: string) => {
    return new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "campusx/posts",
          tags: [`user_${userId}`],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  },

  deleteImage: async (publicId: string) => {
    return new Promise<any>((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  },
  
  getAsset: async (publicId: string) => {
    return new Promise<any>((resolve, reject) => {
      cloudinary.api.resource(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
};
