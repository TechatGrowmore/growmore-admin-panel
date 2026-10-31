// Shrinks phone photos in the browser before upload (PDFs and tiny images are returned unchanged).
export async function compressImage(file, { maxSize = 1600, quality = 0.8 } = {}) {
  try {
    if (!file || !file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 200 * 1024) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // unsupported format: upload the original
  }
}
