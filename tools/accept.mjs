#!/usr/bin/env node
/* mechbench · 浏览器验收
 * 用真实 Chrome 打开构建产物，在 3 个宽度下检查布局、插槽、交互，并截图留证。
 * 无第三方依赖：Chrome DevTools Protocol + Node 内置 WebSocket。
 *
 * 用法：
 *   node tools/accept.mjs _template
 *   node tools/accept.mjs double-cylinder-engine --widths 1440,820,390
 *
 * 物品可加 items/<slug>/accept.mjs（一段在页面里执行的 async 函数体，返回 {ok,bad}）。
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, createReadStream } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, networkInterfaces } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PAGE_CHECK = `(async () => {
  const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const ok = [], bad = [];
  const need = (cond, msg) => (cond ? ok : bad).push(msg);
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden'; };
  const text = s => (q(s) ? q(s).textContent.trim() : '');

  need(vis(q('.topbar')), '顶栏渲染');
  need(vis(q('.stage')), '舞台渲染');
  need(vis(q('.coach')), '教练面板渲染');
  need(vis(q('.tray')), '零件盒渲染');
  need(document.title.trim().length > 0, 'title 非空');
  need(text('[data-slot="brand.title"]').length > 0, 'brand.title 已填充');
  need(text('[data-slot="stage.title"]').length > 0, 'stage.title 已填充');
  need(text('[data-slot="coach.title"]').length > 0, 'coach.title 已填充');
  need(qa('.journey li').length >= 1, '关卡进度有节点');
  need(qa('#mlist .card').length >= 1, '零件盒有卡片');
  need(qa('#readout [data-rd]').length >= 1, '读数行已生成');
  need(qa('#readout .row').every(r => r.querySelector('[data-rd]') && r.querySelector('span')?.textContent.trim()), '读数每行都有标签和绑定');
  if (q('#readout').classList.contains('on')) {
    need(qa('#readout [data-rd]').some(b => b.textContent.trim() !== '—'), '可见读数至少有一项已赋值');
  }
  need(qa('[data-slot="stage.tools"] button').length >= 2, '工具栏有按钮');

  const btns = qa('button');
  const visibleBtns = btns.filter(vis);
  need(btns.length >= 3, '按钮数量合理');
  need(visibleBtns.length >= 3 && visibleBtns.every(b => b.textContent.trim() || b.getAttribute('aria-label')), '每个可见按钮都有文字');
  need(qa('.card').every(c => c.querySelector('strong')?.textContent.trim()), '每张卡都有名称');

  need(getComputedStyle(q('#fault')).display === 'none', '没有加载错误横幅');
  const p = q('#progress');
  need(p && Number(p.getAttribute('aria-valuenow')) >= 0 && Number(p.getAttribute('aria-valuemax')) > 0, '进度条 aria 值有效');

  const de = document.documentElement;
  need(de.scrollWidth <= window.innerWidth + 1, '无横向溢出 (' + de.scrollWidth + ' <= ' + window.innerWidth + ')');
  if (window.innerWidth <= 780) need(q('.stage').getBoundingClientRect().height >= 300, '手机上舞台高度够用');

  // 交互：选中 → 装上 → 进度与反馈变化
  const label0 = text('#plabel'), fb0 = text('#feedback');
  const firstCard = q('#mlist .card');
  const firstId = firstCard?.dataset.id;
  firstCard?.click(); await new Promise(r => setTimeout(r, 60));
  need(q('#mlist .card[aria-pressed="true"]')?.dataset.id === firstId, '点卡片进入选中态');
  const socket = q('#socket');
  need(socket && !socket.hidden, '选中后出现「装到这里」');
  socket.click(); await new Promise(r => setTimeout(r, 120));
  need(text('#plabel') !== label0, '装上后进度变化 (' + label0 + ' → ' + text('#plabel') + ')');
  need(text('#feedback') !== fb0, '装上后有反馈文案');

  const undo = q('[data-act="undo"], #undo');
  need(undo && !undo.disabled, '可以撤回');
  undo?.click(); await new Promise(r => setTimeout(r, 80));
  need(text('#plabel') === label0, '撤回后进度还原');

  return { ok, bad, meta: { title: document.title, cards: qa('.card').length, buttons: btns.length,
    // 读数快照：读数错了不会让上面任何一条断言变红，所以把它记进验收报告里好比对
    readouts: Object.fromEntries(qa('[data-rd]').map(b => [b.dataset.rd, b.textContent.trim()])),
    stage: [Math.round(q('.stage').getBoundingClientRect().width), Math.round(q('.stage').getBoundingClientRect().height)],
    scrollW: de.scrollWidth, innerW: window.innerWidth } };
})()`;


const PIXEL_CHECK = `(async () => {
  const ok = [], bad = [];
  const need = (cond, msg) => (cond ? ok : bad).push(msg);
  const st = window.__lab && window.__lab.stage;
  if (!st || !st.probe) return { ok: ['无三维舞台，跳过像素检查'], bad: [] };
  const q = (s) => document.querySelector(s);
  const box = q('.stage').getBoundingClientRect();
  const W = box.width, H = box.height;
  const pr = st.renderer.getPixelRatio() || 1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. 局部放大窗：canvas 上要有画面，而且不能被 DOM 背景盖住
  const ins = q('#inset');
  if (ins && !ins.hidden) {
    const r = ins.getBoundingClientRect();
    const p = await st.probe({ x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height });
    need(p.colors >= 4, '放大窗里有画面（颜色 ' + p.colors + ' 种）');
    need(p.lit > p.w * p.h * 0.02, '放大窗不是空白（非空像素 ' + p.lit + '）');
    const bg = getComputedStyle(ins).backgroundColor;
    const alpha = bg === 'transparent' ? 0 : bg.startsWith('rgba') ? parseFloat(bg.slice(bg.lastIndexOf(',') + 1)) : 1;
    need(alpha === 0, '放大窗背景透明，没盖住 canvas（当前 ' + bg + '）');
  }

  // 2. 剖开 / 实体外观必须真的不一样（否则剖切或材质还原失效）
  const cutBtn = q('[data-tool="cut"]');
  const area = { x: W * 0.25, y: H * 0.2, width: W * 0.5, height: H * 0.6 };
  if (cutBtn) {
    const wasOn = cutBtn.getAttribute('aria-pressed') === 'true';
    if (!wasOn) { cutBtn.click(); await wait(260); }
    const a1 = await st.probe(area);
    cutBtn.click(); await wait(260);
    const a2 = await st.probe(area);
    need(a1.lit > 0 && a2.lit > 0, '舞台上有实体（剖开 ' + a1.lit + ' / 实体 ' + a2.lit + ' 像素）');
    need(Math.abs(a1.lit - a2.lit) > a1.lit * 0.02 || a1.colors !== a2.colors, '剖开确实改变了画面');
    if (wasOn) { cutBtn.click(); await wait(200); }
  }

  return { ok, bad };
})()`;

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.method + ': ' + msg.error.message)) : res(msg.result);
      } else if (msg.method) this.events.push(msg);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  async waitFor(method, timeout = 8000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const i = this.events.findIndex((e) => e.method === method);
      if (i >= 0) return this.events.splice(i, 1)[0];
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  }
}

function launch(port, profile) {
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--force-color-profile=srgb', '--window-size=1440,900', 'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  proc.stderr.on('data', () => {});
  return proc;
}

async function wsUrl(port) {
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('Chrome 未在 15s 内就绪');
}

function openWS(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => res(ws), { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

// 三维物品要 importmap + vendor，必须走 http，不能用 file://
function serve(root) {
  return new Promise((res) => {
    const server = createServer((req, rq) => {
      const p = join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) {
        rq.writeHead(404).end('not found');
        return;
      }
      rq.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
      createReadStream(p).pipe(rq);
    });
    server.listen(0, '127.0.0.1', () => res({ server, port: server.address().port }));
  });
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error('用法: node tools/accept.mjs <slug> [--widths 1440,820,390]');
  const wi = process.argv.indexOf('--widths');
  const widths = wi > 0 ? process.argv[wi + 1].split(',').map(Number) : [1440, 820, 390];

  const file = join(ROOT, 'dist', `${slug}.html`);
  if (!existsSync(file)) throw new Error(`先构建：python3 tools/build.py ${slug}`);

  const extraPath = join(ROOT, 'items', slug, 'accept.mjs');
  const extra = existsSync(extraPath) ? readFileSync(extraPath, 'utf8') : null;

  const outDir = join(ROOT, 'dist', 'accept', slug);
  mkdirSync(outDir, { recursive: true });
  const profile = join(tmpdir(), `mechbench-${process.pid}`);
  const port = 9400 + (process.pid % 400);
  const { server, port: httpPort } = await serve(join(ROOT, 'dist'));
  const chrome = launch(port, profile);

  const report = { slug, when: new Date().toISOString(), viewports: {}, console: [] };
  let failed = 0;

  try {
    const ws = await openWS(await wsUrl(port));
    const cdp = new CDP(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, sessionId);

    await S('Page.enable');
    await S('Runtime.enable');
    await S('Log.enable');

    for (const [w, h] of widths.map((w) => [w, w <= 780 ? 844 : 900])) {
      cdp.events.length = 0;
      await S('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 2, mobile: w <= 780,
      });
      await S('Page.navigate', { url: `http://127.0.0.1:${httpPort}/${slug}.html?debug=1` });
      await cdp.waitFor('Page.loadEventFired');
      await new Promise((r) => setTimeout(r, 450));

      const shot = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(outDir, `${slug}-${w}.png`), Buffer.from(shot.data, 'base64'));

      const r = await S('Runtime.evaluate', { expression: PAGE_CHECK, awaitPromise: true, returnByValue: true });
      let v = r.result?.value;
      if (!v || !Array.isArray(v.bad)) {
        v = { ok: [], bad: ['页面脚本执行失败: ' + (r.exceptionDetails?.text || JSON.stringify(r).slice(0, 300))] };
      }

      if (extra) {
        const e = await S('Runtime.evaluate', {
          expression: `(async () => { ${extra} })()`, awaitPromise: true, returnByValue: true,
        });
        const ev = e.result?.value;
        if (ev) { v.ok.push(...(ev.ok || [])); v.bad.push(...(ev.bad || [])); }
        else v.bad.push('物品自定义验收未返回结果');
      }

      const px = await S('Runtime.evaluate', { expression: PIXEL_CHECK, awaitPromise: true, returnByValue: true });
      const pv = px.result?.value;
      if (pv) { v.ok.push(...(pv.ok || [])); v.bad.push(...(pv.bad || [])); }
      else v.bad.push('像素检查未返回结果');

      // 交互之后的画面（自由实验/拆链条等），和入场截图分开留证
      const shot2 = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(outDir, `${slug}-${w}-after.png`), Buffer.from(shot2.data, 'base64'));

      // 目录页缩略图：藏掉全部 DOM 覆盖层，按模型屏幕包围盒裁 16:10，输出 640px JPEG
      // #inset 必须 display:none：它是在同一个 canvas 里用 scissor 画的第二视角，
      // 只设 visibility:hidden 的话画面上仍然留着那块特写，目录缩略图会多出一个白框。
      const box = await S('Runtime.evaluate', {
        expression: `(() => {
          const r = document.querySelector('.stage').getBoundingClientRect();
          const out = { x: r.x, y: r.y, width: r.width, height: r.height, framed: false };
          const st = window.__lab && window.__lab.stage;
          if (!st || !st.scene || !st.project || !st.camera) return out;
          const seen = o => { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; };
          // 只要零件（挂 userData.key 的组）：台面/背板是舞台背景，不能参与取景
          const isPart = o => { for (let n = o; n; n = n.parent) if (n.userData && n.userData.key) return true; return false; };
          let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          st.scene.updateMatrixWorld(true);
          st.scene.traverse(o => {
            if (!o.isMesh || !o.geometry || !seen(o) || !isPart(o)) return;
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
            lo = [Math.min(lo[0], b.min.x), Math.min(lo[1], b.min.y), Math.min(lo[2], b.min.z)];
            hi = [Math.max(hi[0], b.max.x), Math.max(hi[1], b.max.y), Math.max(hi[2], b.max.z)];
          });
          if (!isFinite(lo[0])) return out;
          const tmp = st.camera.position.clone();
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
            const p = st.project(tmp.set(x, y, z));
            x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
          }
          let cw = Math.max((x1 - x0) * 1.16, 80);
          let ch = Math.max((y1 - y0) * 1.16, 80);
          if (cw / ch < 1.6) cw = ch * 1.6; else ch = cw / 1.6;
          cw = Math.min(cw, r.width); ch = cw / 1.6;
          if (ch > r.height) { ch = r.height; cw = ch * 1.6; }
          const cx = Math.min(Math.max((x0 + x1) / 2, cw / 2), r.width - cw / 2);
          const cy = Math.min(Math.max((y0 + y1) / 2, ch / 2), r.height - ch / 2);
          out.x = r.x + cx - cw / 2; out.y = r.y + cy - ch / 2;
          out.width = cw; out.height = ch; out.framed = true;
          return out;
        })()`,
        returnByValue: true,
      });
      const b = box.result?.value;
      if (w === widths[0] && b && b.width > 10 && b.height > 10) {
        await S('Runtime.evaluate', {
          expression: `(() => {
            const stage = document.querySelector('.stage');
            window.__thumbStyles = [...stage.children].filter(e =>
              e.tagName !== 'CANVAS' && !e.querySelector('canvas') &&
              ['absolute', 'fixed'].includes(getComputedStyle(e).position)
            ).map(e => [e, e.style.cssText]);
            const ins = document.getElementById('inset');
            if (ins && !window.__thumbStyles.some(([e]) => e === ins)) window.__thumbStyles.push([ins, ins.style.cssText]);
            for (const [e] of window.__thumbStyles) e.style.setProperty('display', 'none', 'important');
            return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          })()`, awaitPromise: true,
        });
        const card = await S('Page.captureScreenshot', {
          format: 'jpeg', quality: 84, captureBeyondViewport: false,
          clip: { x: b.x, y: b.y, width: b.width, height: b.height,
                  scale: 640 / (b.width * 2) },
        });
        writeFileSync(join(outDir, `${slug}-card.jpg`), Buffer.from(card.data, 'base64'));
        const decoded = await S('Runtime.evaluate', {
          expression: `(() => {
            const img = new Image();
            return new Promise((resolve, reject) => {
              img.onload = () => {
                for (const [e, css] of window.__thumbStyles) e.style.cssText = css;
                delete window.__thumbStyles;
                const probe = document.createElement('canvas');
                probe.width = 80; probe.height = 50;
                const ctx = probe.getContext('2d');
                ctx.drawImage(img, 0, 0, 80, 50);
                const rgba = ctx.getImageData(0, 0, 80, 50).data;
                const colors = new Set();
                for (let i = 0; i < rgba.length; i += 4) colors.add((rgba[i] >> 4) + ',' + (rgba[i + 1] >> 4) + ',' + (rgba[i + 2] >> 4));
                resolve({width: img.naturalWidth, height: img.naturalHeight, colors: colors.size});
              };
              img.onerror = () => reject(new Error('缩略图 JPEG 解码失败'));
              img.src = 'data:image/jpeg;base64,${card.data}';
            });
          })()`, awaitPromise: true, returnByValue: true,
        });
        const pixels = decoded.result?.value;
        if (!pixels || Math.abs(pixels.width - 640) > 1 || Math.abs(pixels.width / pixels.height - 1.6) > 0.01) {
          v.bad.push('缩略图尺寸错误：需要约 640×400 设备像素');
        } else {
          v.ok.push('缩略图 JPEG 尺寸与 16:10 比例正确');
          (pixels.colors >= 8 ? v.ok : v.bad).push('缩略图包含模型色彩，非空白背景');
        }
        report.thumb = { framed: !!b.framed, ...pixels, unit: 'device-pixel',
          crop: { width: b.width, height: b.height, unit: 'css-pixel' } };
      }

      const errs = cdp.events
        .filter((e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded' ||
          (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
        .map((e) => e.params.exceptionDetails?.text || e.params.entry?.text ||
          (e.params.args || []).map((a) => a.value ?? a.description).join(' '));
      v.bad.push(...errs.map((t) => '控制台错误: ' + t));
      report.console.push(...errs);

      report.viewports[w] = { meta: v.meta, ok: v.ok, bad: v.bad };
      failed += v.bad.length;
      console.log(`  ${w}px  ${v.bad.length ? '✗ ' + v.bad.length + ' 项' : '✓ ' + v.ok.length + ' 项'}  ${v.bad.join(' | ')}`);
    }

    ws.close();
  } finally {
    chrome.kill();
    server.close();
    await new Promise((r) => setTimeout(r, 200));
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }

  writeFileSync(join(outDir, 'acceptance.json'), JSON.stringify(report, null, 2));
  console.log(`\n${failed ? '✗ 未通过' : '✓ 全部通过'} · 报告 dist/accept/${slug}/acceptance.json · 截图 dist/accept/${slug}/`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('验收脚本失败:', e.stack || e.message); process.exit(2); });
