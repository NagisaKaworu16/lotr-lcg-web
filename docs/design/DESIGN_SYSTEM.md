# 视觉设计规范 · Vintage Analog 中土化（v1）

适用代码库：`C:/Users/Administrator/WorkBuddy/魔戒LCG`
适用文件：`style.css`（单文件 2103 行，无构建期 CSS 处理）、`shell.html`、`assets/cards-en/*.webp`
本文件只定义**规范与令牌**，不改任何源码。前端按第 1、6 节落地即可。

---

## 0. 设计原则（五条，用来裁决后续所有分歧）

1. **纸叠纸，不是换边框。** 层次靠**明度单调阶梯**（页面底最沉 → 浮层最亮）表达，色相只做暖调偏移做辅助。禁止「同一块米色 + 换一种边框色」当作层次。
2. **卡图是唯一高保真内容。** 1500+ 张扫描图的色准不可被任何滤镜、叠色、纹理污染。容器越亮、越中性，卡图越「浮」起来。氛围全部落在容器底色与纹理层上，不落在 `img` 上。
3. **颜色只承担「结构 + 状态」，氛围交给纹理与色温。** 现有红/绿/金/蓝 + 五个领域色已经占满语义预算，不再新增色相来做装饰。金色是**结构线**，不是装饰颜料：出现次数要少，出现一次就要有意义。
4. **可读性优先于氛围。** 正文 ≥ 4.5:1 是硬线，为此宁可把「做旧」的灰绿次要色加深 2 档（`#768174` → `#545B4D`），也不靠透明度做衰减。旧 `--muted` 在新页面底上实测只有 **2.84:1**，它本来就不该承担 12–14px 的说明文字。
5. **克制：一屏之内金色文字不超过 3 处，纹理只有一层，装饰性文字能删就删。** 旧的「✥ 大字水印 + eyebrow + 重复阶段名」是氛围的错位表达，删掉比调色更有效。

### 对比度计算依据（全文档数值同源）

WCAG 2.1 相对亮度公式，用脚本实算（非目测）：

```
c = v/255; c = c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
L = 0.2126*R + 0.7152*G + 0.0722*B
ratio = (max(L1,L2)+0.05) / (min(L1,L2)+0.05)
```

L\* 用 CIELAB：`Y > 0.008856 ? 116*Y^(1/3)-16 : 903.3*Y`（用于给「明度差」一个可比较的数）。
验收脚本 `scripts/check-contrast.cjs` 的默认阈值是 `--min 3`（只看可交互控件）；**本规范自行采用 4.5:1 作为文字门槛**，比脚本更严，因此改完颜色后脚本只会更松，不会新增问题项。

---

## 1. 令牌层（可直接粘贴替换 `style.css` 第 4 行的 `:root`）

```css
:root{
  /* ── 0. 沿用（不改动）────────────────────────────────────────── */
  --font-title:'Cinzel','KingHwa OldSong',Georgia,'Microsoft YaHei',serif;
  --font-body:'LXGW WenKai',system-ui,-apple-system,'Microsoft YaHei',sans-serif;
  color-scheme:only light;

  /* ── 1. 纸面：四层表面 + 四个衍生面 ───────────────────────────
     明度单调上行：page 86.2 < board 90.4 < mat 95.1 < pop 98.9 (L*)
     每层 ΔL* ≥ 3.8，且色温从「橄榄暖灰」向「奶油白」推进。 */
  --surface-page:   #e1d7be;  /* 页面底：body、非对局页环境底 */
  --surface-board:  #ede3c8;  /* 公共牌桌：.public-table */
  --surface-mat:    #f7f1de;  /* 玩家区：.player-mat / 底部合并模块 / 右栏 section */
  --surface-pop:    #fffcf2;  /* 最高层：浮层、操作条、卡框、按钮面、dialog */

  /* 衍生面（不是新层级，是同层内的「下沉 / 凹陷 / 芯片」） */
  --surface-sunken: #e9e0c8;  /* 凹槽：.card-face 底衬、进度条轨道、牌堆芯片底 */
  --surface-chip:   #f2eddd;  /* 徽章 / 胶囊底 */
  --surface-wash:   #f1ead3;  /* 悬停水洗底（按钮 hover、列表 hover） */

  /* 深色件（顶栏 / toast / 深色内嵌面板），全套沿用「暖墨绿」而非纯黑 */
  --surface-header:   #2b3d31;
  --surface-header-2: #35483b;

  /* ── 2. 墨色 ───────────────────────────────────────────────── */
  --ink:   #23342b;  /* 正文。对四层 9.18 / 10.28 / 11.64 / 12.81 */
  --ink-2: #545b4d;  /* 次要文字。对四层 4.92 / 5.51 / 6.24 / 6.86 */
  --ink-3: #6f7566;  /* 弱化：只许描边/图标/禁用/≥24px 大字（对 page 3.32） */
  --on-dark:      #f3ead7;  /* 深色件上的正文（#2b3d31 上 9.68） */
  --on-dark-2:    #c8cfbe;  /* 深色件上的次要（7.23） */
  --on-dark-gold: #e2c88c;  /* 深色件上的金色强调（7.09） */

  /* ── 3. 强调（语义固定，不许挪作装饰）────────────────────────
     同一个语义色按「物理底条件」拆值，见本节末的通则：亮底填充 /
     亮底小字 / 暗底图形，三种条件各一个值，各自独立实算。 */
  --accent-gold:  #846424;  /* 金色填充：徽章底、选中环、序号块。其上文字用 --on-gold */
  --on-gold:      #fffcf2;  /* 金底上的字：5.34 ; 金底本身对 page 3.91（仅够大字） */
  --gold-ink:     #6f5622;  /* 金色文字（任何 ≤20px 场合）：对四层 4.84 / 5.42 / 6.14 / 6.75 */
  --gold-line:    #b79a62;  /* 装饰金线：3px 规则线、卡顶边、分隔线（非文字，不参与对比度） */
  --accent-green: #2f4a3b;  /* 主行动色：primary 按钮底、当前阶段底。其上白字 9.46 */
  --accent-green-hi:#3a5a48;/* 主行动 hover / 次级绿填充。其上白字 7.48 */
  --green-ink:    #3d5c37;  /* 绿色文字（成功/合规/已启用）：对 page 5.31 */
  --accent-red:   #a35446;  /* 警示填充/描边（亮底用；对 page 4.88，小字仍不足） */
  --red-ink:      #8d4433;  /* 警示文字：对四层 4.88 / 5.46 / 6.18 / 6.80 */
  --accent-red-on-dark:#ef8f84; /* 暗底专用红：阶段-窗口竖轴 3px 线等深色件上的图形。
                                   对 #3a3f46 = 4.51；对最不利提亮底（color-mix 命中行）3.22。
                                   暗底上**不能**用 --accent-red（仅 1.98，等于看不见） */
  --accent-teal:  #4a7b7c;  /* 信息/可选 填充与描边 */
  --teal-ink:     #37605f;  /* 信息文字：对四层 4.89 / 5.47 / 6.20 / 6.82 */
  --warn-ink:     #7e4f1c;  /* 提醒文字（「还差 2 项」这类）：对四层 4.85 / 5.43 / 6.15 / 6.77 */

  /* ★ 通则（不是特例）：同一个语义色在三种物理条件下各有一个值，
     三种条件各自独立实算，**不互相推导**（不靠调透明度、不靠 color-mix 从另一个值算）。
        ① 亮底填充   → --accent-*       例：--accent-red #a35446
        ② 亮底小字   → *-ink            例：--red-ink #8d4433
        ③ 暗底图形   → --accent-*-on-dark 例：--accent-red-on-dark #ef8f84
     为什么必须拆：同一个色值不可能同时满足「浅纸上的填充」「浅纸上的 12px 文字」
     「深灰底上的 3px 线」三种物理条件——它们的相邻色与判定门槛都不同
     （文字 4.5:1，非文字图形 3:1，且底色亮度方向相反）。
     新增任何状态色时，先问它出现在哪几种底上，再决定要几个值；
     不要试图用一个值硬扛，也不要为「看起来一致」把暗底的值强行套回亮底。 */

  /* 状态底（成对使用：底 + 上面的字） */
  --state-ok-bg:     #edf2e4;  --state-ok-ink:   #3d5c37;  /* 6.62 */
  --state-win-bg:    #e3ecd9;  --state-win-ink:  #3d5c37;  /* 6.20 */
  --state-lost-bg:   #f2ddd3;  --state-lost-ink: #8a4231;  /* 5.53 */
  --state-notice-bg: #f5ecd7;                              /* 配 --warn-ink，5.91 */
  --state-sel-bg:    #e6dcc0;                              /* 阶段栏当前步；配 --ink 9.62 */

  /* ── 4. 结构：线 / 圆角 / 阴影 / 间距 / 纹理 ──────────────────
     旧的 6px / 7px / 8px / 9px / 10px / 12px 六种圆角收敛成三档（sm / md / lg）
     + 一个胶囊形状（--radius-pill，形状不是档位）。12px 那一档已退役并入
     --radius-lg，理由见下方「圆角裁定」。 */
  --line:        #c9ba96;  /* 常规分隔与容器描边（替换 #d8dcd0，49 处） */
  --line-soft:   #ded3b6;  /* 同层内的弱分隔（列表行、卡内分隔） */
  --line-strong: #b3a179;  /* 需要「描边本身可辨」的容器（浮层、选中框外层） */
  --line-warm:   #cab68f;  /* 金色容器描边（decide / 操作条 / notice 左条）暗于原 #c9b98a 一档 */

  /* 圆角：**三档 + 一个形状**，按「元素体量」分，不按组件分。
       sm  6px   = 行内控件（按钮 / 输入 / 徽章 / 决策点 / 状态角标）
       md  8px   = 卡片与面板内块（卡框 / 分组块 / 右栏整块 / 下拉）
       lg 10px   = 大容器（主面板 / 牌桌 / 玩家区 / 浮层 / 补牌弹窗）
       pill 999px= 胶囊形状（不是一档，是几何形态，只给「两端全圆」的按钮用）
     ⚠ --radius-xl:12px 已退役（原样保留会变成第 4 档，与注释里的「三档」互相打脸）：
       全仓仅 2 处引用（`style.css:96` .draw-toast-card、`style.css:1782` .decide-pop），
       两处改 var(--radius-lg)。理由：10→12 只差 2px，在 680px 宽的浮层上肉眼无差，
       构不成一档；若将来真需要大容器档，用 **14–16px**（跳档要有倍率感），不要回 12。
     ⚠ 唯一免令牌的圆角是 `3px`：只允许出现在行高 ≤24px 的行内块（.log-entry、
       .log-undo、.rail-win-line 端点等），因为 6px 会把这种小方块的四角吃掉变胶囊。
       `0 / 1px / 2px` 一律并入 `0`；`50%` 是「圆形载体」的写法，不算圆角值。 */
  --radius-sm:6px;  --radius-md:8px; --radius-lg:10px; --radius-pill:999px;

  --shadow-card: 0 2px 6px #23342b14;
  --shadow-dock: 0 6px 18px #23342b1f;
  --shadow-pop:  0 14px 34px #14291c38;
  --highlight-paper: inset 0 1px 0 #fffaf0cc;   /* 纸面顶部高光（伪造一点环境光） */
  --vignette-board:  inset 0 0 60px #8a6f3214;  /* 牌桌暖色暗角 */

  /* 间距刻度：4 的倍数，只有这 6 档 */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px; --space-6:32px;

  /* 纹理（颗粒）。alpha 已烘进 SVG 的 opacity=0.055，≤ 0.06 硬上限。
     ⚠ data URI 里唯一的 `#` 已写成 `%23`（未编码的 `#` 会被当作 URI 片段标识符，
     后面的 SVG 会被整段截掉）。别把它「美化」回 `#`；若某个压缩工具把 `%23` 解码，
     改用 base64 形式同一份 SVG。 */
  --grain-tex:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23g)' opacity='0.055'/></svg>");

  /* 焦点环：浅底用墨绿，深色件用暖金，两者都 ≥6.7:1 */
  --focus-ring:#2f4a3b;  --focus-ring-on-dark:#e8c87a;

  /* ── 5. 向后兼容别名（**必须保留**，2103 行旧引用全靠它活着）──
     `--ink` 与 `--line` 在新体系里沿用原名字（值微调），因此不需要别名；
     其余五个旧名在此指向新值。注意：别名里**不许**写自引用
     （`--line:var(--line,…)` 会形成循环依赖 → 该变量整条失效）。 */
  --ink:#23342b;                       /* 名字未变，值微调（#24392f → #23342b） */
  --paper:var(--surface-pop);          /* 原 #f9f8f2 / #fffdf6 */
  --muted:var(--ink-2);                /* 原 #768174 → 加深两档，见原则 4 */
  --green:var(--accent-green);         /* 原 #365842；28 处引用：既当填充也当文字，新值两边都过 */
  --gold:var(--accent-gold);           /* 原 #ad8b4b；仅当填充用，文字改用 --gold-ink */
  --red:var(--accent-red);             /* 原 #a35446 */
}
```

> 关于 `--green` 的一处细节：它被引用了 28 次，既当按钮底（其上白字）又当文字色。
> 新值 `#2f4a3b` 对白字 9.46、对 page 6.78，**两个方向同时达标**，所以可以单值收敛，不需要拆两个令牌。

---

## 2. 四层表面色阶表

| 层 | 令牌 | HEX | L\* | ΔL\* (与下一沉层) | 对正文 `--ink` | 对次要 `--ink-2` | 对局桌面上的实际元素 |
|---|---|---|---|---|---|---|---|
| ④ 浮层 / 卡面 | `--surface-pop` | `#FFFCF2` | 98.9 | +3.8 | **12.81** | 6.86 | `.decide-pop`、`dialog`、`#image-dialog`、`.operation-dock`、`.table-card` 与 `.card-face` 外壳、所有按钮面、`.toast` 内的卡面 |
| ③ 玩家区 | `--surface-mat` | `#F7F1DE` | 95.1 | +4.7 | **11.64** | 6.24 | `.player-mat`、`.bottom-deck`（队伍与手牌合并模块）、`.hand-zone`、`.tabletop-rail>section`（右栏四块） |
| ② 公共牌桌 | `--surface-board` | `#EDE3C8` | 90.4 | +4.2 | **10.28** | 5.51 | `.public-table`（探险区 / 探查区 / 对手区所在的那块大板） |
| ① 页面底 | `--surface-page` | `#E1D7BE` | 86.2 | — | **9.18** | 4.92 | `body`、`body:has(.desktop-table)` 底、面板之间的缝隙、滚动溢出区 |

**为什么是这个顺序（而不是「牌桌更深」）：**

- 卡图是最高保真内容，**它所在的容器越亮，卡图边缘越清楚**。旧的深色石板牌桌（v0.14 之前）早就因为「像强塞的深色模式」被改掉过一次，不要回头。
- 「越靠近玩家越亮」符合纸叠纸 / 桌游铺一张纸再放卡的直觉：页面底是环境，牌桌是桌上的大张纸，玩家区是靠近你的那张，浮层是你举起来看的那张。
- 三档 ΔL\* 分别是 4.2 / 4.7 / 3.8，都在「同色系可辨台阶」区间（≥3）之内；**此外还叠了色温偏移**（page 偏橄榄 `#E1D7BE` → pop 偏奶油 `#FFFCF2`），所以即使有人用低质量显示器也能分开。

**同层的三个衍生面**（不要拿它们当第四、第五层用）：

| 令牌 | HEX | 用途 | 与母层关系 |
|---|---|---|---|
| `--surface-sunken` | `#E9E0C8` | 进度条轨道、`.card-face` 底衬、牌堆芯片底、空槽 | 比 mat 暗 1.16（视觉下沉） |
| `--surface-chip` | `#F2EDDD` | `.badge`、`.decide-hint`、`.decide-list li` | 比 mat 暗 1.04（几乎同色，靠描边立起） |
| `--surface-wash` | `#F1EAD3` | 按钮 / 列表 hover 水洗 | 比 mat 暗 1.05 |

**旧版本塌陷点（改前的实测问题）**：`.public-table` 是 `#fbfaf3→#f1efe2` 径向渐变、`.player-mat` 是 `#faf9f2` —— 两者最亮处几乎同色，明度差 <1，玩家区反而比牌桌中心更亮，**牌桌和玩家区在视觉上是同一块**。新方案把这两块拉开 4.7 个 L\*。

---

## 3. 字体阶梯（六级）

三套字体全部保留：`--font-title` = Cinzel → KingHwa OldSong → Georgia；`--font-body` = LXGW WenKai。

| 级 | 令牌 | 字号 / 行高 / 字重 / 字距 | 字体 | 用在哪 | 桌面紧凑档（`body:has(.desktop-table)`） |
|---|---|---|---|---|---|
| **h1 显示级** | `--fs-display` | 30px / 1.22 / 600 / `letter-spacing:.015em` | `--font-title` | 开局设置页大标题、说明与完成范围页标题、卡组页标题 | 26px / 1.2（`.expedition-title h1` 现状 26px，保留） |
| **h2 区块级** | `--fs-h2` | 20px / 1.35 / 600 / `.01em` | `--font-title` | `.panel-title h2`、`.help h2`、`.scenario h2`、浮层 `h2` | 17px / 1.3；`.zone-heading h2` 15px（**底线，不许再小**） |
| **h3 子级** | `--fs-h3` | 16px / 1.45 / 600 / `.02em` | `--font-title` | 卡组分组、`.zh-card-explanation h4`、设置页分组 | 15px / 1.4 |
| **正文** | `--fs-body` | **18px / 1.7 / 500 / 0** | `--font-body` | 说明页、规则全文、设置页表单、`p`、`li` | 18px（**不缩**）；`.decide-body`/`.panel` 正文 17px 下限 |
| **次要** | `--fs-sm` | 15px / 1.6 / 500 / `.01em` | `--font-body` | `.small`、地区描述、卡牌中文解释、`.help td` | 14px / 1.5（`.operation-content p` 现状 14px，保留） |
| **徽章 / 计量** | `--fs-xs` | 13px / 1.5 / 600 / `.03em` + `font-variant-numeric:tabular-nums` | `--font-body` | `.badge`、`.rail-step>span`、`.tab-stats`、`.card-legality`、计量数字 | 12px / 1.4；顶栏 HUD 内可到 11.5px（**仅限 HUD**，且必须 `--ink`/`--on-dark` 级） |

**硬规则**

- 正文最小 18px，任何 `≤16px` 必须是「标签 / 计量 / 卡面信息」，不得承载连续阅读的段落。
- `.card .body`（13px）、`.card .en`（12px）、`.rules-text` 属于**卡面信息层**，随卡图尺寸走，保持现状不调；但颜色必须换成 `--ink-2`（对卡面 6.86）。
- 字重只有 500 / 600 / 700 三档。`font-weight:800/900` 只允许出现在 `tabular-nums` 的计量数字上（旧文件 `.quest-progress-label` 用了 800，可保留）。
- 中英混排：Cinzel 只吃拉丁与数字，中文自动落到 KingHwa OldSong；**不要给纯中文标题指定 Cinzel**（旧文件 `.eyebrow` 的 `font:500 13px 'Cinzel',var(--font-title)` 在纯中文时会白掉一层 fallback）。
- 装饰性 `text-transform:uppercase` + `letter-spacing:1.6px` 只允许用于**英文 eyebrow**，一个屏幕最多 1 处（见禁用清单）。

---

## 4. 纹理方案（颗粒）

### 4.1 硬指标

| 项 | 值 |
|---|---|
| 形态 | 纯 CSS：inline SVG `feTurbulence` data-URI（无外部图片、无网络请求、无 base64 大文件） |
| alpha | **0.055**（烘在 SVG `<rect opacity>` 内），≤ 0.06 上限 |
| 覆盖范围 | 只挂三处：`.public-table`、`.player-mat`、`body`（即 `--surface-page`）；**永不挂 `img` / `.card-face` / `.card-art` / `.table-card`** |
| 交互 | `pointer-events:none`（若用 `::before` 写法） |
| 降级 | `@media (max-width:760px)` 与 `@media (prefers-reduced-data:reduce)` 直接令 `--grain-tex:none` |

### 4.2 推荐写法：并进背景层（零遮挡风险）

```css
/* 纹理与底色在同一 background-image 栈里：它天然在内容下方，
   不存在「盖住文字/卡图」的可能，也不需要新的层叠上下文。 */
.public-table{
  background-color:var(--surface-board);
  background-image:var(--grain-tex),
                   radial-gradient(120% 90% at 50% 0%, #f5ecd6, var(--surface-board) 72%);
  background-size:160px 160px, auto;
  background-repeat:repeat, no-repeat;
  border:1px solid var(--line);
  border-radius:var(--radius-lg);
  box-shadow:var(--highlight-paper), var(--vignette-board);
}
.player-mat{
  background-color:var(--surface-mat);
  background-image:var(--grain-tex);
  background-size:160px 160px;
  border:1px solid var(--line);
  border-top:3px solid var(--gold-line);      /* 唯一的金色结构线，占住「这是你的区域」 */
  border-radius:var(--radius-lg);
}
body{ background-color:var(--surface-page); background-image:var(--grain-tex); background-size:160px 160px }
```

> 牌桌那层径向渐变的亮端是 `#F5ECD6`（L\* 93.6），**仍低于玩家区 `#F7F1DE`（95.1）**——渐变可以把牌桌做出「上亮下沉」的光感，但绝不能亮过上一层，否则第 2 节建立的明度阶梯会被渐变悄悄抹掉。这是替换旧 `radial-gradient(ellipse at top,#fbfaf3,#f1efe2)` 时的唯一陷阱。

### 4.3 备选写法：`::before` 覆盖层（需要单独一个 opacity 旋钮时用）

```css
.grain{ position:relative; isolation:isolate; }        /* ← 关键，缺了它纹理会被藏到祖先前头 */
.grain::before{
  content:"";
  position:absolute; inset:0; z-index:-1;              /* ← 停在「自身背景之上、内容之下」 */
  background-image:var(--grain-tex);
  background-size:160px 160px;
  opacity:.055;                                        /* ≤0.06 硬上限 */
  pointer-events:none;
  border-radius:inherit;
  mix-blend-mode:multiply;                             /* 让颗粒咬进纸色，而不是浮一层灰 */
}
```

**为什么这样写不会碰到卡图（三条独立保障，任一条成立即可）：**

1. `z-index:-1` 在 `isolation:isolate` 建立的层叠上下文里，绘制顺序固定在「元素自身背景」之后、「块级流内容」之前 —— 伪元素物理上画不到文字与子元素之上。
2. 卡图容器全部有**自身不透明底**（`.table-card`/`.card-face` = `--surface-pop`，`.card-art img` = `--surface-sunken`），纹理即使在下层也透不上来。
3. 规范层面禁止：`.grain` 类**不得**加到 `img`、`.card-face`、`.card-art`、`.table-card`、`.card` 上（见禁用清单第 3 条）。

### 4.4 降级

```css
@media (max-width:760px), (prefers-reduced-data:reduce){
  :root{ --grain-tex:none }   /* 单点关闭，两处用法自动失效 */
}
@media print{ :root{ --grain-tex:none } }
```

- 与 `prefers-reduced-motion` 无关（纹理是静态的，不需要动效开关）。
- 低端机降级理由：`feTurbulence` 在极低端设备上是「一次 160×160 位图合成 + 平铺」，比纯色多一次混合；760px 以下本身已进入单列堆叠、卡片缩小、滚动增多，属性能敏感区间，直接关掉最省。
- **不要在移动端换成 `background-attachment:fixed` 或缩小 `background-size`** —— 颗粒一旦被缩放就会变成可辨的「斑点」，反而更脏。

---

## 5. 组件规范（只给关键属性，不给整段实现）

### 5.0 语义约定（先读这段，后面表格都靠它）

| 颜色槽 | 令牌 | 语义 |
|---|---|---|
| 行动 | `--accent-green` / `--accent-green-hi` | 「现在点这里推进游戏」 |
| 结构 | `--gold-line` / `--line-warm` / `--line` | 区域边界、卡框、分隔（**不是装饰**） |
| 强调数字 | `--gold-ink` / `--accent-gold` 底 | 序号、威胁总值、进度 |
| 提醒 | `--warn-ink` / `--state-notice-bg` | 「还差几项」这类软提示 |
| 警示 | `--red-ink` / `--accent-red` | 伤害、已横置、失效、危险操作 |
| 信息 | `--teal-ink` / `--accent-teal` | 可选中、可查看、非必做 |
| 成功 | `--state-ok-ink` / `--state-ok-bg` | 合规、已提交、已就绪 |

### 5.1 按钮（四级 + 禁用 + focus）

| 级别 | 用途 | 关键属性 |
|---|---|---|
| **primary** | 阶段推进（结束阶段 / 继续 / 提交名单），**一屏最多 2 个** | `background:var(--accent-green);border:1px solid var(--accent-green);color:var(--on-gold);border-radius:var(--radius-sm);padding:7px 14px;font:600 15px/1.3 var(--font-body)` → hover `background:var(--accent-green-hi)`（白字 7.48） |
| **secondary** | 默认动作（查看 / 切换 / 选择） | `background:var(--surface-pop);border:1px solid var(--line-strong);color:var(--ink)` → hover `background:var(--surface-wash);border-color:var(--gold-line)` |
| **ghost** | 密集区里的低权重动作（折叠、展开、次级导航、**可逆的撤出**如「放弃本窗口行动」） | `background:transparent;border:1px solid transparent;color:var(--ink-2)` → hover `background:var(--surface-wash);color:var(--ink)` |
| **danger** | **仅限不可逆操作**：重置剧本 / 删除卡组 / 移出角色 / 放弃整局 | `background:var(--surface-pop);border:1px solid var(--line);color:var(--red-ink)` → hover `background:var(--state-lost-bg);border-color:var(--accent-red)`（5.34） |
| **disabled** | — | `opacity:.48;cursor:default`（**保持现状**，WCAG 豁免禁用态）；**hover 必须无任何变化**，加 `pointer-events` 不要用，`disabled` 属性已挡住 |
| **focus-visible** | 键盘 | `outline:2px solid var(--focus-ring);outline-offset:2px`；深色件内改 `outline-color:var(--focus-ring-on-dark)`。**禁止 `outline:none` 后不给替代**；禁止只靠 `box-shadow`（高对比模式下会消失） |

统一 `transition:background .12s ease,border-color .12s ease`。**hover 只改 background / border-color / color，不改尺寸、不位移、不缩放。**

> **danger 的边界（与 `WINDOWS.md` 对齐）**：「放弃本窗口行动」定为 **ghost**，不是 danger —— 它可逆（随时「取消放弃」）、同一屏可能同时出现 2–4 枚、语义是「减损」而非「破坏」。danger 只给不可逆操作，否则红色会被用成装饰，真危险时喊不出来。

### 5.2 卡框（正 / 横置 / 禁用 / 选中）

| 状态 | 关键属性 |
|---|---|
| **正视**（默认） | `background:var(--surface-pop);border:1px solid var(--line-strong);border-radius:var(--radius-md);box-shadow:var(--shadow-card);padding:4px` |
| **卡面底衬**（`.card-face`） | `background:var(--surface-pop);border:1px solid var(--line-soft);border-radius:var(--radius-sm);overflow:hidden` —— **必须不透明**，纹理与底色才透不上来 |
| **横置**（`.exhausted`，沿用 `transform:rotate(90deg) scale(.7)` 于 `img`，不改） | 卡框 `border-color:var(--gold-line);background:var(--surface-sunken)`；说明文字 `color:var(--red-ink)` |
| **禁用 / 不可用**（`.unavailable`、`.unaffordable`） | ❌ 不再用整体 `opacity:.55`：它把卡名从 **12.13:1 压到 3.36:1**（实测 0.55→3.36 / 0.62→4.05 / 0.70→5.08，**<0.7 一律过不了 4.5**）。改为：`border:1px dashed var(--line-strong);background:var(--surface-chip)`，卡面右上角挂一枚 `--ink-3` 的角标；卡面本身**不加任何滤镜** |
| **选中**（`.selected`、`.selectable`） | `box-shadow:0 0 0 2px var(--accent-gold), 0 0 0 5px #84642429`（`#846424` 对 mat 4.85，环可辨）；**不加位移、不加 scale** |
| **悬停**（手牌 `:hover`） | 沿用 `translateY(-18px)` 允许（它是**手牌扇形展开**的既有交互，属内容层位移不是布局位移）；但 `transform:scale()` 一律禁止 |

### 5.3 面板

```css
.panel{ background:var(--surface-pop); border:1px solid var(--line); border-radius:var(--radius-lg);
        padding:var(--panel-pad); box-shadow:none }          /* 纸面是平的，不给阴影 */
.tabletop-rail>section{ background:var(--surface-mat); border:1px solid var(--line); border-radius:var(--radius-lg) }
.operation-dock{ background:var(--surface-pop); border:1px solid var(--line-warm); border-radius:var(--radius-lg);
                 box-shadow:var(--shadow-dock) }              /* 悬浮件，唯一带阴影的面板 */
```

- 面板标题条（`.operation-title` / `.decide-head`）= `background:var(--surface-wash); border-bottom:1px solid var(--line-soft)`。
- 深色内嵌面板（现在 `.mat-phase>.opening-panel{background:#2b3d33}`）→ **改回浅色**：`background:var(--surface-sunken); border:1px dashed var(--gold-line)`。浅色玩家区里嵌一块深色，是剩下最刺眼的一处「强塞深色模式」。

### 5.4 徽章

```css
.badge{ background:var(--surface-chip); border:1px solid var(--line); color:var(--ink-2);
        border-radius:var(--radius-sm); padding:2px 8px; font:600 13px/1.5 var(--font-body) }
.badge--gold{ background:var(--accent-gold); border-color:var(--accent-gold); color:var(--on-gold) } /* 5.34 */
```
`.first-mark` / `.selection-mark` 走 `--badge--gold`；`.elim-mark` 用 `--accent-red` 底 + `--on-gold` 字（`#a35446` 上白字实测 5.37，达标，可继续沿用）。

### 5.5 进度条（`.quest-progress`）

```css
.quest-progress{ height:11px; background:var(--surface-sunken); border-radius:var(--radius-pill);
                 box-shadow:inset 0 1px 3px #23342b2e }
.quest-progress-fill{ background:linear-gradient(90deg,#7a5f22,#b8944a 60%,#d4b478);
                      box-shadow:0 0 0 1px #7a5f2255; transition:width .4s cubic-bezier(.16,1,.3,1) }
.quest-progress-label{ color:#2b2510; font-weight:800; letter-spacing:.06em;
                       text-shadow:0 1px 0 #fffdf680 }   /* 对填充各段 5.36 / 7.71，达标 */
@media (prefers-reduced-motion:reduce){ .quest-progress-fill{ transition:none } }
```

### 5.6 决策触发条 + 浮层（`.decide-trigger` / `.decide-pop`）

| 部位 | 关键属性 |
|---|---|
| 触发条 | `background:var(--surface-wash);border:1px solid var(--line-warm);border-radius:var(--radius-pill);min-height:26px;padding:0 10px;font:600 12px/1.2 var(--font-body);color:var(--ink)`；hover `background:#efe6cd;border-color:var(--gold-line)` |
| 状态点 `.decide-dot` | 尺寸 `9×9`；标题行内 `7×7`；窄屏不变。**四态走「形状为主通道、颜色为辅」双通道编码**，不新增任何颜色令牌（见下表） |
| hint 胶囊 | `background:var(--surface-chip);border:1px solid var(--line);color:var(--gold-ink);border-radius:var(--radius-pill);font:600 11px/1.4` |
| 浮层 | `background:var(--surface-pop);border:1px solid var(--line-strong);border-radius:var(--radius-lg);box-shadow:var(--shadow-pop);width:min(680px,calc(100vw - 48px));max-height:min(62vh,600px)`（宽度是现状 v0.15.93 的 680，**不要回到 880**，那会盖住探险区） |
| 浮层头 | `background:var(--surface-wash);border-bottom:1px solid var(--line-soft);padding:10px 16px` |
| 出现动效 | `animation:decideIn .13s cubic-bezier(.2,.8,.25,1)`（现有 `scale(.97)→1` 是**入场动画**，不是 hover 位移，允许保留；`prefers-reduced-motion` 下必须 `animation:none`，现有代码已做） |

**状态点四态（`data-tone`；与 `WINDOWS.md` 的窗口语义一一对应）**

> **v1.2 裁决**：采用「形状通道」。四态几何尺寸完全一致，只有**填充 / 圆角 / 线型**与**颜色**变化；颜色只复用既有令牌，不新增任何颜色值。

| tone | 语义 | 形状 | 颜色（复用既有令牌） | 关键属性 |
|---|---|---|---|---|
| `todo` | 有事等你做（现在轮到你） | **实心圆** | `--accent-gold` | `background:var(--accent-gold);border-radius:50%;box-shadow:0 0 0 3px #84642426` |
| `forced` | 必须结算、不能跳过 | **实心方块** | `--accent-red` | `background:var(--accent-red);border-radius:1px;box-shadow:0 0 0 3px #a3544626`（对 mat 4.75） |
| `wait` | 等别人 / 引擎，不打断 | **空心圆 + 虚线描边** | `--ink-3` | `background:transparent;border:1.5px dashed var(--ink-3)`（描边对 mat 4.21，非文字按 3:1 判，过） |
| `info` | 纯回执，不是待办 | **空心圆 + 实线描边** | `--ink-3` | `background:transparent;border:1.5px solid var(--ink-3)` |

> **一处实现变更**：现状 `.decide-trigger[data-tone="todo"] .decide-dot{background:#c08f2c}` 用的是未入令牌的琥珀字面量，本版统一改为 `var(--accent-gold)`（`#846424`，对 mat 4.85），让状态点跟随调色板。这意味着 `#c08f2c` 从代码里退役——**不要**为它新增令牌。

**表下备注（三条，缺一条就不算落地）**

1. **几何尺寸必须一致**：四态共用同一个 `width/height`（桌面 `9×9`，标题行内 `7×7`，窄屏不变），**只有填充、`border-radius`、`border-style` 变化**。任何一态改尺寸都会让触发条高度在换态时跳动（现状 `.decide-trigger` 是 26px 定高胶囊，一跳动整条「队伍与手牌」标题行都要重排）。
2. **形状之外必须还有一个非视觉通道**：`aria-label` 加前缀——`forced` → 「强制 · 」，`wait` → 「等待 · 」，`info` → 「回执 · 」，`todo` 不加前缀（默认态）。理由：9px 圆/方在缩略、低分辨率、屏幕阅读器三种场景下都可能丢失形状信息。
3. **`wait` 态允许闪动，但 ≤2 次**（`animation:dotPulse .9s ease-in-out 2`），且 `@media (prefers-reduced-motion:reduce){.decide-dot{animation:none}}` 必须写。`todo` / `forced` / `info` 一律不闪——**闪动只用来表达「在等」，不用来表达「快来做」**，否则桌面会同时有三处在闪。

> **`forced` 用红不是配色偏好，是同源**：`phase-log.js` 的阶段竖轴里 `rail-step[data-timing="forced"]` 本来就用红。触发条与阶段栏描述的是同一件事，必须同一种信号，否则玩家会在右侧竖轴看到红、在底部触发条看到金，当成两种状态。**此值已锁死，不得再改为金色或其他色。**

> **为什么不用颜色深浅区分四态**：那是单通道编码——色弱、灰度打印、强制高对比模式下色相全丢，`todo` 与 `forced` 会塌成同一个灰点。本表把「要不要你动手」编码成**实心 / 空心**、把「能不能跳过」编码成**圆 / 方**、把「是否在等待」编码成**虚线 / 实线**，三条判据各自独立可读，任意单一通道下都还成立；颜色只做加成，不承担区分职责。这也是全站唯一一处允许用点态承担语义的地方，因为它没有文字。

### 5.7 阶段栏条目（`.rail-step`，右栏「一堵文字墙」的处方）

文字墙的病根不是颜色，是**权重均一**：7 步全是 14px/500，序号 13px 浅灰，看不出「我在这」。处方：

```css
/* 载体 */
.tabletop-rail>section{ background:var(--surface-mat); border:1px solid var(--line); border-radius:var(--radius-lg) }
/* 条目：用 1px 弱分隔，不用左侧 2px 竖条（7 条竖条 = 一堵栅栏） */
.rail-step{ display:flex;gap:10px;align-items:center;padding:8px 6px;color:var(--ink-2);
            border:0;border-bottom:1px solid var(--line-soft);border-radius:0 }
.rail-step:last-child{ border-bottom:0 }
/* 序号：唯一允许的金色 */
.rail-step>span{ font:700 12px/1 var(--font-body);color:var(--gold-ink);letter-spacing:0;
                 min-width:14px;font-variant-numeric:tabular-nums }
.rail-step>b{ font-weight:600;font-size:14px }        /* 未到 / 已过：600 */
.rail-step small{ margin-left:auto;font-size:12px;color:var(--gold-ink);font-variant-numeric:tabular-nums }
/* 当前步：唯一 700 + 唯一实心底 + 唯一 3px 金条 */
.rail-step.current{ background:var(--state-sel-bg);color:var(--ink);
                    box-shadow:inset 3px 0 0 var(--gold-line);border-radius:var(--radius-sm) }
.rail-step.current>b{ font-weight:700 }
/* 已过：不许用 opacity 压暗（实测 <0.7 的 opacity 会让文字跌破 4.5）*/
.rail-step.past{ color:var(--ink-2) }
.rail-step.past>span{ color:var(--line-strong) }      /* 序号由「金字」退成「褪色金」，不改字号 */
```

对照度：当前步 `--ink` 对 `#e6dcc0` = 9.62；序号 `--gold-ink` 对 `#f7f1de` = 6.14；普通步 `--ink-2` 对 `#f7f1de` = 6.24。**所有 12–14px 文字都过 4.5，不靠透明度。**

**5.7-b 阶段-窗口竖轴的三条 3px 线色（`.rail-win-line`）**

竖轴是**深底组件**：`.rail-wins{background:#3a3f46}`（`style.css:1244`），命中行还有 `color-mix(in srgb,var(--pc) 46%,#3a3f46)` 的提亮底。三条线是 3px 图形，按**非文字门槛 3:1** 判，不按 4.5 判：

| 时机 | 色值 | 对 `#3a3f46` | 对 7 个提亮底最差 | OKLCh H / C | L\* | 判定 |
|---|---|---|---|---|---|---|
| `trigger`（规则触发） | **`#cda351`**（原 `#e8c169`） | **4.52** | 3.68 | 82 / 0.112 | 69.3 | ✅ |
| `action`（行动窗口） | **`#72b97d`**（原 `#6ea86b`） | **4.52** | 3.68 | 148 / 0.112 | 69.3 | ✅ |
| `forced`（强制结算） | `var(--accent-red-on-dark)` `#ef8f84` | 4.51 | 3.67 | 27 / 0.119 | 69.2 | ✅ |

**为什么改这两条：不是"太艳"，是"权重倒挂"。**
旧值 `#e8c169` 的彩度 C=0.116，和 `forced` 的 0.119 几乎一样——**它并不比红线更艳**。真正的问题是亮度：旧三线的 L\* 是 **63.7 / 79.8 / 69.2**，`trigger` 比 `forced` 亮 **10.6 个 L\***。也就是说「规则触发」在视觉上比「强制结算」更重，语义和重量是反的。
所以处方不是降饱和，而是**把三条钉到同一条等亮度线上**：统一解到「对 `#3a3f46` 恰 4.5:1」（L\* 69.2–69.3），再把彩度统一提到 0.112，让**色相成为唯一变量**——和 §5.7-c 七阶段色用的是同一套方法。三线两两 `ΔE(OKLab)`：`trigger/action` 0.123、`trigger/forced` 0.107、`action/forced` 0.202，色相上（金 82° / 绿 148° / 红 27°）互不靠近，不会出现「三条都变金」。
旧两值对 `#3a3f46` 是 6.20 / 3.78——一个偏亮一个刚够，本来就不是一套。

> 附：`forced` 那条「对最不利提亮底 3.22」的数字已作废。换了 §5.7-c 的七阶段色之后，7 个 `color-mix(--pc 46%,#3a3f46)` 提亮底的 L\* 被拉齐到 31.5–32.2，最差值升到 **3.67**。三线现在的最差值都在 3.67–3.68，说明它们在正常底和提亮底上**权重一致**——这正是等亮度设计要的效果。

- `forced` 原为 `#c9544a`（2.45 / 1.75），换成 `var(--accent-red)`（`#a35446`）会更糟：**1.98 / 1.41**——那是亮底红，搬到深灰底必然发闷。必须用 `--accent-red-on-dark`。
- 语义同源靠**色相**（都是红）维持，值随物理底走，这是 §1 通则的第 ③ 种条件，不是特例。

> **禁令：不许靠「把 `.rail-wins` 底色改深」来让任何一条线达标。** `#3a3f46` 是这块 20 行步骤树能在羊皮纸页上不抢牌桌的手段；而它的正文余量已经只剩一点：`.rail-win-no` `#c2c8cf` 对 `#3a3f46` = **6.29**（尚可），`.rail-win-label` `#a4acb5` = **4.62**（**只比 4.5 高 0.12**）。底色只要再深一档，标签文字立刻跌破 AA——等于用一个新缺陷换一个旧缺陷。**要提升对比度只能改线的值，不能改底的值。**
>
> 顺带记录两处现存不足（属同一组件，验收时会一起核）：`.rail-grp.past .rail-win-label{color:#6c747c}` 对 `#3a3f46` 仅 **2.24**、`.rail-grp.past .rail-win-no{color:#8a9198}` 仅 **3.33**，均低于 4.5。建议改为 `--on-dark-2`（`#c8cfbe`，7.23）并用「无金条 + 无高亮底」表达已过，而不是靠压暗文字。

### 5.7-c 七个阶段色（数据色，**不进 `:root`**）

> 这是全站**唯一一处非令牌色源**：`phase-log.js:7-16` 的 `PHASE_COLOR` 把 7 个 hex 直接写进 JS，
> 再由 `:125 / :142 / :153` 三处以内联 `style="--pc:${p.color}"` 注入，CSS 侧一切阶段色都由
> `var(--pc)` 派生。所以**改这 7 个字符串 = 改三个消费者**，令牌层不动、`--accent-*` 不动。
> 上一版落地漏了这一处，验收采样时右栏仍是冷色，源头就在这里。

| # | 消费者 | 位置 | 怎么用 | 物理底 |
|---|---|---|---|---|
| ① | `.rail-grp>.rail-head` | `style.css:1336` | `background:var(--pc)`；字 `--on-dark` `#f3ead7`，14px/500 | **色本身即底** |
| ② | `.rail-win.hit` | `style.css:1394` | `background:color-mix(in srgb,var(--pc) 46%,#3a3f46)`；字 `--on-dark` | 深灰（`.rail-wins` `#3a3f46`） |
| ③ | `.log-entry` | `style.css:1458` | `border-left:3px solid` + `background:color-mix(in srgb,var(--pc) 10%,var(--surface-pop))`；字 `#4c5748`→`--ink-2` | 近白浅底 |

同一个字符串要同时满足「自己当底」「在深灰上占 46%」「在近白上占 10%」三种物理条件——
这不是拆令牌能解决的问题（值在 JS 里还是**一个**字符串），只能靠**先把亮度钉死、再用色相分工**。

**定值（同时写入 `phase-log.js:7-16`）**

| 阶段 | 旧值 | 旧①| **新值** | 新① | 新② 底 / 字比 | 新③ 底 / 字比 ※ | OKLCh H / C / L | 颜料（选色理由） |
|---|---|---|---|---|---|---|---|---|
| P0 资源 `resource` | `#3f6b80` | 4.84 | **`#0e647a`** | **5.62** | `#26505e` / **7.34** | `#e7ede6` / **5.92** | 221 / 0.082 / 0.467 | 沥青青——旧值是灰钢蓝（C 只有 0.059），彩度顶到色域上限 0.082，从「显示器蓝」变「印刷青」 |
| P1 计划 `planning` | `#8a6a22` | **4.22 ❌** | **`#81520a`** | **5.58** | `#5b482a` / **7.30** | `#f2ebdb` / **5.93** | 70 / 0.100 / 0.480 | 焦赭——旧值偏黄（黄铜金，H84），往红挪 14° 落进土黄；赭石本就是高彩度矿物，不砍 |
| P2 探险 `quest` | `#3f7a4a` | **4.29 ❌** | **`#586110`** | **5.61** | `#484f2d` / **7.22** | `#eeeddb` / **5.96** | 116 / 0.100 / 0.469 | 苔绿——旧值是草绿（H148，踩在 sRGB 绿轴上），减青加黄 32°，落成橄榄苔 |
| P3 旅行 `travel` | `#2f7385` | **4.49 ❌** | **`#08694e`** | **5.59** | `#23524a` / **7.39** | `#e6ede2` / **5.90** | 167 / 0.092 / 0.463 | 铜绿——旧值是全组最刺的钢青（H218），整体往绿挪 **51°**，彻底离开 200–250° 的青区 |
| P4 遭遇 `encounter` | `#7d3f72` | 6.21 | **`#7d4a7d`** | **5.58** | `#59445f` / **7.27** | `#f2eae6` / **5.93** | 327 / 0.100 / 0.488 | 桑葚紫——色相几乎不动（−7°），只把洋红的彩度压回紫胶（0.109 → 0.100） |
| P5 战斗 `combat` | `#9a3a31` | 5.81 | **`#8f4644`** | **5.62** | `#614245` / **7.40** | `#f4eae1` / **5.94** | 23 / 0.099 / 0.486 | 砖红——旧值是「警告红」（C 0.131 全组最高），砍到 0.099 才像铁锈而不像按钮 |
| P6 刷新 `refresh` | `#3a5a78` | 6.03 | **`#505795`** | **5.60** | `#444a6a` / **7.22** | `#eeece9` / **5.98** | 277 / 0.100 / 0.480 | 靛青——旧值是第二个钢蓝（H248），往紫挪 29° 成染缸靛，从「界面蓝」变「织物蓝」 |

> **上面三列旧①的 4.22 / 4.29 / 4.49 不是笔误：计划、探险、旅行三个阶段色在 `.rail-head` 白字上
> 本来就不过 AA。** 所以这次改色的定性不是「为 Vintage 牺牲一点可读性」，而是
> **顺手修掉三处既有失败**——这一点请原样转给验收方，它把理由从审美升级成合规。
>
> ※ 该列按**替换后的 `--ink-2`** 算（5.90–5.98）；沿用现行 `#4c5748` 是 6.36–6.44，两个都过。

**四条硬门槛（逐条实测，全部通过）**

| 门槛 | 判据 | 结果 |
|---|---|---|
| ① `.rail-head` 白字 | 新七色对 `#f3ead7` ≥ 4.5 | **5.58 – 5.62**，极差 0.04 |
| ② `.log-entry` 正文 | `--ink-2` 对 7 个 `color-mix(--pc 10%,#fffcf2)` 底 ≥ 4.5 | **5.90 – 5.98** |
| ③ `.rail-win.hit` 白字 | `#f3ead7` 对 7 个 `color-mix(--pc 46%,#3a3f46)` 底 ≥ 4.5 | **7.22 – 7.40** |
| ④ 互相可辨 | 两两 `ΔE(OKLab)` | 最小 **0.079**（计划 P1 / 探险 P2），其余 **≥ 0.080** |
| 附 | `.rail-grp.past>.rail-head` 的 `--on-dark-2` 对 `color-mix(--pc 38%,#3a3f46)` | 5.60 – 5.71 ✅（一并核过，别以为只改了亮底的三个消费者） |

**方法（这套是「逐个挑」，不是机械降饱和）**

1. **先钉亮度**：七色统一解到「对 `#f3ead7` 恰 5.6:1」（不是各自挑对比度）。等亮度 = 等视觉权重，
   日志流不会因为「读到战斗条目整行变重」。
2. **再挑色相**：每个阶段手工指定一个颜料名（上表最后一列），色相窗口由语义锁死（如「旅行必须离开青区」），
   程序只在窗口内搜「让任意两色 ΔE 最大」的落点。**窗口是手画的，落点是算的**——这就是「逐个挑」。
3. **彩度不是统一值，而是各自顶到色域边界**：在 Y = 0.107（对 `#f3ead7` 恰 5.6:1）这条等亮度线上，
   sRGB 能给的彩度按色相差得很远——青（H221）最多 0.085、黄绿（H70/116）约 0.104–0.107、
   绿（H167）0.096，而紫/红/靛（H327 / 23 / 277）能到 0.20 以上。
   所以取「**0.10 为目标，色域不够的取上限**」：资源被压到 0.082，旅行 0.092，其余落在 0.099–0.100。
   这不是降饱和，是 sRGB 在等亮度线上的形状逼出来的唯一解。
4. **验证冗余通道**，见下。

**等亮度带来的两个副产品（也是最好的验收证据）**

- 7 个 `color-mix(--pc 10%,#fffcf2)` 的底色全部落在 **L\* 93.0 – 93.5**（极差 **0.5**）。
- 7 个 `color-mix(--pc 46%,#3a3f46)` 的命中底全部落在 **L\* 31.5 – 32.2**（极差 **0.7**）。

也就是说：日志流的底亮度与阶段无关，阶段信息**只由色相承担** → 「一眼扫下来不花」和
「每条都知道是哪个阶段」同时成立。反过来也要认账：

> **⚠ 灰度截图下这七色是不可区分的（L\* 相同），这是刻意的。**
> §8 那条「灰度测试」（第 701 行）只覆盖**状态点四态**——它靠形状编码，所以灰度下仍成立，
> 那条继续有效；但它**不覆盖七阶段色**，两者不能互相顶替。
> 竖轴有竖排阶段名（14px/500）+ 窗口编号，日志条目有 `tone-<key>` 类名与正文文本。
> **验收时不许把「阶段识别」写成「看颜色」**，否则一上灰度就整片失守。

**禁令**

1. 这 7 个 hex **不许再出现在 CSS 里**（唯一源是 `phase-log.js:7-16`）。要加第 8 个阶段，
   照上面三步重算，不许拍脑袋取色，也不许直接沿用 `--accent-*`。
2. 这 7 个值 **不上令牌表**：`--pc` 是数据注入，语义是「第 N 阶段」，不是「一个可复用的颜色」。
3. 与 §5.7-b 的 `trigger / action / forced` 三条线**互不混用**：那是「时机」色，这是「阶段」色，
   两者在同一行里会同时出现，任何一边配色都不能借用另一边的值。

### 5.8 卡图零滤镜后的状态载体（与 `WINDOWS.md` 约定的 6 件套）

卡图不许加滤镜之后，所有「状态」必须由**卡框外部**的几何与色块承担。这 6 件全部只用既有令牌，归位如下——前端按「归属节」找规范，不要自创样式：

| 载体 | 出现在 | 归入哪节 | 关键属性 | 对比度 |
|---|---|---|---|---|
| **右上角状态角标** `缺3` / `横` / `此刻不可用` / `已离场` | 卡框右上，压住卡图边角外侧 | §5.2（卡框状态） | `border:1px dashed var(--line-strong);background:var(--surface-sunken);color:var(--ink-2);font:600 10.5px/1.5 var(--font-body);border-radius:var(--radius-sm);padding:0 4px` | **5.36**（`--ink-2` 对 sunken）。⚠ 勿用 `--ink-3`，对 sunken 只有 **3.62**，小字不达标 |
| **左上角序号 / 状态徽章** | 卡框左上 | §5.4（徽章） | 金实心=已选：`background:var(--accent-gold);color:var(--on-gold)`；绿实心=已确认：`background:var(--accent-green);color:var(--on-gold)`；`border-radius:var(--radius-sm);padding:0 5px;font:700 11px/1.6` | 5.34 / 9.46 |
| **卡框左侧 3px 竖条** | `inset 3px 0 0` 于卡框 | §5.2 | 已跳过 = `--line-strong`；横置 = `--gold-line`。**纯装饰线，不参与对比度判定**（2.24 / 2.38，可见即可） | — |
| **不可支付** | 整卡 | §5.2 | 卡框 `1px dashed var(--line-strong)` + `background:var(--surface-chip)`；卡名/数值保持 `--ink`（6.02 起）。**替换 `filter:grayscale(1) brightness(.72)`** | 6.02+ |
| **横置** | 整卡 | §5.2 + §5.8 末条 | `background:var(--surface-sunken)` + `border-color:var(--gold-line)` + 卡图 `transform:rotate(90deg) scale(.7)`。**替换 `filter:brightness(.64) saturate(.7)`**（**必读末条「横置必须统一」**） | — |
| **等待中** | 卡名行尾 | §5.2 | 三点静态 `···`：用 `::after{content:"···";letter-spacing:1px;color:var(--ink-2)}`，**不用 emoji、不用动画** | 5.36+ |

**⚠ 横置必须统一成「旋转」通道（v1.2 裁决，优先级高于角标）**

现状三种卡对「横置」有**三套不同表达**，清掉滤镜后必须收敛成同一套，否则同一局里会出现「一种转、一种不转」：

| 现状 | 位置 | 处理 |
|---|---|---|
| `.character-card.exhausted .card-face img{transform:rotate(90deg) scale(.7)}` | `:39` | ✅ **这就是标准形态**，保留，作为基准 |
| `.table-card.exhausted .card-face img{filter:brightness(.64) saturate(.7)}` | `:38` | ❌ 只有压暗、**不旋转** → 改为与上面完全一致：`transform:rotate(90deg) scale(.7)` + 卡框 `--surface-sunken` 底 + `--gold-line` 边 |
| `.qp-card.is-exhausted .card-face img{transform:rotate(90deg) scale(.72);opacity:.55}` | `:1865` | ⚠ 已旋转但系数 `scale(.72)` 与 `scale(.7)` 不一致，且叠了 `opacity:.55` → 统一为 `scale(.7)`，**删掉 `opacity`**（它会把卡名压到不可读，见 §7 第 3 条） |

三条要点：

1. **旋转是唯一「不看颜色也一眼可辨」的通道**，比右上角角标更重要——角标要读到字才知道是什么，旋转是轮廓级的信号。所以横置**不允许**只靠底色 + 描边表达，`rotate(90deg)` 必须留着。
2. 旋转后的图像会被 `.card-face{overflow:hidden}` 裁切，这是**既有表现**（`.character-card` 一直在用），不是缺陷；`scale(.7)` 的作用是给裁切留边，三处必须取同一系数 `.7`。
3. `transform` 是几何变换，**不属滤镜**，不受 §7 第 1 条约束；但也不要给它加 `transition` 之外的任何 `filter` 配合。

### 5.9 现存 card-图滤镜清单（**v1.2 已裁决：全部清除，不开任何例外**）

全仓 `filter:` 检索结果，**7 处**，按「是否真的作用在卡图上」分类。这份清单是 §7 第 1 条的落地依据，逐条照做，不留例外：

| 位置 | 代码 | 状态 | 处理 |
|---|---|---|---|
| `style.css:38` | `.table-card.selectable .card-face:hover{filter:brightness(1.1)}` | ⚠ **生效**，hover 提亮卡面 | 改 `border-color:var(--gold-line)` + `box-shadow:0 0 0 2px #b79a6266` |
| `style.css:38` | `.table-card.exhausted .card-face img{filter:brightness(.64) saturate(.7)}` | ⚠ **生效** | 按 §5.8 末条「横置必须统一」：改为 `transform:rotate(90deg) scale(.7)` + `--surface-sunken` 底 + `--gold-line` 边 |
| `style.css:515` | `.hand-card.unaffordable .card-face img{filter:grayscale(1) brightness(.72)}` | ⚠ **生效** | 按 §5.8「不可支付」：虚线框 + 角标 + `--surface-chip` 底 |
| `style.css:1867` | `.qp-card.is-gone .card-face img{filter:grayscale(1)}` | ⚠ **生效**（派遣名单「已离场」） | 同「不可支付」处理；另 `.qp-card.is-gone{opacity:.4}` 一并改为「虚线框 + 角标」 |
| `style.css:1865` | `.qp-card.is-exhausted .card-face img{…scale(.72);opacity:.55}` | ⚠ **非滤镜，但同属「卡图被压暗 + 系数不一致」** | 统一 `scale(.7)`，删 `opacity`，见 §5.8 末条 |
| `style.css:198 / 232` | `.ng-card.locked .ng-card-art{filter:grayscale(.9) contrast(.95)}`、`… img{filter:grayscale(.25)}` | ☠ **死代码**：已被 `:242 / :243 / :296` 的 `filter:none` 覆盖 | **直接删除**，否则以后有人改优先级就会复活 |
| `style.css:1231` | `.rail-grp.past>.rail-head{filter:saturate(.42) brightness(.72)}` | ❌ **不是卡图，是文字**：`filter` 会连文字一起去色压暗，等于绕过对比度规则 | 改 `color:var(--ink-2)`，并用「无金条」表达已过 |

> 裁决理由（团队定论，勿再讨论）：例外一开就收不回来；而且「`filter` 打在含文字的容器上」本质是绕过对比度规则——与「`--ink-3` 只能做描边/图标/≥24px」是同一件事，都属「用技术手段规避可读性门槛」。

> 一条通用判据：**`filter` 只允许出现在 `drop-shadow`（投影）与「图案背景层」（如 `.ng-card-art.has-art::before` 那张模糊填充图）上。** 任何作用在 `img` 或含文字容器上的 `filter` 都要当作缺陷处理。

### 5.10 日志面板（`.phase-log`，`style.css:1436-1495`）剩余字面量审计

整段 60 行里仍残留 11 个冷灰绿字面量。分三类处理：**真不达标（3 条）/ 对比度合格但色温错（7 条）/ 必须加边的（1 条）**。
判定用的「实际背景」不是猜的：`.tabletop-rail` 底已是 `var(--surface-mat)` `#f7f1de`（`style.css:724`），
面板内三块另给自己的底（`#fdfcf5` × 3、`#f8f7ee` × 1），`.log-entry` 的底随阶段色变（见 §5.7-c）。

| 字面量 | 选择器 / 属性 | 实际背景 | 对比度 | 结论与建议 |
|---|---|---|---|---|
| `#8a9282` | `.log-count` 的 `color`（10px） | `#f7f1de` | **2.85 ❌** | **真不达标。→ `var(--ink-2)` `#545b4d`（6.24）。不能用 `--ink-3`：对 `#f7f1de` 只有 4.21，仍不够。** |
| `#8b9385` | `.log-empty` 的 `color`（11px） | `#f7f1de` | **2.81 ❌** | **真不达标。→ `var(--ink-2)`（6.24）。** 空态文案是次要信息，但次要≠可读性打折 |
| `#6d7a68` | `.log-undo` 的 `color`（16×16 按钮内符号） | `#fdfcf5` | **4.41 ❌** | **真不达标，只差 0.09。→ `var(--ink-2)`（6.86）。** 不用 `--ink-3`（4.64，余量 0.14，撑不住以后加底纹/换底） |
| `#4c5748` | `.log-text` 的 `color`（11px） | 7 个 `color-mix(--pc 10%,#fffcf2)` | **6.36 – 6.44 ✅** | 合格，改的理由只有「令牌化」：→ `var(--ink-2)` 最差 5.90，**仍过**。它是整段最后一个没令牌的正文色，留着没人知道该抄哪个 |
| `#3c4a3a` | `.log-scope-btn:hover` / `.log-more:hover` 的 `color` | `#f1f0e4` → `#f1ead3` | **8.21 ✅** | 合格但偏冷。→ `var(--ink)`（对 `--surface-wash` **10.92**）。静息态是 `--ink-2`，hover 必须深一档，`--ink` 是唯一的上一档 |
| `#3c4a3a` | `.log-scope-btn.active` 的 `background` | —（深填充） | 非文字 | → `var(--accent-green)` `#2f4a3b`。段控的「选中」是全站唯一的实心绿，同源不新造色 |
| `#f8f7ee` | `.log-scope-btn.active` 的 `color` | `#3c4a3a` | **8.75 ✅** | 合格。→ `var(--on-dark)`（对 `--accent-green` **8.12** ✅） |
| `#fdfcf5` | `.log-scope` / `.log-more` / `.log-undo` 的 `background` | — | 非文字 | → `var(--surface-pop)` `#fffcf2`。**ΔL\* 仅 0.1**，换它纯粹为了色温（偏绿灰 → 暖白），不改变任何层次 |
| `#f1f0e4` | `.log-scope-btn:hover` / `.log-more:hover` 的 `background` | 静息底 `#fdfcf5` | 非文字 | → `var(--surface-wash)` `#f1ead3`。对静息底 **ΔL\* 4.3 → 6.2**，色温转暖且反馈更清楚（原值对 rail 底只有 ΔL\* 0.6，等于没有底） |
| `#f0efe2` | `.log-undo:hover` 的 `background` | 静息底 `#fdfcf5` | 非文字 | → `var(--surface-wash)`。同上 |
| `#d6dacd` | `.log-scope` / `.log-undo` 的 `border` | 内底 `#fdfcf5` 1.38 · 外底 `#f7f1de` 1.26 | 非文字 | → `var(--line-soft)` `#ded3b6`（ΔL\* 1.7）。**不追 3:1**：这个控件的可识别性来自填充与底色的差（**ΔL\* 3.7**），边框只是收边，不是识别通道 |
| `#cfd4c6` | `.log-more` 的虚线 `border` | 内底 `#fdfcf5` 1.47 · 外底 `#f7f1de` 1.34 | 非文字 | → **`var(--line-strong)` `#b3a179`**（对 rail 底 2.24，ΔL\* 17.3）。这是全段**唯一**一个靠「线」而不是靠「填充」被看见的控件（虚线圈就是它的按钮形态），1.34 太淡，必须升一档 |
| `#f8f7ee` | `.log-round-head` 的 `background`（sticky 表头） | 与 rail 底 ΔL\* **1.9** | 非文字 | **不能只换令牌。** 换成 `--surface-chip`（L\* 93.7）会正好撞进 7 个日志底（L\* 93.0–93.5）的区间，表头和条目糊成一片。→ 改 `background:var(--surface-mat)`（= rail 色，等于「透出底」）+ **加 `border-bottom:1px solid var(--line-soft)`**：靠一条线分带，不靠填充 |

**一句话结论**：这 11 个字面量里，**3 条是真不达标（`#8a9282` 2.85 / `#8b9385` 2.81 / `#6d7a68` 4.41）**，
其余 7 条对比度本来就过、只是色温不对（`#4c5748` 也属这类），
另有 **1 条（`.log-round-head`）是唯一不能只换色、必须补一条 1px 边**的。
`#6d7a68` 那条尤其要提醒：4.41 只差 0.09，任何「差不多就行」的验算都会把它放过。

> 复核提醒：`#8a9282` 这个值曾被报成「对 `#f7f1de` 是 2.84」，本次按实际背景精确复算为 **2.85**；
> 而 `#768174` 对 `#e1d7be`（page）同样是 **2.84** —— 两个 2.84/2.85 是**两个不同色对**，
> 写验收记录时不要合并成一条。

### 5.11 深色件三处裁定（活跃玩家标签 / 可选中卡框 / 顶栏药丸）

全量采样把「实际渲染色」扫出来之后，剩下三处不是"替换"能解决的、必须做**判断**的地方。三处的病根是同一个：**一个语义位被塞进了第二个色相**。

一条总则（这三处都靠它裁决）：

> **深色画框（顶栏 / 牌桌）里只允许两个"语义色"——金（当前 · 选中 · 可操作）与红（淘汰 · 危险 · 强制）。其余所有状态只许用「亮度分级」，不许引入第三个色相。**
> 理由不是审美洁癖：色相是**编码通道**，一个框里出现第二个色相，玩家必须停下来判断"这个蓝色是什么意思"——而它没有意思，它只是旧配色漏下来的。金与红已经成为这个系统的**词汇**（`.rail-step.current` 金条、`--state-sel-bg`、`.table-card.selected` 金框、`.elim-mark` 红），第三个色相就是第二次读表。

#### A. 活跃玩家标签（`.game-hud .player-tabs button.active`）

| 现状 | 值 | L\* | 问题 |
|---|---|---|---|
| 非活跃底 | `var(--surface-header-2)` `#35483b` | 28.7 | — |
| hover 底 | `#46604c`（字面量） | 38.2 | 色温偏冷，且是个未令牌的值 |
| **active 底** | `#527085` | **45.7** | OKLCh **H239 / C0.048**：一个**几乎无彩的灰蓝**，却亮了 17 个 L\*。它不是"更醒目的绿"，是"绿框里贴了一块冷灰板" |

三处失败（全部实测）：① 名字 `--on-dark` 对 `#527085` = **4.37**（14px 需 4.5）；② `.tab-stats` `#dfe7d8` = **4.12**；③ 顶栏出现第二个色相。**注意 ① 只有 0.13 的缺口**——这类"差一点点"最容易被"看起来还行"放过。

| 状态 | 底色 | 边框 | 主字 | stats | 第二通道 |
|---|---|---|---|---|---|
| 非活跃 | `var(--surface-header-2)` `#35483b`（L\*28.7） | `var(--line-strong)` | `--on-dark` **8.20** | `--on-dark-2` **6.13** | — |
| hover | `var(--accent-green-hi)` `#3a5a48`（L\*35.4） | `var(--gold-line)` | `--on-gold` **7.48** | `--on-dark-2` **4.80** | — |
| **active** | **`#4b6d48`**（L\*42.6，OKLCh H143 C0.070） | `var(--gold-line)` | `--on-gold` **5.71** | **`--on-dark`** 4.91 | **`box-shadow:inset 0 -3px 0 var(--on-dark-gold)`** 3.60 |

- 三级台阶 **28.7 → 35.4 → 42.6**，每级 ΔL\* ≈ 6.8，是"三级台阶"而不是"两档糊在一起"。
- 色相锁在 **H143–151**（顶栏自己的绿），不引入第二色相。`#4b6d48` 与 hover 的 `ΔE` 只有 0.067，所以第二通道不是可选项，是必需的。
- **下边框不能用 `--gold-line`**：它在 `#4b6d48` 上只有 **2.18**，3px 图形门槛 3:1 不过。必须用 `--on-dark-gold`（**3.60**）。这是 §1 通则第 ③ 类条件（暗底图形用 `-on-dark` 变体）的又一次应用，和 §5.7-b 的 `forced` 线是同一件事。
- stats 在 active 上必须用 `--on-dark`（4.91），**不能用 `--on-dark-2`**（3.64 不过）。

**⚠ 顺带修掉一个"现在就已经看不见"的东西**

`.player-tabs .first-mark{background:var(--accent-gold)}` 在 active 底上实测 **1.05**（旧蓝底）/ **1.07**（新绿底）——金药丸在活跃标签上一直是隐形轮廓，只是没人拿计算器量过。`.elim-mark` 的 `--accent-red` 同样只有 **1.83 / 1.09**。

处方是**反相**，不是换色相：

```css
.player-tabs .first-mark{ background:var(--on-dark-gold);          color:var(--surface-header) }  /* 7.09 */
.player-tabs .elim-mark { background:var(--accent-red-on-dark);    color:var(--surface-header) }  /* 4.92 */
```

> **通则：顶栏里的"药丸标记"必须在深底上反相（亮底 + 深字）。** 因为 `#35483b` / `#4b6d48` 的 L\* 落在 28–43 之间，任何**中间明度**的填充（`--accent-gold` 44.4、`--accent-red` ≈33）都会陷进去。深底上的填充色只有两种选择：比底更亮（`--on-dark-gold` 81.5 / `--accent-red-on-dark` ≈69）或比底更暗；中间值是禁区。

#### B. 可选中卡框（`.table-card.selectable`）

| 现状 | 值 | 对 `#182630` |
|---|---|---|
| 卡底 | `#182630` | L\* 14.4 |
| **可选中** | `#79b9db`（OKLCh **H233 / C0.082 / L\*72.1**，全页饱和度最高的冷色） | 7.19（1px）+ 晕 `#79b9db55` |
| hover | `var(--gold-line)` | 5.75（1px）+ 晕 2px |
| 已选 | `#e8c473` | 9.25（2px）+ 光晕 + 实心标记 |

**先指出现有阶梯是倒的**：可选中 7.19 > hover 5.75 —— "我指着它"比"它可点"**更暗**。原因是蓝被当成了基准线，金只能来做"加强"，而 `--gold-line` 天生比 `#79b9db` 暗。这不是配色偏好问题，是层级 bug。

| 状态 | 边框 | 外环 | 附加 | 对 `#182630` |
|---|---|---|---|---|
| 可选中（能点，未承诺） | 1px `var(--gold-line)` `#b79a62` | `0 0 0 1px #b79a6240` | — | **5.75** |
| 指向（hover / focus-visible） | 1px `var(--on-dark-gold)` `#e2c88c` | `0 0 0 2px #b79a6266` | — | **9.47** |
| 已选（定了） | **2px** `var(--on-dark-gold)` | `0 0 12px #e2c88c44` | 实心标记块：`background:var(--on-dark-gold);color:var(--surface-header)` **7.09** | **9.47** |

- 分工不是「外环 vs 内描边」，而是**明度台阶 + 线宽 + 有无填充块**三个通道。团队提的"外环 + 内描边"我不采用：`.table-card` 的 `padding` 只有 3–4px，内描边会紧贴卡图边缘，读起来像**卡图自身的边框**而不是"容器的状态"，反而把语义弄糊。外环（`box-shadow`）画在卡框之外，不可能被图遮住，是这里的唯一可靠通道。
- `--accent-gold` 对 `#182630` = **2.82**（团队算 2.73，四舍五入不同，都 <3:1），**它退出深底描边岗位**。深底上：**描边/图形用 `--gold-line`（5.75）与 `--on-dark-gold`（9.47）；`--accent-gold` 只当填充**（其上 `--on-gold` 5.34 达标，见 §5.8 金实心徽章）。
- 顺带：`.qp-card.is-selected` 的 `#e8c473` 与 `.table-card.selected` 是同一个语义，一并换 `var(--on-dark-gold)`；`.selection-mark` 的 `#e8c473` / `#202936` 一起换成 `var(--on-dark-gold)` / `var(--surface-header)`。

> **语义分工一句话**：可选中＝金的**暗一档细线**（提示可点，不承诺）；已选＝金的**亮一档粗线 + 光晕 + 实心块**（承诺已定）。两者**同色相同色系、不同明度与权重**——不许靠"换成另一个色相"来区分状态，那等于把"同一个东西的两级状态"说成"两个不同的东西"。

---

## 6. 硬编码色映射表（批量替换用）

按「旧值 → 新令牌 → 用途」，覆盖 `style.css` 中出现频率最高 + 语义最重要的 34 条。

| # | 旧 HEX | 出现次数 | 新令牌 | 用途 / 替换注意 |
|---|---|---|---|---|
| 1 | `#fffdf6` | 31 | `var(--surface-pop)` | 按钮面、卡框、浮层底、操作条底。**卡框容器必须保留不透明** |
| 2 | `#fff` | 22 | 背景 → `var(--surface-pop)`；文字 → `var(--on-gold)` | `input{background:#fff}` 与 `button.primary{color:#fff}` 语义不同，**必须人工分辨，不能一键替换** |
| 3 | `#5f6a58` | 18 | `var(--ink-2)` | 卡内次要说明、`.pc-count`、禁止线文字、折叠摘要 |
| 4 | `#d8dcd0` | 15 | `var(--line)` | 主要分隔与容器描边（`var(--line)` 已指向新值，多数无需改） |
| 5 | `#365842` | 15 | `var(--accent-green)` | 主按钮底、当前阶段底、已有 `var(--green)` 引用自动跟随 |
| 6 | `#ad8b4b` | 10 | 填充/描边 → `var(--accent-gold)`；**小字文字 → `var(--gold-ink)`**；细线 → `var(--gold-line)` | 三种用法必须分开处理，这是最容易出错的一条 |
| 7 | `#24392f` | 10 | `var(--ink)` | 正文与 `<b>`。`.desktop-table main button{color:#24392f}` 同理 |
| 8 | `#c9b98a` | 9 | `var(--line-warm)` | decide 触发条/浮层描边、操作条描边、开局面板虚线 |
| 9 | `#3f6a48` | 9 | `var(--accent-green-hi)` | `[data-state="ok"] .dot` 等状态点填充；若为文字改 `--green-ink` |
| 10 | `#e2e5d9` | 8 | `var(--line-soft)` | 卡内分隔、进度条轨道、`.player-mat` 内区块分隔 |
| 11 | `#eef4e9` | 7 | `var(--state-ok-bg)` | `.decide-list li.ok`、`deck-valid` 一类成功底 |
| 12 | `#3f5047` | 7 | `var(--ink-2)` | 12.5–13px 芯片文字（`#f6f5ec` 底）。新值对比 6.02，仍达标 |
| 13 | `#2f4038` | 7 | `var(--ink)` | 触发条正文、`window-option span`。旧值偏深绿，统一到 `--ink` |
| 14 | `#f2f1e7` | 6 | `var(--surface-chip)` | `.badge`、`.decide-list li`、`.mat-phase .badge` |
| 15 | `#a8c2a1` | 6 | `var(--line-strong)` 或 `--state-ok-ink` | 成功态描边用后者（`#3d5c37`）更清楚；旧值对 `#eef4e9` 仅 1.72:1，作为「边界」几乎不可见 |
| 16 | `#768174` | 6 | `var(--ink-2)` | **`--muted` 已指向新值**；残留硬编码一并替换 |
| 17 | `#6b5a35` | 6 | `var(--gold-ink)` | `.notice` 文字、`.decide-hint`、金底浅字 |
| 18 | `#f6e3ad` | 5 | `var(--on-dark-gold)` | 顶栏 `.hud-name`、`nav button.active`（对 `#2b3d31` 7.09） |
| 19 | `#a35446` | 5 | 填充 → `var(--accent-red)`；文字 → `var(--red-ink)` | 伤害/横置/危险。**文字场景必须换 `--red-ink`**（旧值对 page 3.75） |
| 20 | `#3b5141` | 5 | `var(--surface-header-2)` | 顶栏内按钮底、HUD 分隔线 |
| 21 | `#efeee2` | 4 | `var(--surface-sunken)` | `.card-face` 底衬、卡图占位底 |
| 22 | `#f7f5ea` | 4 | `var(--surface-mat)` | 浅纸块（`#fbfaf3` 同理，见 26） |
| 23 | `#c6ac74` | 4 | `var(--gold-line)` | `.player-mat` 顶部 3px 金条、`.notice` 左条、开局面板描边 |
| 24 | `#42603b` | 4 | `var(--state-win-ink)` | `.win` 文字（`#dfead4` 底，6.20） |
| 25 | `#934f3c` | 3 | `var(--state-lost-ink)`（`#8a4231`） | `.lost` 文字（`#f2ddd3` 底，5.53） |
| 26 | `#f4eddc` | 3 | `var(--state-notice-bg)` | `.notice` 底 |
| 27 | `#f2dfd5` | 3 | `var(--state-lost-bg)` | `.lost` 底 |
| 28 | `#273f32` | 3 | `var(--surface-header)`（`#2b3d31`） | 顶栏底色、`.pile-cards` 渐变终点 |
| 29 | `#55693f` | 3 | `var(--green-ink)` | 牌堆计数数字（旧值对 `#eef0e5` 5.24，新值 5.27，观感更沉） |
| 30 | `#a26a34` | 3 | `var(--warn-ink)`（`#7e4f1c`） | `.warning-text`（旧值对 page 3.16，不达标） |
| 31 | `#e9ece4` | 3 | `var(--surface-page)` | `body` 与 `body:has(.desktop-table)` 底色 |
| 32 | `#4a7b7c` 系（`.sphere-*` 五色 `#886a9b #ad6155 #6e9db5 #699875 #a49777`） | 各 1 | **保留原值不动** | 领域色只做 `border-top` 4px 竖带，**从不承载文字**，因此不受对比度约束；它们是「领域识别」的唯一线索，动它等于改规则 |
| 33 | `#c08f2c` | 2 | `var(--accent-gold)` | `.decide-dot` 的 `todo` 态填充。退役字面量，**不要为它新增令牌**；状态点四态见 §5.6 |
| 34 | `#a3544626` / `#84642426` 这类 8 位带 alpha 的字面量 | 多处 | 保留 8 位写法 | 阴影/光环不参与对比度；只需保证 alpha 段与对应令牌同色相（`#RRGGBB`+`AA`） |

**v1.4 追加 8 条（深色件专用，裁定见 §5.11 与 §5.7-b）**

| # | 旧 HEX | 位置 | 新值 | 注意 |
|---|---|---|---|---|
| 35 | `#527085` | `.game-hud .player-tabs button.active`（`:1683`，`:133` 是旧 SPA 重复声明） | **新值 `#4b6d48`** | 唯一一处需要**新增字面量**的地方（不新增令牌，理由见 §5.11-A） |
| 36 | `#46604c` | `:374` `.history-nav button:hover`、`:1682` 玩家标签 hover、`:1687` reset hover | `var(--accent-green-hi)` | 三处一起换 |
| 37 | `#79b9db` + `#79b9db55` | `.table-card.selectable`（`:134`） | `var(--gold-line)` + `#b79a6240` | 蓝 → 暗金，阶梯由倒转正 |
| 38 | `#e8c473` + `#e8c47344` | `.table-card.selected`（`:136`）、`.qp-card.is-selected`（`:2046`） | `var(--on-dark-gold)` + `#e2c88c44` | 两个组件同一语义，必须一起改 |
| 39 | `#e8c473` / `#202936` | `.selection-mark` | `var(--on-dark-gold)` / `var(--surface-header)` | 7.09 |
| 40 | `#e8c169` | `[data-timing="trigger"]` 竖线（`:1391`） | **新值 `#cda351`** | 见 §5.7-b |
| 41 | `#6ea86b` | `[data-timing="action"]` 竖线（`:1392`） | **新值 `#72b97d`** | 见 §5.7-b |
| 42 | `--accent-gold` 当药丸底 | `.player-tabs .first-mark`（`:572`，在深底上） | `var(--on-dark-gold)` + `color:var(--surface-header)` | 原值 1.05，现在隐形；`.elim-mark` 同理改 `--accent-red-on-dark` |

**替换顺序建议**（前端执行时按此顺序，避免互相覆盖）：
① 先改 `:root`（令牌 + 兼容别名）→ ② 跑一次 `node scripts/check-contrast.cjs` 建立基线 → ③ 替换填充类（`background`）→ ④ 替换文字类（`color`，此步最危险，必须逐条看）→ ⑤ 替换描边类 → ⑥ 再跑验收脚本，对比基线只允许「问题项减少」。

---

## 7. 禁用清单（这些做了就是不合格）

1. ❌ **给 `img` / `.card-face` / `.card-art` / 卡图容器加任何 `filter`**（`sepia` / `saturate` / `hue-rotate` / `brightness` / `grayscale` 全部禁止）。暖调只落在容器的 `background-color` 上。**已裁决：现存 7 处全部清除，不开任何例外**，逐条见 §5.9。
   **边界**：`filter` 只允许出现在**装饰性矢量图标**上（如 `.nav-home .brand-mark` 那条），因为图标不承载内容色准。
   **`transform` 不在本禁令范围内** —— `rotate(90deg)` 是横置状态唯一的几何通道，清滤镜时**绝对不能连它一起删**。`transform` 是几何变换，`filter` 是像素重采样，两者不是同一类东西。
2. ❌ **把 `filter` 用在含文字的容器上**（如 `.rail-grp.past>.rail-head{filter:saturate(.42) brightness(.72)}`）。`filter` 会连文字一起压暗，等于绕过对比度规则；要「变淡」就换 `color`，要「弱化」就减权重。
3. ❌ **用 `opacity` 做文字衰减**（`.rail-step.past{opacity:.68}`、`.table-card.unavailable{opacity:.55}`、`.hand-card.unaffordable{opacity:.82}`、`.qp-card.is-gone{opacity:.4}` 四处都要改）。实测：同一段文字 `opacity:.55` → 3.36:1、`.62` → 4.05:1、`.70` → 5.08:1，**只要 < 0.7 就一定跌破 4.5**。视觉上「淡一点」和「可读」在这套浅底上不可兼得，必须换手段（虚线框 / 角标 / 换底色）。
4. ❌ **只靠颜色区分「强制 / 可选 / 等待 / 知会」**。四条判据必须落在形状与线型上（实心 / 空心、圆 / 方、虚线 / 实线），颜色只做加成。理由是颜色属单通道编码，色弱、灰度打印、强制高对比模式下会全部塌成一个灰点。见 §5.6 状态点四态表。
5. ❌ **纹理挂到 `img` / 卡面 / 卡框**上，或任何 `background-image` 覆盖在文字之上（`z-index` 为正的覆盖层一律禁止）。
6. ❌ **`transform:scale()` 用于 hover**（位移 `translateY` 在手牌扇形上是既有交互，允许；`scale` 会改字重观感与像素对齐）。**注意边界**：本条只限 hover 场景——横置的 `rotate(90deg) scale(.7)`、手牌扇形的 `scale` 比例都不受限（见第 16 条）。
7. ❌ **深色大块内嵌在浅色区里**（如 `.mat-phase>.opening-panel{background:#2b3d33}`）。桌面只允许一个深色件：顶栏。
8. ❌ **`outline:none` 且不给替代焦点样式**；也不允许只用 `box-shadow` 做焦点（高对比模式下会消失，必须用 `outline`）。
9. ❌ **`#ad8b4b` 这类浅金直接当 12–13px 文字色**（对 page 2.23，对卡面 3.11，连 3:1 大字线都只在最亮面上勉强够）。金字一律 `--gold-ink`。
10. ❌ **同一屏两处以上 `text-transform:uppercase` + `letter-spacing` 装饰文**（`.eyebrow` 只允许 1 处/屏；`.scenario:before{content:'✥'}` 60% 隐形的装饰大字建议删）。
11. ❌ **emoji 充当图标**（`.pile-cards::after{content:"◈"}` 属装饰符号，可保留；🚀✅⚠️ 一律禁止，改用纯 CSS 几何形或文字；等待态用 `::after{content:"···"}`）。
12. ❌ **新增字族**（Tailwind/组件库/新 webfont）。三套字体已够，新增只会增加子集化负担与加载抖动。
13. ❌ **新的圆角值**（现在文件里有 5/6/7/8/9/10/12px 六种）。只允许 `--radius-sm/md/lg/pill`（`--radius-xl` 已退役，见 §1）。
14. ❌ **把 `--surface-pop` 之外的颜色当卡框底**（卡图必须站在最亮层上，否则 1500 张扫描图的暗部会糊进底色）。
15. ❌ **把 `danger` 用在可逆操作上**（如「放弃本窗口行动」「取消放弃」）。danger 只给不可逆操作，否则红色会被用成装饰，真危险时喊不出来。
16. ❌ **用「只压暗 / 只描边」表达横置**。横置的唯一主通道是 `transform:rotate(90deg) scale(.7)`，底色与描边只做辅助；三种卡（`.character-card` / `.table-card` / `.qp-card`）必须系数一致、形态一致，否则同一局里会出现「一种转、一种不转」。见 §5.8 末条。
17. ❌ **为了达标去改「底」而不是改「前景」**。典型：把 `.rail-wins` 的 `#3a3f46` 改深，去让 `#c9544a` 这条 3px 线达到 3:1。底色是这一个组件的结构决策（深底 = 在羊皮纸页上不抢牌桌），它牵动同一块里所有文字；前景色才是为对比度服务的。**提升对比度只能动前景值（换令牌），不能动底色值。** 反过来也成立：不要为了「语义看起来一致」把暗底的值套回亮底，或把亮底的值套到暗底（`--accent-red` 与 `--accent-red-on-dark` 就是为此拆的）。
18. ❌ **在深色画框里用第三个色相编码状态**。顶栏 / 牌桌只允许金（当前 · 选中 · 可操作）与红（淘汰 · 危险 · 强制），其余状态一律用亮度分级。旧的 `#527085`（活跃玩家标签，灰蓝）与 `#79b9db`（可选中卡框，冷天蓝）就是被这条判不合格的两例，见 §5.11。
19. ❌ **在深色底上用中间明度的填充做药丸/标记**。`#35483b`(L\*28.7) / `#4b6d48`(42.6) 这类底上，`--accent-gold`(44.4) 与 `--accent-red`(≈33) 会完全陷进去（实测 1.05 / 1.83）。深底上的填充只有两条路：比底更亮（`--on-dark-gold` 81.5、`--accent-red-on-dark`）或比底更暗，中间值是禁区。见 §5.11-A。
20. ❌ **靠「换成另一个色相」来区分两个相邻状态**（可选中 vs 已选中、hover vs active、todo vs forced）。状态是同一个东西的两级，必须用**同色相的明度台阶 + 几何通道（线宽 / 填充块 / 下边框）**表达。换色相等于把它们说成两个不同的东西，玩家每次都要重新学一遍词汇。

---

## 8. 自查清单（前端交付前逐条打勾）

**对比度**

- [ ] 所有 `≤16px` 文字的对色比 ≥ 4.5:1；≥24px 或 ≥18.66px bold 的标题 ≥ 3:1
- [ ] 三档墨色使用正确：正文 `--ink`、次要 `--ink-2`、`--ink-3` **只出现在描边/图标/禁用/≥24px**
- [ ] 金色文字全部是 `--gold-ink`，没有残留 `#ad8b4b` 当小字
- [ ] 金色填充上只有 `--on-gold` 文字（`#846424` + `#FFFCF2` = 5.34）
- [ ] `node scripts/check-contrast.cjs --min 4.5` 与 `--min 3` 两次都不新增问题项
- [ ] 新增的 `.rail-step.past` / `.table-card.unavailable` 文字在 `--ink-2` 以上
- [ ] 卡角标文字用 `--ink-2`（对 `--surface-sunken` 5.36），**没有误用 `--ink-3`**（只有 3.62）

**卡图**

- [ ] 全仓检索 `filter:` —— `.card-face` / `img` 上没有新增任何一项；§5.9 清单 7 处已按标注处理
- [ ] `.table-card.selectable .card-face:hover{filter:brightness(1.1)}` 已换成 `border-color` + `box-shadow`
- [ ] `.table-card.exhausted` 已从「只压暗」改成 `.character-card.exhausted` 同款 `rotate(90deg) scale(.7)` + sunken 底 + gold-line 边（**三处横置系数统一 `.7`**）
- [ ] `.qp-card.is-exhausted` 的 `scale(.72)` 与 `opacity:.55` 已按上一条收敛
- [ ] `.hand-card.unaffordable .card-face img{filter:grayscale(1) brightness(.72)}` 已换成 §5.8「不可支付」（已裁决：全清，无例外）
- [ ] `.qp-card.is-gone .card-face img{filter:grayscale(1)}` 与 `.qp-card.is-gone{opacity:.4}` 已改（虚线框 + 角标）
- [ ] `.ng-card.locked` 的两条 `grayscale` 死代码已删（防复活）
- [ ] 卡框 `.table-card` / `.card-face` 的 `background-color` 不透明（不是 `rgba`/`transparent`）
- [ ] 纹理容器列表里没有 `.table-card` / `.card-art` / `.card-face`

**纹理**

- [ ] 生效的 alpha ≤ 0.06（data-URI 内 `opacity` 与 `::before{opacity}` 二者取大，不许叠加）
- [ ] 760px 以下与 `prefers-reduced-data` 下 `--grain-tex:none` 生效
- [ ] 没有外部图片请求（Network 面板里纹理零请求）
- [ ] `::before` 写法带 `isolation:isolate` + `z-index:-1` + `pointer-events:none`

**交互**

- [ ] 所有 hover 只改 `background` / `border-color` / `color` / `box-shadow`
- [ ] 无 `transform:scale()`（手牌 `translateY` 是唯一例外）
- [ ] 每个可聚焦元素都有 `:focus-visible` 且 `outline-offset ≥ 2px`
- [ ] 深色件（顶栏）内的焦点环用 `--focus-ring-on-dark`
- [ ] 禁用按钮 hover 无视觉变化
- [ ] 状态点四态做了**灰度测试**：把页面截图转灰度后，`todo`（实心圆）/ `forced`（实心方）/ `wait`（空心虚线）/ `info`（空心实线）四者仍可区分
- [ ] 状态点四态**几何尺寸一致**（同一 `width/height`），换态时触发条高度不跳动
- [ ] `forced` / `wait` / `info` 的 `aria-label` 分别带「强制 · 」/「等待 · 」/「回执 · 」前缀
- [ ] `wait` 态闪动 ≤2 次，且 `prefers-reduced-motion:reduce` 下 `animation:none`；其余三态不闪

**阶段色与日志面板（v1.3 新增）**

- [ ] `phase-log.js:7-16` 的 7 个 hex 已全部换成 §5.7-c 的值，CSS 里不再出现这 7 个旧值
- [ ] 7 个阶段色在 `.rail-head`（`--on-dark`）、`.rail-win.hit`、`.log-entry`（`--ink-2`）三处实测均 ≥4.5
- [ ] 阶段色**未**被写进 `:root`，也未复用 `--accent-*` 的值
- [ ] 日志面板 11 个字面量已按 §5.10 替换；`#8a9282` / `#8b9385` / `#6d7a68` 三条必须消失
- [ ] `.log-round-head` 加了 `border-bottom:1px solid var(--line-soft)`（这一处**不能只换色**）

**深色件（v1.4 新增）**

- [ ] 活跃玩家标签底是 `#4b6d48`，其上下边为 `inset 0 -3px 0 var(--on-dark-gold)`（不是 `--gold-line`）
- [ ] 活跃标签的 `.tab-stats` 用 `--on-dark`（4.91），**不是** `--on-dark-2`（3.64）
- [ ] 顶栏/牌桌里再也搜不到 `#527085` / `#79b9db` / `#e8c473` / `#46604c` / `#e8c169` / `#6ea86b`
- [ ] `.first-mark` / `.elim-mark` 在深底上已反相（亮底 + `--surface-header` 字），没有中间明度填充
- [ ] 可选中卡框的三级阶梯实测为 5.75 → 9.47 → 9.47+光晕，且**可选中 < 指向**（旧版是倒的）
- [ ] 阶段竖轴三线对 `#3a3f46` 均为 4.5 左右（4.51–4.52），L\* 落在 69.2–69.3

**令牌与兼容**

- [ ] `--ink --muted --paper --line --green --gold --red` 七个旧名全部存在且指向新值
- [ ] 圆角只剩 **4 个**令牌（`--radius-sm/md/lg` + `--radius-pill`），`--radius-xl` 已无引用；间距只用 `--space-1..6`
- [ ] `python build.py` 后 `index.html` 内联样式正常（data-URI 未被转义破坏）

---

## 9. 已定裁决（v1.2，无悬空项）

**A. 卡图零滤镜 —— 全部清除，不开任何例外。已定。**
7 处逐条见 **§5.9**：4 处活的（`:38` selectable hover / `:38` exhausted / `:515` unaffordable / `:1867` qp-card.is-gone）按 §5.8 的状态载体重建语义；2 处死代码（`.ng-card.locked` 的两条 `grayscale`）直接删除，防优先级一变就复活；1 处打在文字上的（`.rail-grp.past>.rail-head` 的 `filter:saturate(.42) brightness(.72)`）改 `color:var(--ink-2)`。
裁决理由：例外一开就收不回来；且「`filter` 打在含文字容器上」本质是绕过对比度规则，与「`--ink-3` 只能做描边/图标/≥24px」是同一类问题。
附：状态角标文字定为 `--ink-2`（对 `--surface-sunken` **5.36:1**），不用 `--ink-3`（**3.62:1**，小字不达标）。

**B. 顶栏保留深色 `--surface-header #2B3D31`。已定。**
它是全站唯一深色块，起画框作用；HUD 三档 `--on-dark`（`#f3ead7` 9.68 / `#c8cfbe` 7.23 / `#e2c88c` 7.09）已全部达标。改浅需动约 30 处深色引用并重排 HUD 十二标签，不做。

**C. 横置统一为「旋转」通道。已定。**
`.character-card.exhausted` 的 `rotate(90deg) scale(.7)` 是基准形态；`.table-card.exhausted`（原本只压暗不旋转）与 `.qp-card.is-exhausted`（`scale(.72)` + `opacity:.55`）全部收敛到基准。详见 §5.8 末条。旋转是唯一「不看颜色也一眼可辨」的通道，优先级高于角标。

**D. 状态点采用「形状通道」四态。已定。**
几何尺寸一致、颜色复用既有令牌，细则见 §5.6 状态点四态表及其四条备注。

**E. 七个阶段色改暖调，唯一源在 `phase-log.js:7-16`。已定（v1.3）。**
`#0e647a #81520a #586110 #08694e #7d4a7d #8f4644 #505795`，方法、四条硬门槛与禁令见 **§5.7-c**。
七色统一解到「对 `#f3ead7` 恰 5.6:1」，实测 5.58–5.62；最小 `ΔE(OKLab)` 0.079。
附带修掉三处**既有 AA 失败**（计划 4.22 / 探险 4.29 / 旅行 4.49，均在 `.rail-head` 白字上）。
这 7 个值是**数据色**，不进 `:root`、不与 `--accent-*` 共用。

**F. 圆角收敛为「三档 + 一个形状」，`--radius-xl` 退役。已定（v1.3）。**
`--radius-sm:6px`（行内控件）/ `--radius-md:8px`（卡片与面板内块）/ `--radius-lg:10px`（大容器）/ `--radius-pill:999px`（形状，不算档位）。
原注释写「六种收敛成三档」而令牌表列了 5 个值，差的就是 12px 这一档：全仓仅 2 处引用，10 与 12 差 2px，在 680px 浮层上无法辨，构不成独立一档 → 两处改 `var(--radius-lg)`。
免令牌例外只有 `3px`（行高 ≤24px 的行内块），`0/1px/2px` 并入 `0`，`50%` 是圆形写法不算圆角。

**G. 日志面板（`.phase-log`）11 个冷灰绿字面量按 §5.10 表替换。已定（v1.3）。**
其中 `#8a9282`（2.85）/ `#8b9385`（2.81）/ `#6d7a68`（4.41）三条是真不达标，必须先改；
`.log-round-head` 是唯一「不能只换色、必须补一条 `--line-soft` 底边」的。

**H. 活跃玩家标签底改 `#4b6d48`（暖绿，H143 C0.070，L\*42.6）。已定（v1.4）。**
`#527085` 是灰蓝（C 只有 0.048）却亮了 17 个 L\*，在深绿画框里既冷又制造第二个色相；且名字 4.37 / stats 4.12 本来就不达标。
新三级台阶 28.7 → 35.4 → 42.6（非活跃 / hover / active），第二通道 `inset 0 -3px 0 var(--on-dark-gold)`（3.60；`--gold-line` 只有 2.18，不能用）。
附：`.first-mark` / `.elim-mark` 在深底上原本只有 1.05 / 1.83，一并反相。详见 §5.11-A。

**I. 可选中卡框改 `--gold-line`，`--accent-gold` 退出深底描边岗位。已定（v1.4）。**
`#79b9db`（H233 C0.082）是全页最高彩度冷色，且造成**阶梯倒置**（可选中 7.19 > hover 5.75）。
新阶梯：可选中 `--gold-line` 5.75 → 指向 `--on-dark-gold` 9.47 → 已选 2px `--on-dark-gold` + 光晕 + 实心块。
`--accent-gold` 对 `#182630` 只有 2.82（<3:1），深底上**只当填充**（其上 `--on-gold` 5.34）。详见 §5.11-B。

**J. 阶段竖轴三线统一到等对比度 4.5，彩度统一 0.112。已定（v1.4）。**
`trigger` `#cda351`（4.52）/ `action` `#72b97d`（4.52）/ `forced` `#ef8f84`（4.51），L\* 69.2–69.3。
旧三线 L\* 是 63.7 / 79.8 / 69.2——问题不是「金太艳」（旧金 C 0.116 ≈ 红 0.119），而是**触发线比强制线还亮 10.6 个 L\***，语义与重量倒挂。详见 §5.7-b。

---

*规范版本 v1.4 · 视觉设计架构师 · 数值全部由 WCAG 2.1 公式脚本实算，未使用目测。*
*v1.2 变更：§5.6 状态点四态 + 形状通道四条备注；§5.8 横置统一；§5.9 滤镜全清裁决；§9 待拍板项全部结案。*
*v1.3 变更：新增 §5.7-c 七阶段色（数据色，含三条硬门槛与灰度例外）；新增 §5.10 日志面板字面量审计；§1 圆角收敛为三档 + 胶囊，`--radius-xl` 退役；§8 增 5 条自查；§9 增 E/F/G 三条裁决。*
*v1.4 变更：新增 §5.11 深色件三处裁定（活跃玩家标签 / 可选中卡框 / 顶栏药丸）；§5.7-b 三线改等对比度等权重；§6 增 8 条深色件映射；§7 增 3 条禁令（18/19/20）；§8 增 6 条自查；§9 增 H/I/J 三条裁决。*
