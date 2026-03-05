export type LogoPosition = '左上' | '右上' | '左下' | '右下' | '居中';
export type LogoSize = '小' | '中' | '大';

export const applyLogoToImage = async (
    base64Img: string,
    applyLogo: boolean,
    logoUrl?: string,
    logoSize: LogoSize = '中',
    logoPosition: LogoPosition = '右下'
): Promise<string> => {
    if (!applyLogo || !logoUrl) return base64Img;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(base64Img);

            ctx.drawImage(img, 0, 0);

            const logo = new Image();
            logo.onload = () => {
                const baseSize = Math.min(canvas.width, canvas.height);
                let scale = 0.15; // default '中'
                if (logoSize === '小') scale = 0.08;
                if (logoSize === '大') scale = 0.25;

                const lWidth = baseSize * scale;
                const lHeight = (logo.height / logo.width) * lWidth;

                const margin = baseSize * 0.05;
                let x = 0, y = 0;

                switch (logoPosition) {
                    case '左上': x = margin; y = margin; break;
                    case '右上': x = canvas.width - lWidth - margin; y = margin; break;
                    case '左下': x = margin; y = canvas.height - lHeight - margin; break;
                    case '右下': x = canvas.width - lWidth - margin; y = canvas.height - lHeight - margin; break;
                    case '居中': x = (canvas.width - lWidth) / 2; y = (canvas.height - lHeight) / 2; break;
                }

                ctx.drawImage(logo, x, y, lWidth, lHeight);
                const result = canvas.toDataURL('image/png');
                // Release canvas GPU memory
                canvas.width = 0;
                canvas.height = 0;
                resolve(result);
            };
            logo.onerror = () => { resolve(base64Img); };
            logo.src = logoUrl;
        };
        img.onerror = () => {
            resolve(base64Img);
        };
        img.src = base64Img;
    });
};
