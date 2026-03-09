import { downloadFile } from '@shared/utils/download';

export const sanitizeFilename = (name: string) => {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
};

export const downloadImage = (base64Data: string, filename: string) => {
    downloadFile(base64Data, filename);
};
