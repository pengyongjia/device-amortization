import { STATUSES, getCategory } from '../constants';
import type { Device, DeviceCalc } from '../types';
import { fmtCost, fmtDays, fmtMoney } from './format';

/**
 * 设备成本分享卡（Canvas 手绘，750×1000，适合手机端分享）。
 * 生成当前设备的成本数据图：名称、日均成本、已用天数、购入价、保修状态等。
 */

const W = 750;
const H = 1000;
const PAD = 56;
const FONT = '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif';

export async function generateShareImage(device: Device, calc: DeviceCalc): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  /* ===== 顶部品牌 ===== */
  roundRect(ctx, PAD, PAD, 52, 52, 14);
  ctx.fillStyle = '#0a2540';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('¥', PAD + 26, PAD + 36);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a2540';
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText('设备摊销', PAD + 72, PAD + 22);
  ctx.fillStyle = '#9aa8ba';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('每个设备都有它的日成本', PAD + 72, PAD + 48);

  /* ===== 设备图片 / 占位 ===== */
  const imgX = PAD;
  const imgY = 150;
  const imgW = W - PAD * 2;
  const imgH = 360;

  async function drawImageArea() {
    roundRect(ctx!, imgX, imgY, imgW, imgH, 20);
    if (device.image) {
      try {
        const img = await loadImage(device.image);
        ctx!.save();
        ctx!.clip();
        drawCover(ctx!, img, imgX, imgY, imgW, imgH);
        ctx!.restore();
        return;
      } catch {
        /* 加载失败则退化为占位 */
      }
    }
    // 占位：浅灰渐变 + 大号 ¥ + 分类名
    const grad = ctx!.createLinearGradient(imgX, imgY, imgX + imgW, imgY + imgH);
    grad.addColorStop(0, '#f2f5f8');
    grad.addColorStop(1, '#e9eef4');
    ctx!.fillStyle = grad;
    ctx!.fill();
    ctx!.fillStyle = '#c6d0da';
    ctx!.textAlign = 'center';
    ctx!.font = `600 104px ${FONT}`;
    ctx!.fillText('¥', W / 2, imgY + imgH / 2 + 6);
    ctx!.fillStyle = '#9aa8ba';
    ctx!.font = `20px ${FONT}`;
    ctx!.fillText(getCategory(device.category).name, W / 2, imgY + imgH / 2 + 74);
    ctx!.textAlign = 'left';
  }
  await drawImageArea();

  /* ===== 主信息 ===== */
  let y = imgY + imgH + 58;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a2540';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(fitText(ctx, device.name, W - PAD * 2), PAD, y);

  y += 40;
  ctx.fillStyle = '#6b7c93';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`${getCategory(device.category).name} · ${STATUSES[device.status].name}`, PAD, y);

  y += 76;
  const bigText = fmtCost(calc.dailyCost);
  ctx.fillStyle = '#0a2540';
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText(bigText, PAD, y);
  const bigW = ctx.measureText(bigText).width;
  ctx.fillStyle = '#6b7c93';
  ctx.font = `26px ${FONT}`;
  ctx.fillText('/天', PAD + bigW + 14, y);

  y += 42;
  ctx.fillStyle = '#9aa8ba';
  ctx.font = `20px ${FONT}`;
  ctx.fillText(`≈ ${fmtMoney(calc.monthlyCost)}/月 · 已陪伴 ${fmtDays(calc.usedDays)}`, PAD, y);

  /* ===== 信息条（三格） ===== */
  const infoY = 792;
  const infoH = 96;
  roundRect(ctx, PAD, infoY, W - PAD * 2, infoH, 16);
  ctx.fillStyle = '#f6f8fa';
  ctx.fill();

  const colX = [PAD + 28, PAD + 252, PAD + 476];
  const labels = ['购入价', '购买日期', calc.warranty ? '保修剩余' : '折合月均'];
  const values = [
    fmtMoney(device.price),
    device.purchaseDate,
    calc.warranty
      ? calc.warranty.status === 'expired'
        ? '已过保'
        : `${calc.warranty.daysLeft} 天`
      : fmtMoney(calc.monthlyCost),
  ];
  labels.forEach((label, i) => {
    ctx!.fillStyle = '#9aa8ba';
    ctx!.font = `16px ${FONT}`;
    ctx!.fillText(label, colX[i], infoY + 34);
    ctx!.fillStyle =
      i === 2 && calc.warranty && calc.warranty.status === 'expiring' ? '#c47f17' : '#0a2540';
    ctx!.font = `600 22px ${FONT}`;
    ctx!.fillText(values[i], colX[i], infoY + 66);
  });

  /* ===== 底部 ===== */
  ctx.fillStyle = '#9aa8ba';
  ctx.font = `18px ${FONT}`;
  ctx.fillText('用得越久，越便宜', PAD, H - 42);
  ctx.textAlign = 'right';
  ctx.fillText('设备摊销 · 开源免费', W - PAD, H - 42);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('生成图片失败'))), 'image/png');
  });
}

/* ================= 绘制辅助 ================= */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

/** 按 cover 方式将图片绘制到目标区域（居中裁剪） */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** 文字超长时截断并加省略号 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}
