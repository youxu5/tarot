/* ============================================================
 * 翠玉录 · 塔罗网站 交互逻辑
 * 交互参数都在 js/config.js 里改，这个文件一般不用动。
 * ============================================================ */

(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  const $ = (sel) => document.querySelector(sel);

  /* ---------- 首页柔光：照片像素坐标 → 屏幕坐标 ----------
   * 背景图是 cover 居中裁切：窗口比例一变，图被裁的位置就变。
   * 所以角点记成"照片里的像素坐标"，每次按当前窗口反算屏幕位置，
   * 不管窗口什么比例，光都贴在牌上。窗口缩放时实时重算。 */
  const glowImg = new Image();
  glowImg.src = 'assets/home.jpg';
  function layoutGlow() {
    const gc = CONFIG.home.glowCorners;
    const poly = $('#glow-poly');
    const iw = glowImg.naturalWidth, ih = glowImg.naturalHeight;
    if (!iw || !ih) return;                 // 图还没加载完，onload 里会再调
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.max(vw / iw, vh / ih);   // cover 的缩放
    const ox = (vw - iw * scale) / 2;           // 居中裁切的偏移
    const oy = (vh - ih * scale) / 2;
    const pt = (p) =>
      (((p.x * scale + ox) / vw) * 100).toFixed(2) + ',' +
      (((p.y * scale + oy) / vh) * 100).toFixed(2);
    poly.setAttribute('points',
      pt(gc.tl) + ' ' + pt(gc.tr) + ' ' + pt(gc.br) + ' ' + pt(gc.bl));
  }
  glowImg.onload = layoutGlow;
  window.addEventListener('resize', layoutGlow);
  window.layoutGlow = layoutGlow;   // 供 panel.js 调参面板复用

  /* ---------- 配置注入 ---------- */
  function applyConfig() {
    // 首页卡牌柔光多边形（角点基于背景原图像素，随窗口大小自动换算）
    layoutGlow();
    document.documentElement.style.setProperty('--glow-speed', CONFIG.home.glowSpeed + 's');
    // 头像
    if (CONFIG.draw.avatar) {
      $('#avatar').innerHTML = '<img src="' + CONFIG.draw.avatar + '" alt="头像">';
    }

    // 第三页水印透明度、翻牌时长
    document.documentElement.style.setProperty('--wm-opacity', CONFIG.reveal.watermarkOpacity);
    document.documentElement.style.setProperty('--flip-ms', CONFIG.reveal.flipMs + 'ms');

    // 结果牌尺寸
    document.documentElement.style.setProperty('--result-card-w', CONFIG.draw.cardWidth);

    // 抽牌页雾化玻璃强度
    const f = CONFIG.draw.frost;
    document.documentElement.style.setProperty('--frost-blur', f.blur + 'px');
    document.documentElement.style.setProperty('--frost-sat', f.sat);
    document.documentElement.style.setProperty('--frost-dim', f.dim);
    document.documentElement.style.setProperty('--frost-veil', f.veil);
    document.documentElement.style.setProperty('--frost-ms', f.ms + 'ms');
  }

  /* ---------- 页面切换 ---------- */
  function showPage(id, keepFx) {
    if (!keepFx) stopBurnFx();   // 切页时强制收掉燃烧粒子（燃烧跳转下一页时保留余烬）
    const prevId = document.querySelector('.page.active') ? document.querySelector('.page.active').id : null;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    $(id).classList.add('active');
    if (id === '#page-scroll') enterScroll();   // 进入羊皮纸页：复位 + 格子线浮现
    // 从「翠玉录」（抽牌页）进入牌阵：四张牌先围成立体圆筒转一圈，再四散铺平
    if (id === '#page-reveal' && prevId === 'page-draw') {
      const grid = $('#card-grid');
      const gr = grid.getBoundingClientRect();
      const cx = gr.left + gr.width / 2, cy = gr.top + gr.height / 2;
      grid.querySelectorAll('.tcard').forEach((c) => {
        const r = c.getBoundingClientRect();
        // 牌位中心相对圆心中轴的偏移，圆筒阶段要先抵消掉
        c.style.setProperty('--cyl-dx', (r.left + r.width / 2 - cx) + 'px');
        c.style.setProperty('--cyl-dy', (r.top + r.height / 2 - cy) + 'px');
      });
      grid.classList.remove('cyl-in');
      void grid.offsetWidth;
      grid.classList.add('cyl-in');
    }
    closeChariot();                             // 离开翻牌页时收起战车弹窗
    closePentacles();                           // 切页时收起星币弹窗并清掉币堆
    // 音乐鸟：首页和抽牌页不出现，从翻牌页开始才落下来；
    // 走到翻牌页时通知音乐自动开唱（initMusic 里接住这个事件）
    $('#music-bird').classList.toggle('bird-hidden', id === '#page-home' || id === '#page-draw');
    // 羊皮纸页的返回按钮挪到了左下角：给 body 挂个标记，让乌鸦站到按钮上方别叠住
    document.body.classList.toggle('scroll-page', id === '#page-scroll');
    if (id === '#page-reveal') document.dispatchEvent(new Event('cuilu:music-start'));
  }

  /* ============================================================
   * 第一页：点击卡牌热区 → 抽牌页
   * ============================================================ */
  $('#glow-poly').addEventListener('click', () => {
    showPage('#page-draw');
  });

  /* ============================================================
   * 第二页：点击六芒星 → 抽牌（出牌时背景盖上雾化玻璃）
   * ============================================================ */
  let drawing = false;
  let resultTimer = null;

  function drawCard() {
    let pool = TAROT_DECK;
    if (CONFIG.draw.pool === 'major') {
      pool = TAROT_DECK.filter(c => c.arcana === 'major');
    }
    const card = pool[Math.floor(Math.random() * pool.length)];
    const reversed = CONFIG.draw.allowReversed && Math.random() < 0.5;
    return { card, reversed };
  }

  function renderResult({ card, reversed }) {
    $('#rc-numeral').textContent = card.num || '✦';
    $('#rc-name').textContent = card.name;
    $('#rc-en').textContent = card.en;
    const pos = $('#rc-pos');
    pos.textContent = reversed ? '逆位' : '正位';
    pos.classList.toggle('reversed', reversed);

    const art = $('#rc-art');
    if (card.img) {
      // 有真实牌面图
      art.className = 'rc-art';
      art.innerHTML = '<img src="' + card.img + '" alt="' + card.name + '">';
    } else {
      // 无图：神秘风文字牌面
      art.className = 'rc-art art-text';
      art.innerHTML =
        '<svg class="art-star" viewBox="0 0 66 72" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M33 6 L58 48 L8 48 Z" stroke="#8a6a2f" stroke-width="2.5" stroke-linejoin="round" fill="rgba(138,106,47,.12)"/>' +
          '<path d="M33 66 L8 24 L58 24 Z" stroke="#8a6a2f" stroke-width="2.5" stroke-linejoin="round" fill="rgba(138,106,47,.12)"/>' +
        '</svg>' +
        '<div class="art-meaning">' + (reversed ? card.rev : card.up) + '</div>' +
        '<div class="art-elem">' + (reversed ? '逆位启示' : '正位指引') + '</div>';
    }
  }

  $('#hexagram').addEventListener('click', () => {
    if (drawing) return;
    drawing = true;

    const hexa = $('#hexagram');
    const cardEl = $('#result-card');
    const frost = $('#draw-frost');
    hexa.classList.add('drawing');
    cardEl.classList.remove('show');
    frost.classList.remove('show');

    // 凝聚动画后出牌
    setTimeout(() => {
      const res = drawCard();
      renderResult(res);

      hexa.classList.remove('drawing');
      cardEl.classList.add('show');
      frost.classList.add('show');   // ← 背景雾化玻璃，牌是画面上唯一清晰的东西

      // 自动跳转第三页
      if (CONFIG.draw.resultStayMs > 0) {
        clearTimeout(resultTimer);
        resultTimer = setTimeout(() => {
          showPage('#page-reveal');
          resetDrawPage();
        }, CONFIG.draw.resultStayMs);
      }
      drawing = false;
    }, CONFIG.draw.shuffleMs);
  });

  function resetDrawPage() {
    $('#result-card').classList.remove('show');
    $('#draw-frost').classList.remove('show');
  }

  /* ============================================================
   * 第三页：点击牌翻转
   * ============================================================ */
  function buildRevealCards() {
    const grid = $('#card-grid');
    grid.innerHTML = '';
    REVEAL_CARDS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'tcard';
      el.innerHTML =
        '<div class="tcard-inner">' +
          '<div class="tcard-face back"><img src="assets/back.jpg" alt="牌背"></div>' +
          '<div class="tcard-face front">' +
            '<img src="' + c.img + '" alt="' + c.name + '">' +
            '<div class="tcard-name">' +
              '<div class="cn">' + c.name + '</div>' +
              '<div class="en">' + c.en + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      el.addEventListener('click', () => toggleCard(el, c));
      grid.appendChild(el);
    });
  }

  let kingJumpTimer = null;

  function toggleCard(el, card) {
    const flipping = !el.classList.contains('flipped');
    el.classList.toggle('flipped');
    if (!flipping) el.classList.remove('arming');   // 翻回去就撤掉"正在开启"的呼吸光

    // 点到指定牌（默认权杖国王）：翻面后停留一段时间，自动跳转
    clearTimeout(kingJumpTimer);
    const king = (CONFIG.reveal.kings || []).find(k => k.name && card && card.name === k.name);
      if (flipping && king && king.popup) {
        // 星币国王：翻面后 3D 星币洒落堆成币堆（点币堆才弹弹窗，不跳页）
        kingJumpTimer = setTimeout(() => {
          startPentacleDrop(king);
        }, CONFIG.reveal.flipMs + (king.popupDelayMs != null ? king.popupDelayMs : 900));
      } else if (flipping && king && king.cup) {
        // 圣杯国王：翻面后进入金杯注酒场景
        kingJumpTimer = setTimeout(() => {
          startCupsScene(king);
        }, CONFIG.reveal.flipMs + (king.cupDelayMs != null ? king.cupDelayMs : 900));
      } else if (flipping && king && king.target) {
        // 跳转要等 翻牌0.9s + 停留3s ≈ 3.9 秒，这段静默期必须给个回应，
        // 否则"点了没反应"会被当成卡死，用户会连点，反而把牌翻回去
        el.classList.add('arming');
        kingJumpTimer = setTimeout(() => {
          el.classList.remove('arming');
          showPage(king.target);
        }, CONFIG.reveal.flipMs + (CONFIG.reveal.kingStayMs || 3000));
      }

    checkAllRevealed();
  }

  function checkAllRevealed() {
    const cards = document.querySelectorAll('.tcard');
    const allFlipped = [...cards].every(c => c.classList.contains('flipped'));
    const final = $('#reveal-final');

    if (allFlipped) {
      if (CONFIG.reveal.sealLightUp) {
        $('#seal').classList.add('lit');
        $('#rose-cross-watermark').classList.add('lit');
      }
      if (CONFIG.reveal.allRevealedText) {
        final.textContent = CONFIG.reveal.allRevealedText;
        final.classList.add('show');
      }
    } else {
      final.classList.remove('show');
      $('#seal').classList.remove('lit');
      $('#rose-cross-watermark').classList.remove('lit');
    }
  }

  /* ============================================================
   * 第三页底部：三块牌（月亮 / 战车 / 愚人）
   * ============================================================ */
  function buildRomanBar() {
    const bar = $('#roman-bar');
    bar.innerHTML = '';

    CONFIG.reveal.gates.forEach((g) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rbox' + (g.enabled ? '' : ' locked');
      btn.innerHTML = '<span class="rbox-name"></span><span class="rbox-en"></span>';
      btn.querySelector('.rbox-name').textContent = g.name;
      btn.querySelector('.rbox-en').textContent = g.en;
      btn.title = g.enabled ? g.name : (g.name + ' · 尚未开启');

      btn.addEventListener('click', () => {
        if (g.popup) { toggleChariot(btn, g); return; }
        if (g.enabled && g.target && $(g.target)) {
          showPage(g.target);
        } else {
          // 没开通的：轻轻晃一下，提示还进不去
          btn.classList.remove('nudge');
          void btn.offsetWidth;
          btn.classList.add('nudge');
        }
      });
      btn.addEventListener('animationend', () => btn.classList.remove('nudge'));

      bar.appendChild(btn);
    });
  }

  /* ---------- 牌位弹窗（战车/愚人共用）：玻璃气泡 + 文字 ----------
   * 战车：点牌 → 文件夹弹出 → 点文件夹出文字 → 再点收回
   * 愚人（textOnOpen）：点牌直接弹出文字气泡，不经过文件夹 */
  let chariotState = 0;
  let chariotCloseTimer = null;
  let chariotLines = null;    // 当前弹窗要显示的文本（数组，每项一行）

  function toggleChariot(anchor, gate) {
    const pop = $('#chariot-pop');
    if (chariotState === 0) {
      // 气泡从对应牌的上方弹出
      const page = pop.closest('.page');
      const pr = page.getBoundingClientRect();
      const r = anchor.getBoundingClientRect();
      pop.style.left = Math.min(Math.max(r.left + r.width / 2 - pr.left, 90), pr.width - 90) + 'px';
      chariotLines = (gate && gate.popupText) || CONFIG.reveal.popupText;
      const direct = !!(gate && gate.textOnOpen);
      pop.classList.toggle('no-folder', direct);   // 愚人模式：不出文件夹
      pop.classList.add('open');
      pop.setAttribute('aria-hidden', 'false');
      if (direct) {
        showPopupText();          // 直接出文字（state 在函数内置 2）
      } else {
        chariotState = 1;
      }
    } else {
      closeChariot();
    }
  }

  function showPopupText() {
    const txt = $('#chariot-text');
    txt.classList.remove('show', 'hide', 'pop');
    txt.innerHTML = '';
    const lines = Array.isArray(chariotLines) ? chariotLines : [chariotLines];
    const ms = CONFIG.reveal.popupCharMs || 0;
    if (ms > 0) {
      // 逐字"生"出来（模糊 → 聚焦，从上方落下）
      let idx = 0;
      lines.forEach((line) => {
        const lineEl = document.createElement('span');
        lineEl.className = 'char-line';
        Array.from(line).forEach((ch) => {
          const s = document.createElement('span');
          s.className = 'char';
          s.textContent = ch;
          s.style.animationDelay = (idx++ * ms) + 'ms';
          lineEl.appendChild(s);
        });
        txt.appendChild(lineEl);
      });
      chariotState = 2;
      // 等第一个字的动画真正开始前再挂 show，保证每次都从头播
      requestAnimationFrame(() => txt.classList.add('show'));
    } else {
      // 整段弹出：文字一口气出现（popupCharMs: 0）
      lines.forEach((line) => {
        const lineEl = document.createElement('span');
        lineEl.className = 'char-line';
        lineEl.textContent = line;
        txt.appendChild(lineEl);
      });
      chariotState = 2;
      requestAnimationFrame(() => txt.classList.add('pop'));
    }
  }

  function closeChariot() {
    if (chariotState === 0) return;
    const pop = $('#chariot-pop');
    const txt = $('#chariot-text');
    if (chariotState === 2) {
      // 先收回文字，再收气泡（保留 pop 类，pop 模式的淡出动画要靠它）
      txt.classList.remove('show');
      txt.classList.add('hide');
      clearTimeout(chariotCloseTimer);
      chariotCloseTimer = setTimeout(() => {
        txt.classList.remove('hide', 'pop');
        txt.innerHTML = '';
        pop.classList.remove('open', 'no-folder');
        pop.setAttribute('aria-hidden', 'true');
      }, 480);
    } else {
      pop.classList.remove('open', 'no-folder');
      pop.setAttribute('aria-hidden', 'true');
    }
    chariotState = 0;
  }

  $('#chariot-folder').addEventListener('click', (e) => {
    e.stopPropagation();
    if (chariotState !== 1) { closeChariot(); return; }
    showPopupText();
  });

  /* ---------- 星币国王：3D 星币洒落 → 堆成币堆 → 点币堆弹出浮雕弹窗 ----------
   * 星币按牌面样式建模（金圈黑五角星，正面/背面/棱条，有真实厚度）；
   * 从画面外翻滚坠下，落进屏幕中下部的币堆里弹一下躺稳；
   * 全部落稳后币堆发光提示，点一下币堆 → 蓝白浮雕椭圆弹窗由小到大张开；
   * 点任意处收回弹窗并清场。 */
  // 币面 SVG：金黄圆 + 黑色五角星（和星币国王牌面上的星币一个样）
  const PT_COIN_SVG =
    '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="20" cy="20" r="18.4" fill="url(#pc-gold)" stroke="#7a5a14" stroke-width="1.6"/>' +
    '<polygon points="20,5 23.65,14.98 34.27,15.36 25.90,21.92 28.82,32.14 20,26.2 11.18,32.14 14.10,21.92 5.73,15.36 16.35,14.98" fill="#191320"/>' +
    '</svg>';

  /* 钱袋子音效：WebAudio 现场合成（无需音频文件）。
   * 叮当声 = 低频金属分音（非谐波比，出"币"的体感）+ 一粒带通噪声（撞击的"哗"），
   * 基频压在 500–950Hz，不再尖细。 */
  let ptAudio = null;
  function playClink(at, vol) {
    if (!ptAudio) return;
    const t0 = ptAudio.currentTime + at;
    const master = ptAudio.createGain();
    master.gain.value = vol;
    master.connect(ptAudio.destination);
    // 1) 金属余响：基音 + 非谐波泛音，各自带随机微走音
    const base = 500 + Math.random() * 450;
    [[1, .5], [2.32, .3], [3.01, .2], [4.47, .1]].forEach(([ratio, amp]) => {
      const o = ptAudio.createOscillator();
      const g = ptAudio.createGain();
      o.type = 'sine';
      o.frequency.value = base * ratio * (.97 + Math.random() * .06);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + .004);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + .13 + Math.random() * .1);
      o.connect(g).connect(master);
      o.start(t0); o.stop(t0 + .32);
    });
    // 2) 撞击瞬态：短噪声过带通，哗啦颗粒感
    const len = .05, sr = ptAudio.sampleRate;
    const buf = ptAudio.createBuffer(1, Math.floor(sr * len), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ptAudio.createBufferSource();
    src.buffer = buf;
    const bp = ptAudio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200 + Math.random() * 1600;
    bp.Q.value = 1.1;
    const ng = ptAudio.createGain();
    ng.gain.value = .9;
    src.connect(bp).connect(ng).connect(master);
    src.start(t0);
  }

  // 高斯近似：三次随机取平均，堆形中间密四周疏
  function gauss() { return (Math.random() + Math.random() + Math.random()) / 1.5 - 1; }

  function clearPentacleStage() {
    const stage = $('#pentacles-stage');
    stage.querySelectorAll('.pt-coin3d, video').forEach(n => n.remove());
    stage.classList.remove('live', 'ready');
    stage.setAttribute('aria-hidden', 'true');
  }

  function startPentacleDrop(king) {
    const stage = $('#pentacles-stage');
    clearPentacleStage();
    stage.classList.add('live');
    stage.setAttribute('aria-hidden', 'false');

    // 音频上下文：触发自点击链，resume 不会被浏览器拦
    if (!ptAudio) {
      try { ptAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (ptAudio && ptAudio.state === 'suspended') ptAudio.resume();

    const W = stage.clientWidth || 400;
    const H = stage.clientHeight || 800;

    // 单枚厚星币：居中坠下 → 翻转一圈 → 自动张开「须知」弹窗
    const size = Math.min(W, H) * .30;
    const th = size * .17;                       // 厚度拉满，侧面看得清
    const coin = document.createElement('div');
    coin.className = 'pt-coin3d pt-solo';
    let html = '<div class="c3-face c3-front">' + PT_COIN_SVG + '</div>' +
               '<div class="c3-face c3-back">' + PT_COIN_SVG + '</div>';
    for (let k = 0; k < 18; k++) {
      // 棱边：绕币缘一圈（rotateZ 转到圆周方位 → translateX 推到半径处 → rotateY 立起，
      // 条带高度方向对齐厚度），正面看不会再横穿一条杠
      html += '<div class="c3-edge" style="transform:translate(-50%,-50%) rotateZ(' + (k * 20) + 'deg) translateX(' + (size / 2 - .5) + 'px) rotateY(90deg)"></div>';
    }
    coin.innerHTML = html;
    coin.style.cssText =
      '--sz:' + size + 'px;--th:' + th + 'px;--ew:' + (Math.PI * size / 18).toFixed(1) + 'px;';
    stage.appendChild(coin);
    // 翻面两声叮当：起翻一声、翻定一声
    if (ptAudio) { playClink(.5, .12); playClink(1.05, .07); }

    const toReady = () => {
      if (stage.classList.contains('ready')) return;
      stage.classList.add('ready');
      stage.dataset.king = JSON.stringify(king);
      openPentacles(king);           // 硬币翻完直接变出须知
    };
    coin.addEventListener('animationend', toReady, { once: true });
    setTimeout(toReady, 2200);       // 兜底：animationend 没触发也能出弹窗
  }

  /* 点币堆 → 弹窗由小到大张开，文字逐行浮出 */
  function openPentacles(king) {
    const pop = $('#pentacles-pop');
    const txt = $('#pentacles-text');
    txt.innerHTML = '';
    txt.classList.remove('show');
    // 标题「须知」：大字居中在顶部
    if (king.popupTitle) {
      const t = document.createElement('span');
      t.className = 'pt-title';
      t.textContent = king.popupTitle;
      txt.appendChild(t);
    }
    (king.popupText || []).forEach((line, i) => {
      const s = document.createElement('span');
      s.className = 'pt-line';
      s.textContent = line;
      s.style.animationDelay = (550 + i * 190) + 'ms';
      txt.appendChild(s);
    });
    // 尾句：弹窗底部空白处（画框下方一横排）
    if (king.popupFoot) {
      pop.querySelectorAll('.pt-foot').forEach(e => e.remove());   // 防重复
      const f = document.createElement('span');
      f.className = 'pt-foot';
      f.textContent = king.popupFoot;
      f.style.animationDelay = (550 + (king.popupText || []).length * 190 + 260) + 'ms';
      pop.appendChild(f);
    }
    pop.classList.add('open');
    pop.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => txt.classList.add('show'));
  }

  function closePentacles() {
    const pop = $('#pentacles-pop');
    pop.classList.remove('open');
    pop.setAttribute('aria-hidden', 'true');
    clearPentacleStage();   // 收弹窗时连币堆一起清场，可重新点牌回放
  }
  $('#pentacles-pop').addEventListener('click', closePentacles);
  $('#pentacles-stage').addEventListener('click', () => {
    const stage = $('#pentacles-stage');
    if (!stage.classList.contains('ready')) return;
    let king = {};
    try { king = JSON.parse(stage.dataset.king || '{}'); } catch (e) {}
    openPentacles(king);
  });

  /* ============================================================
   * 圣杯国王：金杯注酒场景
   * 金杯先亮起 → 金壶入场倾倒蜜酒（WebAudio 合成倒酒声）→
   * 退场 → 哥特黑框照片浮现；点任意处收回清场。
   * 动画时间轴全在 CSS keyframes 里，JS 只负责开演/收场/音效。 */
  function clearCupsStage() {
    const stage = $('#cups-stage');
    stage.classList.remove('live', 'done', 'ready', 'video-mode');
    if (stage._cupWd) { clearInterval(stage._cupWd); stage._cupWd = 0; }
    const v = stage.querySelector('video.cup-video-src');
    if (v) { v.pause(); v.classList.remove('cup-fallback'); v.removeAttribute('src'); v.load(); }
    const cv = stage.querySelector('canvas.cup-video');
    if (cv) { cv.style.display = ''; const c = cv.getContext('2d'); if (c) c.clearRect(0, 0, cv.width, cv.height); }
    stage.setAttribute('aria-hidden', 'true');
  }

  function startCupsScene(king) {
    const stage = $('#cups-stage');
    clearCupsStage();
    void stage.offsetWidth;    // 重排让动画从头播
    const img = stage.querySelector('.cup-photo-img');
    const txtCard = stage.querySelector('.cup-photo-text');
    // 照片堆：cupPhotos 数组循环切换；数组项可以是路径字符串，也可以是 { text: '...' } 文字卡
    const photos = (king.cupPhotos && king.cupPhotos.length ? king.cupPhotos : [king.cupPhoto]).filter(Boolean);
    const showItem = (it, bust) => {
      if (it && typeof it === 'object') {
        txtCard.textContent = it.text || '';
        txtCard.classList.add('show');
        img.style.display = 'none';
        img.removeAttribute('src');
      } else if (it) {
        txtCard.classList.remove('show');
        img.style.display = '';
        img.src = it + (bust != null ? '?v=' + bust : '');
      }
    };
    let photoIdx = 0;
    if (photos.length) showItem(photos[0]);
    stage.classList.add('live');
    stage.setAttribute('aria-hidden', 'false');

    if (!ptAudio) {
      try { ptAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (ptAudio && ptAudio.state === 'suspended') ptAudio.resume();

    // AI 视频素材模式：纯黑底金杯注酒视频，canvas 逐帧把黑底抠成真透明。
    // 之前用 mix-blend-mode:screen，微信 X5 内核不支持混合模式 → 整块黑幕。
    // 现在按亮度生成 alpha 通道，任何内核都能正确显出金杯。（静音，无音效）
    if (king.cupVideo) {
      stage.classList.add('video-mode');
      let v = stage.querySelector('video.cup-video-src');
      if (!v) {
        v = document.createElement('video');
        v.className = 'cup-video-src';
        v.muted = true;
        v.defaultMuted = true;
        v.autoplay = true;
        v.loop = false;
        v.playsInline = true;
        v.preload = 'auto';
        // iOS Safari / 微信 X5 内核：必须这几个属性才不会跳全屏接管播放器
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', 'true');
        v.setAttribute('x5-playsinline', 'true');
        v.setAttribute('x5-video-player-type', 'h5-page');
        v.setAttribute('x5-video-player-fullscreen', 'false');
        stage.querySelector('.cup-scene').appendChild(v);
      }
      // 抠像画布：canvas.cup-video 铺在舞台上，黑底变透明后只剩金杯
      let cv = stage.querySelector('canvas.cup-video');
      let ctx = null;
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'cup-video';
        stage.querySelector('.cup-scene').appendChild(cv);
      }
      try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
      if (!ctx) {
        // 兜底（极老浏览器）：退回视频直出 + 混合模式的老方案
        v.classList.add('cup-video');
        v.classList.remove('cup-video-src');
      }
      v.src = king.cupVideo;
      v.play().catch(() => {});

      // 自动播放被拦时（iOS 省电模式、部分安卓浏览器、 stricter webview）：
      // 第一次触摸/点击就用捕获阶段补一脚 —— 捕获阶段不受页面里的 stopPropagation 干扰。
      if (v.paused) {
        const once2 = () => {
          ['touchstart', 'mousedown', 'click'].forEach(ev =>
            document.removeEventListener(ev, once2, true));
          v.play().catch(() => {});
        };
        ['touchstart', 'mousedown', 'click'].forEach(ev =>
          document.addEventListener(ev, once2, { capture: true, passive: true }));
      }
      const toDone = () => {
        if (stage.classList.contains('done')) return;
        stage.classList.add('done', 'ready');
        if (stage._cupWd) { clearInterval(stage._cupWd); stage._cupWd = 0; }
      };
      v.addEventListener('ended', toDone, { once: true });
      setTimeout(toDone, 5200);  // 兜底

      // 逐帧：先在小画布上按亮度算 alpha（暗→透明），再含缩放画上主画布
      const KEY_W = 480;   // 抠像分辨率：低了省性能，金杯是大块高亮物体，足够用
      const off = document.createElement('canvas');
      const octx = off.getContext('2d', { willReadFrequently: true });
      let rafId = 0;
      let framesDrawn = 0;   // 成功画出的帧数：0 = canvas 通路从未工作
      const drawFrame = () => {
        rafId = 0;
        if (!ctx || v.readyState < 2) return;
        try {
          const vw = v.videoWidth, vh = v.videoHeight;
          if (!vw || !vh) return;
          const keyH = Math.max(2, Math.round(KEY_W * vh / vw));
          if (off.width !== KEY_W || off.height !== keyH) { off.width = KEY_W; off.height = keyH; }
          octx.drawImage(v, 0, 0, KEY_W, keyH);
          const data = octx.getImageData(0, 0, KEY_W, keyH);
          const a = data.data;
          for (let i = 0; i < a.length; i += 4) {
            let m = a[i];
            if (a[i + 1] > m) m = a[i + 1];
            if (a[i + 2] > m) m = a[i + 2];
            // 亮度 <28 全透明，>200 全不透明，中间线性过渡（边缘柔和）
            a[i + 3] = m <= 28 ? 0 : m >= 200 ? 255 : ((m - 28) * 255 / 172) | 0;
          }
          octx.putImageData(data, 0, 0);

          const cw = cv.clientWidth, ch = cv.clientHeight;
          if (!cw || !ch) return;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
          if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
          ctx.clearRect(0, 0, pw, ph);
          const s = Math.min(pw / KEY_W, ph / keyH);
          const dw = KEY_W * s, dh = keyH * s;
          ctx.drawImage(off, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
          framesDrawn++;
        } catch (e) {
          framesDrawn = -1;   // 画布被跨域污染等异常：直接走后备
        }
        if (!v.ended && !v.paused) rafId = requestAnimationFrame(drawFrame);
      };
      const kickDraw = () => { if (!rafId) rafId = requestAnimationFrame(drawFrame); };
      v.addEventListener('loadeddata', kickDraw, { once: true });
      v.addEventListener('play', kickDraw);

      // canvas 从未工作过的后备：视频直出 + 混合模式抠黑（老方案，微信 X5 之外都稳）
      const useFallback = () => {
        if (framesDrawn > 0 || v.classList.contains('cup-fallback')) return;
        v.classList.add('cup-fallback');
        if (cv) cv.style.display = 'none';
        // 从头播：canvas 通路废了说明前面根本没显示过，直出要把整个动画补齐
        try { if (v.readyState >= 2) v.currentTime = 0; } catch (e) {}
        v.play().catch(() => {});
      };
      v.addEventListener('error', useFallback, { once: true });

      // 播放看门狗：被自动播放策略拦下 / 加载卡住时反复重试，直到播上或结束
      // 移动端要早做决断：400ms 一轮，1.2s 没数据就重载，2.4s 还没画出帧就切直出
      // （原来是 900ms×7≈6.3s，等那时候视频早播完了，切过去也是黑屏）
      if (stage._cupWd) { clearInterval(stage._cupWd); stage._cupWd = 0; }
      let wdTries = 0;
      stage._cupWd = setInterval(() => {
        if (v.ended || !stage.classList.contains('live')) { clearInterval(stage._cupWd); stage._cupWd = 0; return; }
        wdTries++;
        if (v.paused) v.play().catch(() => {});
        kickDraw();
        if (wdTries === 3 && v.readyState < 2) { try { v.load(); v.play().catch(() => {}); } catch (e) {} }
        if (wdTries === 6 && framesDrawn <= 0) useFallback();
      }, 400);
    } else {
      // SVG 时间轴：壶 1s 入场 4.6s 演完 → 6.3s 定格，照片已浮现
      setTimeout(() => {
        stage.classList.add('done', 'ready');
      }, 6300);
    }

    /* 照片切换：点右下角角标 → 当前张翻走，下一张浮上来，堆叠层跟着轮转 */
    const nextBtn = stage.querySelector('.cup-photo-next');
    if (nextBtn && photos.length > 1) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (!stage.classList.contains('done')) return;
        photoIdx = (photoIdx + 1) % photos.length;
        const wrap = stage.querySelector('.cup-photo');
        wrap.classList.remove('flipping');
        void wrap.offsetWidth;
        wrap.classList.add('flipping');
        setTimeout(() => {
          showItem(photos[photoIdx], photoIdx);   // 字符串项带 ?v 破缓存
          // 堆叠层轮转：最底下的转到最上面
          const stack = stage.querySelector('.cup-stack-layers');
          if (stack) stack.dataset.turn = photoIdx % 3;
          layoutCupTail(stage);                   // 换了照片高度可能变，重排下方
        }, 240);
      };
    } else if (nextBtn) {
      nextBtn.style.display = 'none';   // 只有一张时不出切换角标
    }

    /* 照片堆下面中间的一句话（老板可在 config 的 cupGapText 改） */
    const gapLine = stage.querySelector('.cup-gap-line');
    if (gapLine) gapLine.textContent = king.cupGapText || '';

    setupCupUpload(stage, king);
    layoutCupTail(stage);
  }

  /* 句子 + 上传框：按照片堆的真实底边接着往下排，任何屏幕都不重叠 */
  function layoutCupTail(stage) {
    const ph = stage.querySelector('.cup-photo');
    const gap = stage.querySelector('.cup-gap-line');
    const up = stage.querySelector('.cup-upload');
    if (!ph || !gap || !up) return;
    const sr = stage.getBoundingClientRect();
    const pr = ph.getBoundingClientRect();
    let y = pr.bottom - sr.top + 28;
    gap.style.top = y + 'px';
    y += gap.offsetHeight + 30;
    up.style.top = y + 'px';
  }

  /* ---------- 云端同步：WorkBuddy 云服务（database 表 slot_images 存图片 data URL） ----------
   * 目的：老板上传的照片传到云端，所有访客刷新就能看到最新那张。
   * 对外接口不变：init / ready / load / loadAll / save / remove。
   * 任何一步失败都自动退回本机/静态图，不报错、不白屏。
   */
  const Cloud = (() => {
    const SDK_CDN = 'https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js';
    const SDK_LOCAL = 'js/cloud-sdk.js?v=1';
    const SDK_CB = 'js/cloudbase.full.js';      // 腾讯云开发 Web SDK（本地副本，不依赖外网 CDN）
    const TABLE = 'cuiyu_slots';   // 云端实际表名（曾误写成 slot_images，导致读写打在空表上）
    const STEPS = [[1100, .75], [900, .66], [720, .58], [560, .5]];  // 逐级压小，直到塞得进数据库
    const MAXLEN = 520000;                                           // data URL 字符上限（约 390KB）
    let cfg = null, on = false, cloud = null, sdkP = null;
    // 两条后端通道：
    //   'cb' = 腾讯云开发 CloudBase —— 允许任意站点调用，GitHub Pages 也能读写（推荐，跨站可用）
    //   'wb' = WorkBuddy 云          —— 只认它自己的应用域名，别的域名一来预检就被拦
    let mode = 'none', cbCfg = null, dbPromise = null, cbSdkP = null;

    function init(c) {
      try {
        // 优先用 CloudBase：只要 config.cloudbase.env 填了就走这条
        cbCfg = (typeof CONFIG !== 'undefined' && CONFIG.cloudbase) || null;
        if (cbCfg && cbCfg.env) { mode = 'cb'; cfg = cbCfg; on = true; return; }
        cfg = c || null;
        on = !!(cfg && cfg.endpoint && cfg.publishableKey && cfg.page);
        mode = on ? 'wb' : 'none';
      } catch (e) { cfg = null; on = false; mode = 'none'; }
    }
    function ready() { return on; }

    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => res(true);
        s.onerror = () => rej(new Error('SDK 加载失败: ' + src));
        document.head.appendChild(s);
      });
    }
    function ensureSDK() {                 // 站点自带副本优先，它挂了才去撞 CDN（国内对 jsdelivr 时通时断）
      if (typeof window !== 'undefined' && window.WorkBuddyCloud) return Promise.resolve(window.WorkBuddyCloud);
      if (sdkP) return sdkP;
      sdkP = loadScript(SDK_LOCAL)
        .catch(() => loadScript(SDK_CDN))
        .then(() => {
          const g = (typeof window !== 'undefined') ? window.WorkBuddyCloud : null;
          if (!g) throw new Error('SDK 未挂载全局变量');
          return g;
        })
        .catch(e => { sdkP = null; throw e; });
      return sdkP;
    }
    /* 腾讯云开发：拿到数据库句柄（首次会做匿名登录，之后复用） */
    function ensureCB() {
      if (typeof window !== 'undefined' && window.cloudbase) return Promise.resolve(window.cloudbase);
      if (cbSdkP) return cbSdkP;
      cbSdkP = loadScript(SDK_CB).then(() => {
        const g = (typeof window !== 'undefined') ? window.cloudbase : null;
        if (!g) throw new Error('CloudBase SDK 未挂载全局变量');
        return g;
      }).catch(e => { cbSdkP = null; throw e; });
      return cbSdkP;
    }
    function dbClient() {
      if (dbPromise) return dbPromise;
      dbPromise = ensureCB().then(async g => {
        // Publishable Key（accessKey）本身就是匿名身份（anon 角色）——前端可以放，
        // 真正的权限由数据表的 GRANT + RLS 管。没配 key 时才退回匿名登录。
        const app = g.init({
          env: cbCfg.env,
          accessKey: cbCfg.accessKey || undefined,
          region: cbCfg.region || 'ap-shanghai'
        });
        if (!cbCfg.accessKey) {
          try {
            const auth = app.auth({ persistence: 'local' });
            const st = auth.hasLoginState ? auth.hasLoginState() : null;
            if (!st) await auth.signInAnonymously();
          } catch (e) { throw new Error('CloudBase 匿名登录失败（控制台开启匿名登录了吗？）'); }
        }
        return app.rdb ? app.rdb() : app.database();   // PG 模式用 rdb()；老文档型环境退回 database()
      }).catch(e => { dbPromise = null; throw e; });
      return dbPromise;
    }

    function client() {                    // endpoint / publishableKey 全部来自 config.js（= activate 返回的 publicConfig）
      if (mode === 'cb') return dbClient();
      if (cloud) return Promise.resolve(cloud);
      if (!on) return Promise.reject(new Error('云端未配置'));
      return ensureSDK().then(g => {
        cloud = g.createWorkBuddyCloud({
          endpoint: cfg.endpoint,
          oauthRelayBaseUrl: cfg.oauthRelayBaseUrl,
          publishableKey: cfg.publishableKey
        });
        return cloud;
      });
    }
    function withTimeout(p, ms) {
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('请求超时')), ms || 8000);
        Promise.resolve(p).then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
      });
    }

    const D = () => ({ page: cfg.page, key: cfg.key, ix: cfg.ix });
    const pick = (rows) => (rows && rows[0]) || null;

    const cbPage = () => cfg.page || 'cuiyulu';
    const cbCol = () => cfg.collection || 'cuiyu_slots';

    async function load(slot) {
      if (!on) return null;
      const s = slot || D();
      try {
        if (mode === 'cb') {
          const db = await dbClient();
          const r = await withTimeout(db.from(cbCol())
            .select('ix,url,rev,created_at')
            .eq('page', cbPage()).eq('key', s.key).eq('ix', s.ix)
            .order('created_at', { ascending: false }).limit(1), 9000);
          if (r && r.error) return null;
          const row = ((r && (r.data || r)) || [])[0] || null;
          return (row && row.rev && row.url) ? { url: row.url, rev: row.rev } : null;
        }
        const c = await client();
        const r = await withTimeout(c.database.from(TABLE)
          .select('url,rev')
          .eq('page', s.page).eq('key', s.key).eq('ix', s.ix), 8000);
        const row = (r && !r.error) ? pick(r.data) : null;
        if (!row || !row.rev || !row.url) return null;
        return { url: row.url, rev: row.rev };
      } catch (e) { return null; }
    }

    /* 拉某一类槽位的全部格子（如画廊 gal → { 0:{url,rev}, 1:{...} … }） */
    async function loadAll(key) {
      if (!on) return null;
      try {
        if (mode === 'cb') {
          const db = await dbClient();
          const r = await withTimeout(db.from(cbCol())
            .select('ix,url,rev,created_at')
            .eq('page', cbPage()).eq('key', key), 10000);
          if (!r || r.error) return null;
          const map = {}, at = {};
          ((r && (r.data || r)) || []).forEach(row => {
            if (!row || !row.rev || !row.url || row.ix === undefined) return;
            const t = Number(new Date(row.created_at).getTime()) || 0;
            if (!map[row.ix] || t >= at[row.ix]) { map[row.ix] = { url: row.url, rev: row.rev }; at[row.ix] = t; }
          });
          return map;
        }
        const c = await client();
        const r = await withTimeout(c.database.from(TABLE)
          .select('ix,url,rev')
          .eq('page', cfg.page).eq('key', key), 9000);
        if (!r || r.error) return null;
        const map = {};
        (r.data || []).forEach(row => {
          if (row && row.rev && row.url) map[row.ix] = { url: row.url, rev: row.rev };
        });
        return map;
      } catch (e) { return null; }
    }

    /* blob → 受限大小的 jpeg data URL（直接存进数据库，任何访客都能读） */
    function blobToDataUrl(blob, step) {
      const i = step || 0;
      const spec = STEPS[Math.min(i, STEPS.length - 1)];
      return new Promise((res, rej) => {
        const objUrl = URL.createObjectURL(blob);
        const im = new Image();
        im.onload = () => {
          const sc = Math.min(1, spec[0] / Math.max(im.width, im.height));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * sc));
          cv.height = Math.max(1, Math.round(im.height * sc));
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          let out = '';
          try { out = cv.toDataURL('image/jpeg', spec[1]); } catch (e) {}
          URL.revokeObjectURL(objUrl);
          if (!out) return rej(new Error('图片编码失败'));
          if (out.length > MAXLEN && i < STEPS.length - 1) return res(blobToDataUrl(blob, i + 1));
          res(out);
        };
        im.onerror = () => { URL.revokeObjectURL(objUrl); rej(new Error('图片解码失败')); };
        im.src = objUrl;
      });
    }

    async function save(blob, slot) {
      if (!on) throw new Error('云端未配置');
      const s = slot || D();
      const url = await blobToDataUrl(blob);
      const rev = Date.now();
      if (mode === 'cb') {
        const db = await dbClient();
        let wErr = null;
        try {
          const old = await withTimeout(db.from(cbCol()).select('id')
            .eq('page', cbPage()).eq('key', s.key).eq('ix', s.ix).limit(1), 9000);
          const row = (((old && (old.data || old)) || [])[0]) || null;
          if (row && row.id != null) {
            await withTimeout(db.from(cbCol())
              .update({ url: url, rev: rev, updated_at: new Date().toISOString() })
              .eq('id', row.id), 20000);
          } else {
            await withTimeout(db.from(cbCol())
              .insert({ page: cbPage(), key: s.key, ix: s.ix, url: url, rev: rev, created_at: new Date().toISOString() }), 20000);
          }
        } catch (e) {
          // PostgREST 的写操作默认返回空 body，SDK 有时会因此解析报错，
          // 但数据其实已经落库了 —— 所以不能直接判失败，下面以回读结果为准。
          wErr = e;
        }
        try {
          const chk = await withTimeout(db.from(cbCol()).select('rev')
            .eq('page', cbPage()).eq('key', s.key).eq('ix', s.ix).limit(1), 9000);
          const got = (((chk && (chk.data || chk)) || [])[0]) || null;
          if (got && String(got.rev) === String(rev)) return { url: url, rev: rev };   // 回读确认 = 真的写进去了
        } catch (e) { if (!wErr) wErr = e; }
        throw new Error('CloudBase 写入失败：' + ((wErr && wErr.message) || '') +
          '（多半是表还没建、或 GRANT/RLS 没放开）');
      }
      const c = await client();
      // 不能直接 upsert 表：那张表只对访客开放读，硬写会被 RLS 挡回来。
      // 走 SECURITY DEFINER 函数，由服务端再校验一次口令。
      const r = await withTimeout(c.database.rpc('cuiyu_set_slot', {
        p_passcode: cfg.passcode || '',
        p_page: s.page, p_key: s.key, p_ix: s.ix,
        p_url: url, p_rev: rev
      }), 20000);
      if (r && r.error) throw new Error(r.error.message || '云端写入失败（口令不对或网络不通）');
      return { url: url, rev: rev };
    }

    function remove(slot) {               // 删云端：失败就算了，不影响本机清除
      if (!on) return Promise.resolve();
      const s = slot || D();
      if (mode === 'cb') {
        return dbClient()
          .then(db => withTimeout(db.from(cbCol()).select('id')
            .eq('page', cbPage()).eq('key', s.key).eq('ix', s.ix), 8000))
          .then(r => Promise.all((((r && (r.data || r)) || [])).map(row =>
            row && row.id != null
              ? dbClient().then(db2 => db2.from(cbCol()).delete().eq('id', row.id))
              : null)))
          .catch(() => {});
      }
      return client()
        .then(c => withTimeout(c.database.rpc('cuiyu_del_slot', {
          p_passcode: cfg.passcode || '',
          p_page: s.page, p_key: s.key, p_ix: s.ix
        }), 8000))
        .catch(() => {});
    }

    return { init, ready, load, loadAll, save, remove };
  })();

  /* 选图 → 压成限定边长的 jpeg（画廊/圣杯页共用） */
  function compressToJpeg(fileObj, max) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const s = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * s));
          c.height = Math.max(1, Math.round(im.height * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(b => b ? resolve({ blob: b, dataUrl: c.toDataURL('image/jpeg', .78) }) : reject(new Error('toBlob 失败')), 'image/jpeg', .78);
        };
        im.onerror = () => reject(new Error('图片读取失败'));
        im.src = String(fr.result || '');
      };
      fr.onerror = () => reject(new Error('文件读取失败'));
      fr.readAsDataURL(fileObj);
    });
  }

  /* ---------- 圣杯页：老板专属上传画布（口令解锁；云端优先，本机兜底） ---------- */
  const CU_KEY = 'cuiyu_cup_upload_img';
  const CU_UNLOCK = 'cuiyu_cup_upload_unlocked';
  function setupCupUpload(stage, king) {
    const box = stage.querySelector('.cup-upload');
    if (!box) return;
    const file = box.querySelector('.cu-file');
    const img = box.querySelector('.cu-img');
    const lock = box.querySelector('.cu-lock');
    const pass = box.querySelector('.cu-pass');
    const ok = box.querySelector('.cu-ok');
    const clear = box.querySelector('.cu-clear');
    const code = String(king.uploadPasscode != null ? king.uploadPasscode : '');
    let unlocked = false;
    try { unlocked = localStorage.getItem(CU_UNLOCK) === '1'; } catch (e) {}
    let saved = '';
    try { saved = localStorage.getItem(CU_KEY) || ''; } catch (e) {}
    if (!saved && king.cupCloudPhoto) saved = king.cupCloudPhoto;   // 没有本地上传图就用静态云端照片
    if (saved) { img.src = saved; box.classList.add('has-img'); }

    // 状态提示：平时完全不露出来，只在真同步/真失败时闪一下
    const setStatus = (t, ms) => {
      const el = box.querySelector('.cu-status');
      if (!el) return;
      el.textContent = t;
      box.classList.add('show-status');
      clearTimeout(setStatus._t);
      if (ms) setStatus._t = setTimeout(() => box.classList.remove('show-status'), ms);
    };

    // 云端优先：拉到就用云端那张，保证所有人看到的是同一张
    Cloud.init((typeof CONFIG !== 'undefined' && CONFIG.cloud) || null);
    if (Cloud.ready()) {
      setStatus('正在同步…');
      Cloud.load().then(hit => {
        if (hit && hit.url) {
          img.src = hit.url;
          box.classList.add('has-img');
          setStatus('已同步 ✓', 2600);
          relayout();
        } else {
          setStatus('离线模式 · 照片只在本机', 2600);
        }
      });
    }
    // 没配云端就纯本机模式，不提示、不报错

    // 照片翻入动画结束后重排（两次覆盖视频/SVG 两种时长），换窗口尺寸也重排
    const relayout = () => layoutCupTail(stage);
    setTimeout(relayout, 1800);
    setTimeout(relayout, 3400);
    setTimeout(relayout, 6800);
    if (!setupCupUpload._rb) {
      setupCupUpload._rb = true;
      window.addEventListener('resize', () => {
        const s = $('#cups-stage');
        if (s && s.classList.contains('done')) layoutCupTail(s);
      });
    }

    const pick = () => { if (file) file.click(); };

    // 底层上传入口：不露 UI，1.2 秒内连点框 5 次才弹口令（平时点击无反应）
    let taps = 0, tapTimer = 0;
    box.addEventListener('click', (e) => {
      e.stopPropagation();                       // 别冒泡到 stage（否则整页收场）
      if (e.target === clear || e.target === pass || e.target === ok || e.target === file) return;
      if (unlocked) { pick(); return; }
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { taps = 0; }, 1200);
      if (taps >= 5) {
        taps = 0;
        box.classList.add('asking');
        setTimeout(() => { try { pass.focus(); } catch (err) {} }, 60);
      }
    });
    // 别让输入框里的点击/按键冒到舞台
    ['click', 'keydown', 'keyup', 'input', 'touchstart'].forEach(t => {
      lock.addEventListener(t, (e) => e.stopPropagation());
    });

    const submit = () => {
      if (String(pass.value || '').trim() === code) {
        unlocked = true;
        try { localStorage.setItem(CU_UNLOCK, '1'); } catch (e) {}
        box.classList.remove('asking');
        pass.value = '';
        pick();
      } else {
        pass.value = '';
        box.classList.remove('wrong');
        void box.offsetWidth;
        box.classList.add('wrong');
        setTimeout(() => box.classList.remove('wrong'), 420);
      }
    };
    if (ok) ok.addEventListener('click', (e) => { e.stopPropagation(); submit(); });
    if (pass) pass.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') { box.classList.remove('asking'); pass.value = ''; }
    });

    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        // 压缩后再存：localStorage 只有 5MB 左右，原图容易撑爆
        const im = new Image();
        im.onload = () => {
          const max = 900;
          const s = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * s));
          c.height = Math.max(1, Math.round(im.height * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          let d = '';
          try { d = c.toDataURL('image/jpeg', .82); } catch (e) { d = String(fr.result); }
          try { localStorage.setItem(CU_KEY, d); } catch (e) {}
          img.src = d;
          box.classList.add('has-img');
          relayout();
          // 传云端：成功后所有人刷新都能看到这一张
          if (Cloud.ready()) {
            setStatus('上传中…');
            new Promise(r => { try { c.toBlob(r, 'image/jpeg', .82); } catch (e) { r(null); } })
              .then(blob => blob ? Cloud.save(blob) : Promise.reject(new Error('blob 失败')))
              .then(hit => { img.src = hit.url; setStatus('已同步到云端 ✓', 2600); })
              .catch(err => { console.warn('[云端上传失败]', err); setStatus('云端没连上 · 已存本机', 3200); });
          }
        };
        im.onerror = () => {
          const d = String(fr.result || '');
          try { localStorage.setItem(CU_KEY, d); } catch (e) {}
          img.src = d;
          box.classList.add('has-img');
        };
        im.src = String(fr.result || '');
      };
      fr.readAsDataURL(f);
      file.value = '';
    });

    if (clear) clear.addEventListener('click', (e) => {
      e.stopPropagation();
      try { localStorage.removeItem(CU_KEY); } catch (err) {}
      img.removeAttribute('src');
      box.classList.remove('has-img');
      if (Cloud.ready()) { setStatus('正在移除…'); Cloud.remove().then(() => setStatus('本机模式')); }
    });
  }
  $('#cups-stage').addEventListener('click', () => {
    if ($('#cups-stage').classList.contains('ready')) clearCupsStage();
  });

  /* 倒酒声：带通噪声做"液流"，叠几粒低频"咕咚" */
  function playPour(at, dur, vol) {
    if (!ptAudio) return;
    const t0 = ptAudio.currentTime + at;
    const len = dur, sr = ptAudio.sampleRate;
    const buf = ptAudio.createBuffer(1, Math.floor(sr * len), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ptAudio.createBufferSource();
    src.buffer = buf;
    const bp = ptAudio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 720;
    bp.Q.value = .8;
    const g = ptAudio.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + .3);
    g.gain.setValueAtTime(vol, t0 + dur - .45);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(bp).connect(g).connect(ptAudio.destination);
    src.start(t0); src.stop(t0 + dur + .05);
    // 咕咚：酒液冲击杯底的低频短音
    [0.35, 1.0, 1.65].forEach((off, i) => {
      const o = ptAudio.createOscillator();
      const og = ptAudio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(210 + i * 30, t0 + off);
      o.frequency.exponentialRampToValueAtTime(120, t0 + off + .12);
      og.gain.setValueAtTime(0, t0 + off);
      og.gain.linearRampToValueAtTime(vol * .8, t0 + off + .02);
      og.gain.exponentialRampToValueAtTime(.0001, t0 + off + .16);
      o.connect(og).connect(ptAudio.destination);
      o.start(t0 + off); o.stop(t0 + off + .2);
    });
  }
  /* 照片浮现：一声柔和的钟琴轻响 */
  function playShimmer(at) {
    if (!ptAudio) return;
    const t0 = ptAudio.currentTime + at;
    [[784, .05], [1175, .035]].forEach(([f, v], i) => {
      const o = ptAudio.createOscillator();
      const g = ptAudio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * .09);
      g.gain.linearRampToValueAtTime(v, t0 + i * .09 + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + i * .09 + .9);
      o.connect(g).connect(ptAudio.destination);
      o.start(t0 + i * .09); o.stop(t0 + i * .09 + 1);
    });
  }

  /* ============================================================
   * 第四页：卷 I
   * ============================================================ */
  function buildChapter() {
    // 画廊方框：图片和尺寸都由 config.js → chapter.gallery 决定
    const gal = $('#chapter-gallery');
    gal.innerHTML = '';
    (CONFIG.chapter.gallery || []).forEach((item, ix) => {
      const box = document.createElement('div');
      box.className = 'gbox' + (item.span ? ' ' + item.span : '') + (item.fit === 'contain' ? ' fit-contain' : '');
      box.dataset.ix = ix;                        // 云端槽位号：cuiyulu-gal-<ix>
      if (item.locked) box.classList.add('locked');   // 锁死：云端永远覆盖不了它
      // 底图：照片没铺满框时露出的背景（比如 ins 风紫纹理）
      if (item.bg) box.style.background = 'center / cover no-repeat url("' + item.bg + '?v=2")';
      if (item.src) {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';
        img.loading = 'lazy';
        box.appendChild(img);
      } else {
        box.classList.add('empty');
      }
      const x = document.createElement('div');    // 移除角标：仅解锁编辑后显示
      x.className = 'gx';
      x.textContent = '✕';
      box.appendChild(x);
      gal.appendChild(box);
    });
    setupGalleryUpload();
  }

  /* ---------- 画廊：老板自定义 + 云端同步 ----------
   * 入口与圣杯页一致：1.2 秒内连点格子 5 次 → 口令 520 → 解锁全站编辑。
   * 解锁后：点格子换图（自动压缩、传云端）；点右上 ✕ 移除（连云端一起删）。
   * 云端有图时覆盖 config 里的静态图；云端不通则只在本机生效，不报错。
   */
  function galleryPasscode() {
    const ks = (CONFIG.reveal && CONFIG.reveal.kings) || [];
    for (const k of ks) { if (k.uploadPasscode) return String(k.uploadPasscode); }
    return '520';
  }
  function galleryUnlocked() {
    try { return localStorage.getItem(CU_UNLOCK) === '1'; } catch (e) { return false; }
  }
  function setBoxImg(box, url) {
    let img = box.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; box.appendChild(img); }
    img.src = url;
    box.classList.remove('empty');
    box.classList.add('has-img');
  }
  /* 格子里闪一句小字（同步成功/失败），1.6 秒后自己消失，平时不露 */
  function flashBox(box, text) {
    if (!box) return;
    let el = box.querySelector('.gflash');
    if (!el) {
      el = document.createElement('div');
      el.className = 'gflash';
      box.appendChild(el);
    }
    el.textContent = text;
    box.classList.add('show-flash');
    clearTimeout(box._flashT);
    box._flashT = setTimeout(() => box.classList.remove('show-flash'), 1600);
  }

  function setupGalleryUpload() {
    const gal = $('#chapter-gallery');
    if (!gal) return;
    Cloud.init((typeof CONFIG !== 'undefined' && CONFIG.cloud) || null);

    // 开页拉云端：谁的槽位有图就铺谁的（覆盖静态配置图）
    if (Cloud.ready()) {
      Cloud.loadAll('gal').then(map => {
        if (!map) return;
        gal.querySelectorAll('.gbox[data-ix]').forEach(box => {
          if (box.classList.contains('locked')) return;     // 锁死的格子：云端图不覆盖
          const hit = map[Number(box.dataset.ix)];
          if (hit && hit.url) setBoxImg(box, hit.url);
        });
      });
    }

    // 解锁状态先恢复一次（刷新后仍生效）
    if (galleryUnlocked()) gal.classList.add('unlocked');

    // 隐藏的文件选择器（全画廊共用一个）
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    let pendingBox = null;
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = '';
      const box = pendingBox;
      pendingBox = null;
      if (!f || !box) return;
      compressToJpeg(f, 900).then(r => {
        setBoxImg(box, URL.createObjectURL(r.blob));
        const sb = (typeof CONFIG !== 'undefined' && CONFIG.cloud) || {};
        const slot = { page: sb.page, key: 'gal', ix: Number(box.dataset.ix) };
        if (!Cloud.ready()) return;
        box.classList.add('uploading');
        Cloud.save(r.blob, slot)
          .then(hit => { setBoxImg(box, hit.url); flashBox(box, '已同步 ✓'); })
          .catch(err => { console.warn('[画廊上传失败]', err); flashBox(box, '没传上去 · 只在本机'); })
          .finally(() => box.classList.remove('uploading'));
      }).catch(err => console.warn('[画廊压缩失败]', err));
    });

    let taps = 0, tapTimer = 0;
    gal.addEventListener('click', (e) => {
      const box = e.target.closest('.gbox');
      if (!box) return;
      if (box.classList.contains('locked')) return;         // 锁死的格子：不看云端的，也不许换
      // ✕ 角标：删除（仅解锁态显示，天然不会在未解锁时点到）
      if (e.target.classList.contains('gx')) {
        e.stopPropagation();
        const sb = (typeof CONFIG !== 'undefined' && CONFIG.cloud) || {};
        const slot = { page: sb.page, key: 'gal', ix: Number(box.dataset.ix) };
        const img = box.querySelector('img');
        if (img) img.removeAttribute('src');
        box.classList.add('empty');
        box.classList.remove('has-img');
        if (Cloud.ready()) Cloud.remove(slot);
        return;
      }
      if (!galleryUnlocked()) {
        taps++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { taps = 0; }, 1200);
        if (taps >= 5) {
          taps = 0;
          const code = (typeof prompt === 'function') ? prompt('请输入编辑口令') : null;
          if (code != null && String(code).trim() === galleryPasscode()) {
            try { localStorage.setItem(CU_UNLOCK, '1'); } catch (err) {}
            gal.classList.add('unlocked');
          }
        }
        return;
      }
      pendingBox = box;
      input.click();
    });
  }

  /* ---------- 各子页的返回按钮：直接回牌阵 ---------- */
  $('#chapter-back').addEventListener('click', () => showPage('#page-reveal'));
  $('#scroll-back').addEventListener('click', () => showPage('#page-reveal'));
  $('#sword-back').addEventListener('click', () => showPage('#page-reveal'));

  /* ============================================================
   * 第五页：卷 I · 燃烧的羊皮纸
   * 右侧格子线逐行浮现；点击左上角权杖 → 羊皮纸从左下烧到右上 → 卷 II
   * ============================================================ */
  const scrollStage = $('#scroll-stage');
  const burnLine = $('#burn-line');
  const ashLayer = $('#scroll-ash');

  function buildScrollLines() {
    const box = $('#scroll-lines');
    box.innerHTML = '';
    const words = CONFIG.scroll.lines || [];
    const count = Math.max(CONFIG.scroll.lineCount || 9, words.length);
    for (let i = 0; i < count; i++) {
      const ln = document.createElement('div');
      ln.className = 's-line';
      if (words[i]) {
        const t = document.createElement('span');
        t.className = i === 0 ? 's-word s-word-head' : 's-word';
        // 主题字前不加墨点，其余每行行首加"·"
        t.textContent = (i === 0 ? '' : '· ') + words[i];
        ln.appendChild(t);
      }
      box.appendChild(ln);
    }
  }

  /* 宝剑卷左右文字板：内容来自 config.sword */
  function buildSwordPanels() {
    const cfg = CONFIG.sword || {};
    const left = $('.sword-panel-l');
    const right = $('.sword-panel-r');
    if (!left || !right) return;
    // 左板：主题大字
    left.innerHTML = '';
    if (cfg.leftText) {
      const t = document.createElement('span');
      t.className = 'sp-theme';
      t.textContent = cfg.leftText;
      left.appendChild(t);
    }
    // 右板：一行一项
    right.innerHTML = '';
    (cfg.rightLines || []).forEach(line => {
      const p = document.createElement('span');
      p.className = 'sp-line';
      p.textContent = line;
      right.appendChild(p);
    });
    // 剑尖下方的誓词
    const vow = $('#sword-vow');
    if (vow) {
      vow.innerHTML = '';
      (cfg.vowLines || []).forEach(line => {
        const p = document.createElement('span');
        p.className = 'vow-line';
        p.textContent = line;
        vow.appendChild(p);
      });
    }
  }

  function buildScrollDialogue() {
    const box = $('#scroll-dialogue');
    if (!box) return;
    const items = (CONFIG.scroll && CONFIG.scroll.dialogue) || [];
    const q = box.querySelector('.sd-q');
    const a = box.querySelector('.sd-a');
    const get = (k) => items.find(it => it.who === k);
    const qItem = get('q'); const aItem = get('a');
    q.textContent = qItem ? qItem.text : '';
    a.textContent = aItem ? aItem.text : '';
  }

  function enterScroll() {
    // 复位：摘掉烧毁遮罩、藏起燃烧线、权杖恢复、收回火层
    scrollStage.style.webkitMaskImage = '';
    scrollStage.style.maskImage = '';
    scrollStage.classList.remove('lit');
    ashLayer.hidden = true;
    ashLayer.style.webkitMaskImage = '';
    ashLayer.style.maskImage = '';
    burnLine.hidden = true;
    $('#wand').classList.remove('burning');
    // 中断残留的燃烧：收起画布、清空粒子
    if (typeof fxState !== 'undefined' && fxState !== 'idle') {
      fxState = 'idle'; burning = false;
      fx.classList.remove('on');
      sparks.length = embers.length = smokes.length = flakes.length = 0;
    }
    // 格子线一行一行浮现（横线上暂无内容，等补充）
    const lines = document.querySelectorAll('#scroll-lines .s-line');
    lines.forEach(l => l.classList.remove('show'));
    lines.forEach((l, i) => {
      setTimeout(() => l.classList.add('show'),
        350 + i * (CONFIG.scroll.lineStaggerMs || 240));
    });
  }

  /* ---------- 粒子画布 ---------- */
  const fx = $('#burn-fx');
  const fctx = fx.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    fx.width = Math.floor(W * DPR);
    fx.height = Math.floor(H * DPR);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  /* 多频正弦噪声：让火线不规则抖动，避免"一条完美直线"的塑料感 */
  function noise(x) {
    return Math.sin(x) * .55 + Math.sin(x * 2.13 + 1.7) * .3 + Math.sin(x * 4.71 + .6) * .15;
  }

  /* 把 CSS 45° 渐变的百分比位置，换算成屏幕上的火线中点与方向。
     45° 渐变方向指向右上，火线（等值线）垂直于它。 */
  function burnGeom(bPct) {
    const th = Math.PI / 4;
    const ux = Math.sin(th), uy = -Math.cos(th);         // 推进方向（指向未烧侧）
    const L = Math.abs(W * Math.sin(th)) + Math.abs(H * Math.cos(th));
    const p = bPct / 100;
    return {
      cx: W / 2 + ux * L * (p - .5),
      cy: H / 2 + uy * L * (p - .5),
      vx: Math.cos(th), vy: Math.sin(th),                // 火线延伸方向
      nx: ux, ny: uy,                                    // 推进方向
      half: L / 2
    };
  }

  /* 粒子池 */
  const sparks = [], embers = [], smokes = [], flakes = [];
  const MAX = 460;
  function total() { return sparks.length + embers.length + smokes.length + flakes.length; }

  /* 沿火线取一个随机点（带不规则抖动，d 为沿推进方向的偏移） */
  function onFireLine(g, d, jitter) {
    const s = (Math.random() * 2 - 1) * g.half;
    const j = noise(s * .045 + performance.now() * .004) * (jitter || 10);
    return {
      x: g.cx + g.vx * s + g.nx * (d + j),
      y: g.cy + g.vy * s + g.ny * (d + j)
    };
  }
  const inView = (p) => p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30;

  /* ---- 各类粒子的生成 ---- */
  function spawnSpark(x, y, hot) {
    if (total() > MAX) return;
    sparks.push({
      x, y,
      vx: (Math.random() - .5) * 1.1,
      vy: hot ? -(0.9 + Math.random() * 1.9) : -(0.3 + Math.random() * 1.2),
      r: (hot ? 1.5 : 1) + Math.random() * 1.4,
      age: 0, life: 26 + Math.random() * 46,
      sw: (Math.random() - .5) * .05          // 横向摆动频率
    });
  }
  function spawnEmber(x, y) {
    if (total() > MAX) return;
    embers.push({
      x, y,
      vx: (Math.random() - .5) * .55,
      vy: -(0.25 + Math.random() * .6),
      r: .7 + Math.random() * 1.1,
      age: 0, life: 90 + Math.random() * 90,
      ph: Math.random() * 6.28
    });
  }
  function spawnSmoke(x, y) {
    if (total() > MAX) return;
    smokes.push({
      x: x + (Math.random() - .5) * 14,
      y: y - Math.random() * 10,
      vx: (Math.random() - .5) * .35,
      vy: -(0.35 + Math.random() * .5),
      r: 8 + Math.random() * 16,
      age: 0, life: 70 + Math.random() * 80,
      rot: Math.random() * 6.28, vrot: (Math.random() - .5) * .012
    });
  }
  function spawnFlake(x, y) {
    if (total() > MAX) return;
    flakes.push({
      x, y,
      vx: (Math.random() - .5) * .9,
      vy: -(0.2 + Math.random() * .8),
      size: 2.5 + Math.random() * 4,
      rot: Math.random() * 6.28, vrot: (Math.random() - .5) * .18,
      age: 0, life: 70 + Math.random() * 60,
      ph: Math.random() * 6.28
    });
  }

  /* ---- 火焰本体：沿火线画抖动的亮斑 + 未烧侧的焦边（仿照参考视频：厚实连续的焦褐灼边 + 亮橙火线） ---- */
  function drawFire(g, t) {
    // 焦边：贴在未烧侧 4~22px，深褐、连续成带（两层叠加：底层宽焦晕 + 上层深褐碎斑）
    fctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 60; i++) {
      const s = (i / 59 * 2 - 1) * g.half;
      const j = noise(s * .05 + t * .0022) * 16;
      const px = g.cx + g.vx * s + g.nx * (13 + j);
      const py = g.cy + g.vy * s + g.ny * (13 + j);
      if (!inView({ x: px, y: py })) continue;
      const rr = 15 + Math.random() * 17;
      const gr = fctx.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, 'rgba(64,30,6,.5)');
      gr.addColorStop(1, 'rgba(64,30,6,0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(px, py, rr, 0, 6.2832); fctx.fill();
    }
    for (let i = 0; i < 44; i++) {
      const s = (i / 43 * 2 - 1) * g.half;
      const j = noise(s * .05 + t * .0022) * 14;
      const px = g.cx + g.vx * s + g.nx * (7 + j);
      const py = g.cy + g.vy * s + g.ny * (7 + j);
      if (!inView({ x: px, y: py })) continue;
      const rr = 9 + Math.random() * 11;
      const gr = fctx.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, 'rgba(38,16,2,.72)');
      gr.addColorStop(1, 'rgba(38,16,2,0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(px, py, rr, 0, 6.2832); fctx.fill();
    }
    // 火焰：亮黄焰心 + 橙红外焰，亮度随时间闪烁
    fctx.globalCompositeOperation = 'lighter';
    const flick = .78 + .22 * Math.sin(t * .021) * Math.sin(t * .0071 + 1.2);
    for (let i = 0; i < 62; i++) {
      const s = (i / 61 * 2 - 1) * g.half;
      const j = noise(s * .05 + t * .0022) * 15;
      const px = g.cx + g.vx * s + g.nx * (j - 3);
      const py = g.cy + g.vy * s + g.ny * (j - 3);
      if (!inView({ x: px, y: py })) continue;
      const rr = (14 + Math.random() * 19) * flick;
      const gr = fctx.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, 'rgba(255,242,204,' + (.62 * flick).toFixed(3) + ')');
      gr.addColorStop(.35, 'rgba(255,158,44,' + (.4 * flick).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(190,52,8,0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(px, py, rr, 0, 6.2832); fctx.fill();
    }
  }

  /* ---- 粒子更新与绘制 ---- */
  function updateParticles(dt) {
    // 火花
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age >= p.life) { sparks.splice(i, 1); continue; }
      const a = p.age / p.life;
      p.vy += (-0.155 * (1 - a) + 0.062) * dt;   // 浮力随寿命衰减 → 先升后落
      p.vx = p.vx * (1 - .012 * dt) + Math.sin(p.age * .18 + p.sw * 10) * .022 * dt;
      p.vy *= (1 - .008 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    // 余烬
    for (let i = embers.length - 1; i >= 0; i--) {
      const p = embers[i];
      p.age += dt;
      if (p.age >= p.life) { embers.splice(i, 1); continue; }
      p.vy += (-0.075 * (1 - p.age / p.life) + 0.03) * dt;
      p.x += (p.vx + Math.sin(p.age * .05 + p.ph) * .35) * dt;
      p.y += p.vy * dt;
    }
    // 烟
    for (let i = smokes.length - 1; i >= 0; i--) {
      const p = smokes[i];
      p.age += dt;
      if (p.age >= p.life) { smokes.splice(i, 1); continue; }
      p.vy += (-0.03) * dt;
      p.x += (p.vx + Math.sin(p.age * .022 + p.rot) * .22) * dt;
      p.y += p.vy * dt;
      p.r += .28 * dt;
      p.rot += p.vrot * dt;
    }
    // 纸屑
    for (let i = flakes.length - 1; i >= 0; i--) {
      const p = flakes[i];
      p.age += dt;
      if (p.age >= p.life) { flakes.splice(i, 1); continue; }
      p.vy += (-0.045 * (1 - p.age / p.life) + 0.075) * dt;
      p.x += (p.vx + Math.sin(p.age * .06 + p.ph) * .5) * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  function drawParticles() {
    // 烟（在亮纸上才看得见，深色低调）
    fctx.globalCompositeOperation = 'source-over';
    for (const p of smokes) {
      const a = p.age / p.life;
      const al = Math.sin(Math.PI * Math.min(1, a * 1.6)) * .085;
      if (al <= 0.002) continue;
      const gr = fctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, 'rgba(74,60,50,' + al.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(74,60,50,0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 6.2832); fctx.fill();
    }
    // 纸屑：焦黑小片，旋转飘落
    for (const p of flakes) {
      const a = p.age / p.life;
      const al = (1 - a) * .8;
      fctx.save();
      fctx.translate(p.x, p.y); fctx.rotate(p.rot);
      fctx.fillStyle = 'rgba(38,24,12,' + al.toFixed(3) + ')';
      fctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * .5);
      fctx.restore();
    }
    // 火花 / 余烬（加色发光）
    fctx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      const a = p.age / p.life;
      const al = (1 - a * a) * .95;
      const r = p.r * (1 - a * .45);
      let col;
      if (a < .3) col = '255,242,205';
      else if (a < .62) col = '255,163,52';
      else col = '196,58,10';
      const gr = fctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4);
      gr.addColorStop(0, 'rgba(' + col + ',' + al.toFixed(3) + ')');
      gr.addColorStop(.3, 'rgba(' + col + ',' + (al * .38).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(p.x, p.y, r * 3.4, 0, 6.2832); fctx.fill();
    }
    for (const p of embers) {
      const a = p.age / p.life;
      const al = (1 - a) * (a < .12 ? a / .12 : 1) * .8;
      const col = a < .5 ? '255,140,40' : '168,44,12';
      const gr = fctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      gr.addColorStop(0, 'rgba(' + col + ',' + al.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(p.x, p.y, p.r * 3, 0, 6.2832); fctx.fill();
    }
    fctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- 燃烧状态机 ---------- */
  let burning = false, fxState = 'idle', lastT = 0;
  let pending = { spark: 0, ember: 0, smoke: 0, flake: 0 };
  const FROM = -20, TO = 138;                 // 火线从左下角外推进到右上角外

  function fxTick(t) {
    if (fxState === 'idle') return;
    const dt = Math.min(3, (t - lastT) / 16.67) || 1;
    lastT = t;
    fctx.clearRect(0, 0, W, H);

    // --- 推进火线 ---
    let g = null;
    if (fxState === 'burn') {
      const bt = burnState;
      const p = Math.min(1, (t - bt.t0) / bt.ms);
      const eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const b = FROM + (TO - FROM) * eased;

      // 遮罩：渐变线以下（左下侧）透明 = 已烧掉。过渡带收窄，让边缘更"烧穿"
      const mask = 'linear-gradient(45deg, transparent calc(' + b.toFixed(2) + '% - 9%), #000 calc(' + b.toFixed(2) + '% - 1%))';
      scrollStage.style.webkitMaskImage = mask;
      scrollStage.style.maskImage = mask;
      // 灰烬层：与纸相反，只显示已烧掉的区域
      const amask = 'linear-gradient(45deg, #000 calc(' + b.toFixed(2) + '% - 9%), transparent ' + b.toFixed(2) + '%)';
      ashLayer.style.webkitMaskImage = amask;
      ashLayer.style.maskImage = amask;
      // 火线烧灼带：已烧侧焦黑 → 焦褐 → 亮橙火前沿 → 透明（仿参考视频的厚灼边）
      burnLine.style.backgroundImage =
        'linear-gradient(45deg,' +
        'rgba(28,12,2,.5) calc(' + b.toFixed(2) + '% - 8%),' +
        'rgba(94,40,8,.55) calc(' + b.toFixed(2) + '% - 3%),' +
        'rgba(255,120,30,.6) calc(' + b.toFixed(2) + '% - .5%),' +
        'rgba(255,205,120,.55) calc(' + b.toFixed(2) + '% + 1.5%),' +
        'transparent calc(' + b.toFixed(2) + '% + 6%))';

      g = burnGeom(b - 4);
      // 火焰本体
      drawFire(g, t);

      // 沿火线生成粒子（密度 × 火线推进速度：烧得越快火越旺）
      const sp = (CONFIG.scroll.sparkRate || 2.2) * dt;
      const ep = (CONFIG.scroll.emberRate || 1.1) * dt;
      const kp = (CONFIG.scroll.smokeRate || .55) * dt;
      const fp = (CONFIG.scroll.flakeRate || .16) * dt;
      const gen = (p, key, fn) => {
        pending[key] += p;
        while (pending[key] >= 1) {
          pending[key] -= 1;
          const pt = onFireLine(g, -2 + Math.random() * 10, 12);
          if (inView(pt)) fn(pt.x, pt.y);
        }
      };
      gen(sp, 'spark', (x, y) => spawnSpark(x, y, true));
      gen(ep, 'ember', spawnEmber);
      gen(kp, 'smoke', spawnSmoke);
      gen(fp, 'flake', spawnFlake);

      if (p >= 1) {
        // 纸烧尽了：留一段余烬飘散，再转场
        fxState = 'ember';
        burnState.emberT0 = t;
        ashLayer.style.webkitMaskImage = 'linear-gradient(45deg,#000 0%,#000 100%)';
        ashLayer.style.maskImage = ashLayer.style.webkitMaskImage;
      }
    } else if (fxState === 'ember') {
      const el = t - burnState.emberT0;
      // 余烬继续飘，少量火星从灰烬里冒出来——只在余烬期前段生成，之后不再补充，
      // 否则粒子永远死不完，燃烧的余烬会一直飘到之后所有页面（fixed 画布跟着走）
      if (el < (CONFIG.scroll.emberFadeMs || 1100) * .9) {
        pending.ember += (CONFIG.scroll.emberRate || 1.1) * .35 * dt;
        while (pending.ember >= 1) {
          pending.ember -= 1;
          spawnEmber(Math.random() * W * .8, H * (.45 + Math.random() * .45));
        }
      }
      if (el > (CONFIG.scroll.emberFadeMs || 1100) && !burnState.jumped) {
        burnState.jumped = true;
        // nextTarget 留空 = 不跳转，停在羊皮纸页，只能从「← 牌阵」离开
        const target = CONFIG.scroll.nextTarget;
        if (target) {
          showPage(target, true);   // 燃烧跳转：保留余烬，让下一页从余烬里淡入
          // 下一页从余烬里淡入
          const el2 = $(target);
          el2.classList.remove('fade-in');
          void el2.offsetWidth;
          el2.classList.add('fade-in');
        }
      }
      if (el > (CONFIG.scroll.emberFadeMs || 1100) + 1500 && total() === 0) {
        fxState = 'idle';
        fx.classList.remove('on');
        fctx.clearRect(0, 0, W, H);   // 收尾时把画布擦干净，不留残影
        burning = false;
        return;
      }
    }

    updateParticles(dt);
    drawParticles();
    requestAnimationFrame(fxTick);
  }

  let burnState = {};
  /* 切页时强制收掉燃烧特效：清空粒子与画布，余烬不跟着跑到别的页面 */
  function stopBurnFx() {
    if (fxState === 'idle' && !burning) return;
    fxState = 'idle';
    burning = false;
    sparks.length = embers.length = smokes.length = flakes.length = 0;
    pending = { spark: 0, ember: 0, smoke: 0, flake: 0 };
    fctx.clearRect(0, 0, W, H);
    fx.classList.remove('on');
    burnLine.hidden = true;
    ashLayer.hidden = true;
    const wand = $('#wand');
    if (wand) wand.classList.remove('burning');
  }
  function startBurn() {
    if (burning) return;
    burning = true;
    $('#wand').classList.add('burning');
    // 点燃：干净纸淡出，露出底下的火焰羊皮纸
    scrollStage.classList.add('lit');
    burnLine.hidden = false;
    ashLayer.hidden = false;
    // 清空上一轮粒子
    sparks.length = embers.length = smokes.length = flakes.length = 0;
    pending = { spark: 0, ember: 0, smoke: 0, flake: 0 };

    // 权杖顶端先爆一簇火星，像把火甩向羊皮纸
    const w = $('#wand').getBoundingClientRect();
    for (let i = 0; i < 34; i++) {
      spawnSpark(w.left + w.width * (.2 + Math.random() * .6),
                 w.top + w.height * (.05 + Math.random() * .5), true);
    }

    fx.classList.add('on');
    burnState = { t0: performance.now() + 380, ms: CONFIG.scroll.burnMs || 2800, emberT0: 0, jumped: false };
    fxState = 'burn';
    lastT = performance.now();
    requestAnimationFrame(fxTick);
  }

  $('#wand').addEventListener('click', startBurn);

  /* ============================================================
   * 全局：左下角紫色鸟 · 音乐开关
   * 鸟的图片在 index.html 的 #music-bird 里（assets/bird.png）。
   * 音乐路径在 config.js 的 music.src，现在是空的。
   * ============================================================ */
  function initMusic() {
    const btn = $('#music-bird');
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = CONFIG.music.volume;
    // iOS Safari：没插进 DOM 的游离 audio 元素在部分版本里根本发不出声，必须挂上去
    audio.setAttribute('playsinline', '');
    audio.style.cssText = 'position:absolute;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(audio);
    if (CONFIG.music.src) audio.src = CONFIG.music.src;

    btn.addEventListener('click', () => {
      // 还没接音乐：只做扑翅 + 发光的动作反馈，不发声
      if (!CONFIG.music.src) {
        btn.classList.toggle('playing');
        return;
      }
      if (audio.paused) {
        audio.play().then(() => btn.classList.add('playing'))
          .catch(() => btn.classList.remove('playing'));
      } else {
        audio.pause();
        btn.classList.remove('playing');
      }
    });

    // 自动播放：不在进站就响，等走到翻牌页（showPage 派发 cuilu:music-start）
    // ——那时用户已经点过卡牌，浏览器允许出声。万一仍被拦，退回
    // "下一次点击就开始"的兜底。
    if (CONFIG.music.src && CONFIG.music.autoplay) {
      // 被自动播放策略拒了之后，把「下一次触摸/点击再试」挂到捕获阶段：
      // 页面里有大量 stopPropagation，冒泡阶段的监听会被它们吃掉，捕获阶段不会。
      const armGesture = () => {
        const kick = () => {
          ['touchstart', 'mousedown', 'pointerdown', 'click'].forEach(ev =>
            document.removeEventListener(ev, kick, true));
          tryPlay();
        };
        ['touchstart', 'mousedown', 'pointerdown', 'click'].forEach(ev =>
          document.addEventListener(ev, kick, { capture: true, passive: true }));
      };
      const tryPlay = () =>
        audio.play().then(() => btn.classList.add('playing')).catch(() => armGesture());

      document.addEventListener('cuilu:music-start', tryPlay, { once: true });

      // 到抽牌页 + 用户已经点过牌，直接先试一次
      document.addEventListener('cuilu:music-start', () => { armGesture(); }, { once: true });

      // 微信内置浏览器：桥就绪后先试一次，不行再等用户第一次触摸
      const wechatKick = () => {
        tryPlay();
        armGesture();
      };
      if (typeof WeixinJSBridge !== 'undefined' && WeixinJSBridge.invoke) wechatKick();
      else document.addEventListener('WeixinJSBridgeReady', wechatKick, { once: true });
    }
  }

  /* ---------- 造雪：layerSel 为雪层容器，count 为雪片数，heavy 为大雪参数 ---------- */
  function buildSnow(layerSel, count, heavy) {
    const layer = $(layerSel);
    if (!layer) return;
    for (let i = 0; i < count; i++) {
      const f = document.createElement('i');
      const size = heavy ? (2.6 + Math.random() * 4.6) : (2 + Math.random() * 3.2);   // 大雪片更大
      const dur = heavy ? (6 + Math.random() * 9) : (9 + Math.random() * 14);         // 大雪落得更快
      f.style.left = (Math.random() * 100) + '%';
      f.style.width = size.toFixed(1) + 'px';
      f.style.height = size.toFixed(1) + 'px';
      f.style.opacity = (heavy ? 0.5 : 0.35 + Math.random() * (heavy ? 0.5 : 0.45)).toFixed(2);
      f.style.animationDuration = dur.toFixed(1) + 's';
      f.style.animationDelay = (-Math.random() * dur).toFixed(1) + 's';   // 负延迟：进场就是下到一半的天
      f.style.setProperty('--sway', ((Math.random() * (heavy ? 14 : 10) - (heavy ? 7 : 5)).toFixed(1)) + 'vw');
      layer.appendChild(f);
    }
  }

  /* ---------- 启动 ---------- */
  applyConfig();
  // 初始停在首页：鸟先藏起来（showPage 只在切换时加 class，刷新停在首页会漏）
  $('#music-bird').classList.add('bird-hidden');
  buildRevealCards();
  buildRomanBar();
  buildChapter();
  buildScrollLines();
  buildScrollDialogue();
  buildSwordPanels();
  buildSnow('#snow', 42);          // 翻牌页小雪
  buildSnow('#snow-chapter', 110, true);   // 卷 I 画廊页大雪
  buildSnow('#snow-sword', 90, true);      // 宝剑卷大雪
  initMusic();
})();
