/**
 * Image upload utilities for various free hosting services
 */

import axios from 'axios';
import FormData from 'form-data';
import { parseRedditError } from './error-handler.js';

export interface ImageUploadResult {
  url: string;
  delete_url?: string;
  service: 'catbox' | 'imgbb';
}

/**
 * Upload image to Catbox.moe (permissionless, free, no API key needed)
 * @param imageBuffer - Image data as Buffer
 * @param filename - Original filename with extension
 * @returns URL to uploaded image
 */
export async function uploadToCatbox(imageBuffer: Buffer, filename: string): Promise<ImageUploadResult> {
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', imageBuffer, {
      filename: filename,
      contentType: getContentType(filename),
    });

    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    return {
      url: response.data.trim(),
      service: 'catbox',
    };
  } catch (error) {
    throw parseRedditError(error);
  }
}

/**
 * Upload image to ImgBB (requires free API key)
 * Get API key at: https://api.imgbb.com/
 * @param imageBuffer - Image data as Buffer
 * @param apiKey - ImgBB API key
 * @returns URL to uploaded image
 */
export async function uploadToImgBB(imageBuffer: Buffer, apiKey: string): Promise<ImageUploadResult> {
  try {
    const base64Image = imageBuffer.toString('base64');

    const formData = new FormData();
    formData.append('image', base64Image);

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    return {
      url: response.data.data.url,
      delete_url: response.data.data.delete_url,
      service: 'imgbb',
    };
  } catch (error) {
    throw parseRedditError(error);
  }
}

/**
 * Upload image using the best available service
 * Tries Catbox first (no API key), falls back to ImgBB if API key is provided
 * @param imageBuffer - Image data as Buffer
 * @param filename - Original filename with extension
 * @param imgbbApiKey - Optional ImgBB API key
 * @returns Upload result with URL
 */
export async function uploadImage(
  imageBuffer: Buffer,
  filename: string,
  imgbbApiKey?: string
): Promise<ImageUploadResult> {
  // Try Catbox first (permissionless, free)
  try {
    return await uploadToCatbox(imageBuffer, filename);
  } catch (catboxError) {
    console.warn('Catbox upload failed, trying ImgBB...', catboxError);

    // Fallback to ImgBB if API key is provided
    if (imgbbApiKey) {
      return await uploadToImgBB(imageBuffer, imgbbApiKey);
    }

    throw new Error('Image upload failed and no ImgBB API key provided for fallback');
  }
}

/**
 * Determine content type from filename extension
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}
