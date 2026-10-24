#!/usr/bin/env node
/* mechbench · 扫描 items/ 下所有物品，输出目录页要用的元数据 JSON。
 * 用法：node tools/manifest-dump.mjs   （tools/build.py 会自动调用）
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const out = [];

for (const slug of readdirSync(join(root, 'items'))) {
  if (slug.startsWith('_') || slug.startsWith('.')) continue;
  const file = join(root, 'items', slug, 'manifest.mjs');
  if (!existsSync(file)) continue;
  try {
    const { MANIFEST } = await import(pathToFileURL(file).href);
    out.push({
      slug,
      title: MANIFEST.brand?.title || slug,
      subtitle: MANIFEST.brand?.subtitle || '',
      chapters: (MANIFEST.chapters || []).length,
      modules: (MANIFEST.modules || []).length,
      readout: (MANIFEST.readout || []).length,
      has3d: !!MANIFEST.scene,
    });
  } catch (e) {
    out.push({ slug, title: slug, subtitle: 'manifest 读取失败：' + e.message, chapters: 0, modules: 0, has3d: false, error: true });
  }
}

console.log(JSON.stringify(out, null, 2));
