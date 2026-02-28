export const sanitizeFilename = (name: string) => {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
};

export const downloadImage = (base64Data: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
