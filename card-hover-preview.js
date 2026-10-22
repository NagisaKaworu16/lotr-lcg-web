/* 卡牌悬停放大预览（参考诡镇奇谈网页版）。
 * 原则：只读 DOM 截图，不写游戏状态；不移动原卡布局；放大层不拦截指针事件。
 * 只对「卡牌」生效：<button class="card-face"> 内的 <img>，或 image-ui.js 的 .card-art 内的 <img>。
 * 开局页的剧本封面（.ng-card-art）不是卡牌，悬停不放大。
 */
const CardHoverPreview = (() => {
  const SHOW_DELAY = 130;     // 悬停停留多久才弹出，避免横扫时闪烁
  const HIDE_DELAY = 90;      // 移开后延迟收起，允许鼠标短暂划过间隙
  const GAP = 16;
  const MAX_H = 0.9;          // 放大卡最高占视口比例
  const MAX_W = 0.42;

  let layer = null, img = null, box = null, timer = 0, raf = 0;
  let cur = null;             // {src, alt, natural, ratio, rect}
  let axis = 'x';             // 本次显示用横向还是纵向对齐

  const isFace = el => el.matches('.card-face img, .card-art img');
  const live = el => el && el.isConnected && !el.closest('dialog[open]');

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
    const maxW = Math.min(vw * MAX_W, 560);
    const maxH = vh * MAX_H;
    let w = cur.natural.w || 424, h = cur.natural.h || 600;
    // 竖版一律按 424 宽计算版心（中文卡图像素偏小，仍按标准卡面尺寸放大）
    if (cur.ratio) { h = w * cur.ratio.h / cur.ratio.w; }
    else if (cur.natural.w > cur.natural.h) { w = 600; h = Math.round(600 * cur.natural.h / cur.natural.w); }
    else { w = 424; h = Math.round(424 * (cur.natural.h || 600) / (cur.natural.w || 424)); }
    const scale = Math.min(maxW / w, maxH / h);
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function place() {
    const size = measure();
    if (!size || !box) return;
    const r = cur.rect;
    const vw = window.innerWidth, vh = window.innerHeight;
    box.style.width = size.w + 'px';
    box.style.height = size.h + 'px';
    // 横向：先算两侧可用空隙（右侧要扣掉阶段／日志侧栏），选更宽的一侧
    const rail = document.querySelector('.tabletop-rail, .ng-list, aside');
    const railLeft = rail && rail.getBoundingClientRect().left > r.left + r.width ? rail.getBoundingClientRect().left : Infinity;
    const edgeRight = Math.min(vw, railLeft) - GAP;
    const spaceRight = edgeRight - r.right;
    const spaceLeft = r.left - GAP;
    let left;
    if (spaceRight >= size.w) { left = r.right + GAP; axis = 'x'; }
    else if (spaceLeft >= size.w) { left = r.left - GAP - size.w; axis = 'x'; }
    else if (spaceRight >= spaceLeft && spaceRight >= size.w * 0.55) { left = Math.min(r.right + GAP, edgeRight - size.w); axis = 'x'; }
    else if (spaceLeft >= spaceRight && spaceLeft >= size.w * 0.55) { left = Math.max(GAP, r.left - GAP - size.w); axis = 'x'; }
    else { left = Math.min(Math.max(GAP, r.left + r.width / 2 - size.w / 2), vw - size.w - GAP); axis = 'y'; }
    // 纵向：与卡片顶部对齐，超出视口则向上顶回
    let top = r.top;
    if (top + size.h > vh - GAP) top = vh - GAP - size.h;
    if (top < GAP) top = GAP;
    left = Math.min(Math.max(GAP, left), vw - size.w - GAP);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    // 从卡片这一侧展开，视觉上像卡牌长出来一样
    const ox = left + size.w / 2 < r.left + r.width / 2 ? '100%' : (left > r.left ? '0%' : '50%');
    box.style.transformOrigin = ox + ' ' + (axis === 'y' ? '50%' : 'calc(50% - ' + (r.top + r.height / 2 - (top + size.h / 2)) + 'px)');
  }

  function show(face) {
    if (!live(face)) return;
    const src = face.currentSrc || face.src;
    if (!src) return;
    if (cur && cur.src === src) { cur.rect = face.getBoundingClientRect(); place(); return; }
    ensure();
    cur = { src, alt: face.alt || '', natural: { w: face.naturalWidth, h: face.naturalHeight }, ratio: null, rect: face.getBoundingClientRect() };
    // 横版探险卡（600×424）按容器形状还原，避免被竖版比例拉变形
    const art = face.closest('.quest-card-art, .quest-display');
    if (art && cur.natural.w > cur.natural.h) cur.ratio = { w: cur.natural.w, h: cur.natural.h };
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

  function schedule(face) {
    clearTimeout(timer);
    if (cur) { show(face); return; }
    timer = setTimeout(() => show(face), SHOW_DELAY);
  }

  function onOver(e) {
    const t = e.target;
    const face = t?.closest && t.closest('.card-face, .card-art');
    const pic = face && face.querySelector('img');
    if (face && pic && isFace(pic) && !face.closest('dialog[open]')) { schedule(pic); return; }
    if (cur) scheduleHide();
  }

  function scheduleHide() {
    clearTimeout(timer);
    timer = setTimeout(hide, HIDE_DELAY);
  }

  function reposition() {
    if (!cur) return;
    const still = document.querySelector('.card-face:hover img, .card-art:hover img');
    if (still) { cur.rect = still.getBoundingClientRect(); place(); }
    else hide();
  }

  function bind() {
    if (bind.done) return;
    bind.done = true;
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerout', e => {
      const from = e.target?.closest?.('.card-face, .card-art');
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
