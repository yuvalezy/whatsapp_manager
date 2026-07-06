import type { OutboundAttachment } from '@/types';

/** Read a File/Blob into base64 (no `data:...;base64,` prefix) for the
 *  outbound-attachment JSON transport. */
export function fileToBase64(file: File): Promise<OutboundAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve({
        data: commaIndex >= 0 ? result.slice(commaIndex + 1) : result,
        mimetype: file.type || 'application/octet-stream',
        filename: file.name || undefined,
      });
    };
    reader.readAsDataURL(file);
  });
}
