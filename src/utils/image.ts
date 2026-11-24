/**
 * 将用户选择的图片压缩为适合存入 localStorage 的 base64 dataURL。
 * - 最长边缩放到 maxSide（默认 720px）
 * - 优先输出 WebP（体积更小），不支持时回退 JPEG
 */
export function compressImage(file: File, maxSide = 720, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('不是有效的图片文件'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法创建绘图上下文');
        ctx.drawImage(img, 0, 0, w, h);

        let data = canvas.toDataURL('image/webp', quality);
        if (!data.startsWith('data:image/webp')) {
          data = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(data);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('图片处理失败'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/**
 * 把已经是 dataURL 的图片重新压到更小，用于释放本地存储空间（「一键瘦身」）。
 * 只有在确实变小时才返回新值，否则返回 null —— 调用方保持原图不动。
 * dataURL 是同源内联数据，不会污染 canvas，可安全 toDataURL。
 */
export function recompressDataUrl(
  dataUrl: string,
  maxSide = 640,
  quality = 0.7,
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        let out = canvas.toDataURL('image/webp', quality);
        if (!out.startsWith('data:image/webp')) {
          out = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(out.length < dataUrl.length ? out : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
