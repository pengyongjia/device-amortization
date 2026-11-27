import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../auth';
import { getSyncDoc, saveSyncDoc } from '../db';

export const syncRoutes = new Hono<AuthEnv>();

/** 拉取云端数据（未同步过时 data 为 null） */
syncRoutes.get('/', requireAuth, (c) => {
  const doc = getSyncDoc(c.get('userId'));
  if (!doc) return c.json({ data: null, updatedAt: null, revision: 0 });
  return c.json({
    data: JSON.parse(doc.data) as unknown,
    updatedAt: doc.updated_at,
    revision: doc.revision,
  });
});

/**
 * 上传（覆盖式）。携带 baseUpdatedAt 做乐观并发检测：
 * 如果云端在 baseUpdatedAt 之后被其他设备更新过 → 返回 409 + 云端数据，由客户端决定保留哪份。
 */
syncRoutes.put('/', requireAuth, async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    data?: unknown;
    baseUpdatedAt?: unknown;
  } | null;
  // 兼容两种载荷：v2 对象 { version, devices, loans } 与早期 Device[] 数组
  const isValidData =
    !!body &&
    (Array.isArray(body.data) || (typeof body.data === 'object' && body.data !== null));
  if (!isValidData) {
    return c.json({ error: 'bad_data', message: '数据格式不正确' }, 400);
  }

  const baseUpdatedAt = typeof body.baseUpdatedAt === 'number' ? body.baseUpdatedAt : null;
  const doc = getSyncDoc(c.get('userId'));

  if (doc && baseUpdatedAt !== null && doc.updated_at > baseUpdatedAt) {
    return c.json(
      {
        error: 'conflict',
        message: '云端数据已在其他设备上更新',
        server: { data: JSON.parse(doc.data) as unknown, updatedAt: doc.updated_at, revision: doc.revision },
      },
      409,
    );
  }

  const { updatedAt, revision } = saveSyncDoc(c.get('userId'), JSON.stringify(body.data));
  return c.json({ ok: true, updatedAt, revision });
});
