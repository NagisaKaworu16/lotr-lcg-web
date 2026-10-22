/* 卡牌悬停放大预览（参考诡镇奇谈网页版）。
 * 原则：只读 DOM 截图，不写游戏状态；不移动原卡布局；放大层不拦截指针事件。
 * 三种触发源：
 *   1. <button class="card-face"> 内的 <img>：桌面上的英雄／盟友／附属／手牌／交战敌人。
 *   2. image-ui.js 的 .card-art 内的 <img>：当前探险卡、卡图库缩略图、展开后的详情卡图。
 *   3. 密集列表的卡名行 [data-hover-src]：卡牌库与牌组构建器。这些行为了不一次加载上百张图
 *      并没有 <img>，悬停时按 data-hover-src 现取一张大图（形状由 data-hover-shape 给出）。
 * 开局页的剧本封面（.ng-card-art）不是卡牌，悬停不放大。
 */
const CardHoverPreview = (() => {
  const SHOW_DELAY = 130;     // 悬停停留多久才弹出，避免横扫时闪烁
  const HIDE_DELAY = 90;      // 移开后延迟收起，允许鼠标短暂划过间隙
  const GAP = 14;
  // 参照 RingsDB 的悬停预览：卡片缩到「能看清字」的大小就够，不做近全屏放大。
  // 竖版 300 宽约 424 高、横版 400 宽约 283 高，再按视口收紧，最多占半屏高。
  const TALL_W = 300;
  const WIDE_W = 400;
  const MAX_H = 0.58;         // 最高占视口比例
  const MAX_W = 0.26;         // 最宽占视口比例
  const MAX_W_PX = 380;

  let layer = null, img = null, box = null, timer = 0, raf = 0;
  let cur = null;             // {src, alt, natural, ratio, rect}

  const isFace = el => el.matches('.card-face img, .card-art img');
  const isProbe = el => !!(el.hasAttribute && el.hasAttribute('data-hover-src'));
  const live = el => el && el.isConnected && !el.closest('dialog[open]');

  function srcOf(t) { return isProbe(t) ? t.getAttribute('data-hover-src') : (t.currentSrc || t.src); }
  // 探针没有真实图片可量，形状由标记给出：竖版 300×424，横版探险卡 400×283
  function shapeOf(t) {
    const s = t.getAttribute && t.getAttribute('data-hover-shape');
    return s === 'wide' ? { w: WIDE_W, h: Math.round(WIDE_W * 424 / 600) } : s === 'tall' ? { w: TALL_W, h: Math.round(TALL_W * 600 / 424) } : null;
  }

  function ensure() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'card-hover-layer';
    layer.setAttribute('aria-hidden', 'true');
    img = document.createElement('img');
    img.className = 'card-hover-img';
    img.alt = '';
    img.decoding = 'async';
    box = document.createElement('div');
    box.className = 'card-hover-box';
    layer.appendChild(box);
    box.appendChild(img);
    document.body.appendChild(layer);
    return layer;
  }

  function measure() {
    if (!img || !cur) return null;
    const vw = window.innerWidth, vh = window.innerHeight;
    const maxW = Math.min(vw * MAX_W, MAX_W_PX);
    const maxH = vh * MAX_H;
    // 基准宽度由形状决定，比例取自真实图片或 data-hover-shape；只缩不放
    const shape = cur.ratio || (cur.natural.w && cur.natural.h ? { w: cur.natural.w, h: cur.natural.h } : null);
    let w, h;
    if (shape && shape.w && shape.h) {
      w = shape.w > shape.h ? WIDE_W : TALL_W;
      h = Math.round(w * shape.h / shape.w);
    } else { w = TALL_W; h = Math.round(TALL_W * 600 / 424); }
    const scale = Math.min(1, maxW / w, maxH / h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function place() {
    const size = measure();
    if (!size || !box) return;
    const r = cur.rect;
    const vw = window.innerWidth, vh = window.innerHeight;
    box.style.width = size.w + 'px';
    box.style.height = size.h + 'px';
    // 横向：优先贴在触发元素右侧，右不够放左侧；都放不下就压回视口内
    const rail = document.querySelector('.tabletop-rail, .ng-list, aside');
    const railLeft = rail && rail.getBoundingClientRect().left > r.left + r.width ? rail.getBoundingClientRect().left : Infinity;
    const edgeRight = Math.min(vw, railLeft) - GAP;
    const spaceRight = edgeRight - r.right;
    const spaceLeft = r.left - GAP;
    let left, originX;
    if (spaceRight >= size.w) { left = r.right + GAP; originX = '0%'; }
    else if (spaceLeft >= size.w) { left = r.left - GAP - size.w; originX = '100%'; }
    else if (spaceRight >= spaceLeft) { left = Math.max(GAP, edgeRight - size.w); originX = '0%'; }
    else { left = Math.max(GAP, r.left - GAP - size.w); originX = '100%'; }
    left = Math.min(Math.max(GAP, left), vw - size.w - GAP);
    // 纵向：与触发元素垂直居中，看起来是「从这一行长出来」，再夹进视口
    const anchorY = r.top + r.height / 2;
    let top = anchorY - size.h / 2;
    top = Math.min(Math.max(GAP, top), vh - size.h - GAP);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    // 从贴近触发元素的那一侧、对应它的垂直位置展开
    const originY = Math.min(Math.max(0, anchorY - top), size.h);
    box.style.transformOrigin = originX + ' ' + Math.round(originY) + 'px';
  }

  function show(target) {
    if (!live(target)) return;
    const src = srcOf(target);
    if (!src) return;
    const rect = target.getBoundingClientRect();
    if (cur && cur.src === src) { cur.rect = rect; place(); return; }
    ensure();
    const probe = isProbe(target);
    cur = {
      src,
      alt: target.alt || '',
      natural: probe ? { w: 0, h: 0 } : { w: target.naturalWidth, h: target.naturalHeight },
      ratio: probe ? shapeOf(target) : null,
      rect
    };
    // 横版探险卡按容器形状还原，避免被竖版比例拉变形
    const art = target.closest && target.closest('.quest-card-art, .quest-display');
    if (art && cur.natural.w > cur.natural.h) cur.ratio = { w: cur.natural.w, h: cur.natural.h };
    // 探针第一次载入这张图，只有 onload 后才能拿到真实比例
    img.onload = probe ? () => {
      if (!cur || cur.src !== src) return;
      const nat = { w: img.naturalWidth, h: img.naturalHeight };
      if (nat.w && nat.h) { cur.natural = nat; if (!cur.ratio) place(); }
    } : null;
    img.src = src;
    img.alt = cur.alt;
    place();
    layer.classList.add('on');
    document.documentElement.classList.add('has-card-preview');
  }

  function hide() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    cur = null;
    if (layer) layer.classList.remove('on');
    document.documentElement.classList.remove('has-card-preview');
  }

  function schedule(target) {
    clearTimeout(timer);
    if (cur) { show(target); return; }
    timer = setTimeout(() => show(target), SHOW_DELAY);
  }

  function onOver(e) {
    const t = e.target;
    const face = t?.closest && t.closest('.card-face, .card-art');
    const pic = face && face.querySelector('img');
    if (face && pic && isFace(pic) && !face.closest('dialog[open]')) { schedule(pic); return; }
    // 卡名行：已经展开的行不再重复弹图（正文里本来就有卡图）
    const probe = t?.closest && t.closest('[data-hover-src]');
    if (probe && !probe.closest('dialog[open]') && !probe.closest('details[open]')) { schedule(probe); return; }
    if (cur) scheduleHide();
  }

  function scheduleHide() {
    clearTimeout(timer);
    timer = setTimeout(hide, HIDE_DELAY);
  }

  function reposition() {
    if (!cur) return;
    const still = document.querySelector('.card-face:hover img, .card-art:hover img, [data-hover-src]:hover');
    if (still) { cur.rect = still.getBoundingClientRect(); place(); }
    else hide();
  }

  function bind() {
    if (bind.done) return;
    bind.done = true;
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerout', e => {
      const from = e.target?.closest?.('.card-face, .card-art, [data-hover-src]');
      if (from && !from.contains(e.relatedTarget)) scheduleHide();
    }, { passive: true });
    document.addEventListener('pointerdown', hide, { passive: true, capture: true });
    window.addEventListener('scroll', () => {
      if (!cur) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(reposition);
    }, { passive: true, capture: true });
    window.addEventListener('resize', hide, { passive: true });
    // Esc 立即收起，避免盖住正在处理的弹窗
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    // 打开任何对话框时收起，绝不遮挡关键界面
    document.addEventListener('toggle', e => { if (e.target?.matches?.('dialog[open]')) hide(); }, true);
    if (window.matchMedia) {
      const mq = window.matchMedia('(hover: none)');
      const apply = () => { if (mq.matches) hide(); };
      mq.addEventListener?.('change', apply);
    }
  }

  return { bind, hide, show: () => {}, get active() { return !!cur; } };
})();

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', CardHoverPreview.bind);
  else CardHoverPreview.bind();
}
if (typeof module !== 'undefined') module.exports = CardHoverPreview;
