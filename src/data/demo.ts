import type { Device } from '../types';
import { uid } from './storage';
import { compressImage } from '../utils/image';

/** 相对今天回溯的日期（用于生成示例数据，保证示例永远"不过期"） */
function pastDate(yearsAgo: number, month: number, day: number): string {
  const y = new Date().getFullYear() - yearsAgo;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 示例数据的实物照片。放在 public/demo/ 下，随构建产物一起发布。
 * 素材来自 Pexels（免费商用、无需署名），已按 16:10 裁切为 960×600。
 */
const DEMO_PHOTO = {
  iphone15: 'demo/iphone15.jpg',
  macbook: 'demo/macbook.jpg',
  ipad: 'demo/ipad.jpg',
  airpods: 'demo/airpods.jpg',
  band: 'demo/band.jpg',
  mouse: 'demo/mouse.jpg',
  monitor: 'demo/monitor.jpg',
  switch: 'demo/switch.jpg',
  camera: 'demo/camera.jpg',
  redmi: 'demo/redmi.jpg',
  kindle: 'demo/kindle.jpg',
} as const;

type PhotoKey = keyof typeof DEMO_PHOTO;

/** 示例设备定义：图片用 key 引用，稍后统一转成 dataURL */
type DemoSpec = Omit<Device, 'id' | 'createdAt' | 'image'> & { photo: PhotoKey | null };

const SPECS: DemoSpec[] = [
  {
    name: 'iPhone 15 Pro', category: 'phone', price: 7999,
    purchaseDate: pastDate(1, 9, 25), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 4,
    // 保修正好卡在临期窗口、分期还款到一半，用来演示保修提醒与待还金额
    warrantyMonths: 12, photo: 'iphone15',
    loan: { downPayment: 1999, principal: 6000, months: 24, firstPaymentDate: pastDate(1, 10, 25) },
    note: '以旧换新抵了 800，剩下 6000 走 24 期免息',
  },
  {
    name: 'MacBook Air M2', category: 'computer', price: 8999,
    purchaseDate: pastDate(3, 11, 11), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 5,
    warrantyMonths: 24, photo: 'macbook', loan: null,
    note: '双十一教育优惠入的，主力生产力工具，电池健康度还有 89%',
  },
  {
    name: '戴尔 U2723QE 显示器', category: 'display', price: 3699,
    purchaseDate: pastDate(3, 6, 1), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 6,
    warrantyMonths: 36, photo: 'monitor', loan: null,
    note: '4K + Type-C 一线连，写代码眼睛舒服很多',
  },
  {
    name: 'iPad Air 5', category: 'tablet', price: 4399,
    purchaseDate: pastDate(2, 6, 18), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 4,
    warrantyMonths: 12, photo: 'ipad', loan: null,
    note: '看剧 + 记笔记，配了支 Apple Pencil 2',
  },
  {
    name: 'AirPods Pro 2', category: 'audio', price: 1899,
    purchaseDate: pastDate(2, 3, 15), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 3,
    warrantyMonths: 12, photo: 'airpods', loan: null,
    note: '通勤地铁必备，降噪是真香',
  },
  {
    name: '小米手环 8', category: 'wearable', price: 249,
    purchaseDate: pastDate(2, 9, 16), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 2,
    warrantyMonths: 12, photo: 'band', loan: null,
    note: '每天戴着，性价比之王，已经用满预计年限了',
  },
  {
    name: '罗技 MX Master 3S', category: 'peripheral', price: 599,
    purchaseDate: pastDate(2, 3, 10), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 4,
    warrantyMonths: 24, photo: 'mouse', loan: null,
    note: '静音版，横滚轮改代码效率翻倍',
  },
  {
    name: '索尼 A6400', category: 'camera', price: 6999,
    purchaseDate: pastDate(2, 10, 1), status: 'in_use',
    endDate: null, soldPrice: null, expectedYears: 6,
    warrantyMonths: 12, photo: 'camera', loan: null,
    note: '国庆出游前冲动入的，配了适马 30 1.4',
  },
  {
    name: 'Switch OLED', category: 'console', price: 2099,
    purchaseDate: pastDate(1, 5, 20), status: 'idle',
    endDate: null, soldPrice: null, expectedYears: 5,
    warrantyMonths: 24, photo: 'switch', loan: null,
    note: '吃灰中…… 偶尔周末开一下塞尔达',
  },
  {
    name: '红米 K30', category: 'phone', price: 1299,
    purchaseDate: pastDate(4, 6, 1), status: 'sold',
    endDate: pastDate(1, 6, 1), soldPrice: 300,
    expectedYears: 3, warrantyMonths: null, photo: 'redmi', loan: null,
    note: '用了三年多，挂闲鱼出了，回血 300',
  },
  {
    name: 'Kindle Paperwhite 4', category: 'tablet', price: 998,
    purchaseDate: pastDate(5, 11, 11), status: 'retired',
    endDate: pastDate(1, 5, 20), soldPrice: null,
    expectedYears: 4, warrantyMonths: null, photo: 'kindle', loan: null,
    note: '电池鼓包撑不住了，光荣退役（也算物尽其用）',
  },
];

/**
 * 把示例照片加载并压缩成与用户上传完全一致的 base64 dataURL。
 * 走的是同一套 Canvas → WebP 流程，所以能正常参与导出备份 / 云同步；
 * 任何一张拉取失败都只让那张退化成无图卡片，不影响整份示例数据可用。
 */
async function loadPhoto(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const name = path.split('/').pop() ?? 'demo.jpg';
    return await compressImage(new File([blob], name, { type: blob.type }), 720, 0.8);
  } catch {
    return null;
  }
}

/**
 * 一键载入的示例数据：覆盖全部 10 个品类与使用中 / 闲置 / 已出售 / 已报废四种状态，
 * 并带上实物照片、分期、保修、预计年限等多种字段组合，便于快速体验完整功能。
 */
export async function buildDemoDevices(): Promise<Device[]> {
  const now = Date.now();
  const photos = new Map<PhotoKey, string | null>();

  await Promise.all(
    (Object.keys(DEMO_PHOTO) as PhotoKey[]).map(async (key) => {
      photos.set(key, await loadPhoto(DEMO_PHOTO[key]));
    }),
  );

  return SPECS.map((spec, i) => {
    const { photo, ...rest } = spec;
    return {
      ...rest,
      id: uid(),
      image: photo ? (photos.get(photo) ?? null) : null,
      createdAt: now + i,
    };
  });
}
