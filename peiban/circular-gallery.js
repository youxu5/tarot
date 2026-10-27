/* ==========================================================================
   CircularGallery - 环形画廊（WebGL2）
   来源：react-bits / Components/CircularGallery

   本文件是原生 JS 移植版：着色器与全部数学逻辑逐行保留，
   只把 React hooks 换成实例字段 / 事件委托。零依赖，不需要构建工具。

   三步接入：
     1. <link rel="stylesheet" href="circular-gallery.css">
     2. <div id="gallery"></div>
     3. <script src="circular-gallery.js"></script>
        <script>
          CircularGallery.mount('#gallery', {
            items: [{ image: 'a.jpg', text: '标题' }]
          });
        </script>

   --------------------------------------------------------------------------
   参数（全部可选，不写就用默认值）
   --------------------------------------------------------------------------
   items         数组，必填   [{ image, text, description }]，image 是图片地址
   bend          3           弧面弯曲程度；0 = 平直，负号往反方向弯
   itemSize      1           卡片整体大小倍率 0.2~2
   itemAspect    0.78        卡片宽高比（宽 ÷ 高）
   gap           0.26        卡片间距（按卡片宽度的比例）
   borderRadius  0.05        圆角，相对短边 0~0.5
   textColor     '#ffffff'   文字 / 高亮描边颜色
   wave          1           滚动时的波浪扭曲强度，0 = 关闭
   fadeEdges     0.12        两侧边缘淡出，0 = 不淡出
   shadow        0.25        卡片阴影 0~1
   scrollSpeed   2           拖拽 / 滚轮灵敏度
   scrollEase    0.05        缓动，越小越拖沓 0.001~1
   autoScroll    0           自动滚动速度，0 = 关闭
   grayscale     false       默认黑白，悬停 / 激活时恢复彩色
   showTitles    true        显示卡片标题
   snap          true        松手自动对齐到最近一张
   openOnClick   true        点击卡片放大
   intro         true        首屏入场动画
   font          'bold 30px Figtree, system-ui, sans-serif'  标题字体
   fontUrl       null        自定义字体地址（不填就不请求网络）
   dpr           undefined   设备像素比上限，默认取 window.devicePixelRatio（封顶 2）

   回调：onItemClick(item, index) / onActiveChange(index) / onStateChange(active, open)

   实例方法：
     setOptions({ ... })   运行时改参数
     focusIndex(i)         滚到第 i 张
     openIndex(i)          滚到第 i 张并放大
     replayIntro()         重播入场动画
     useFont(url)          换字体
     destroy()             销毁，释放 WebGL 资源
   ========================================================================== */

;(function (global) {
  'use strict';

/* 只有跨域的 http(s) 图片才需要 crossOrigin；同源 / data: / blob: 一律不加，
   否则用 file:// 直接打开页面时图片会加载失败。 */
const isCrossOrigin = function (url) {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    return new URL(url, location.href).origin !== location.origin;
  } catch (e) {
    return false;
  }
};

const DEFAULT_FONT = 'bold 30px Figtree, system-ui, sans-serif';
const DEFAULT_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Figtree:wght@400;700&display=swap';

  /* 不传 items 时的兜底数据（与原 React 组件一致）。实际使用请自己传 items。 */
  const DEFAULT_ITEMS = Array.from({ length: 12 }, function (_, i) {
    return { image: 'https://picsum.photos/seed/' + (i + 1) + '/800/600', text: 'Image ' + (i + 1) };
  });

const SEGMENTS_X = 32;
const SEGMENTS_Y = 24;
const INTRO_SECONDS = 1.4;
const WORLD_HEIGHT = 16.57;
const CLASSES = {
  root: 'circular-gallery',
  canvas: 'circular-gallery-canvas',
  labels: 'circular-gallery-labels',
  label: 'circular-gallery-label',
  caption: 'circular-gallery-caption',
  captionText: 'circular-gallery-caption-text',
  close: 'circular-gallery-close',
  hidden: 'circular-gallery-hidden'
};
const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
const PICSUM_ITEMS = [
  { image: 'https://picsum.photos/seed/1/800/600', text: 'Bridge' },
  { image: 'https://picsum.photos/seed/2/800/600', text: 'Desk Setup' },
  { image: 'https://picsum.photos/seed/3/800/600', text: 'Waterfall' },
  { image: 'https://picsum.photos/seed/4/800/600', text: 'Strawberries' },
  { image: 'https://picsum.photos/seed/5/800/600', text: 'Deep Diving' },
  { image: 'https://picsum.photos/seed/16/800/600', text: 'Train Track' },
  { image: 'https://picsum.photos/seed/17/800/600', text: 'Santorini' },
  { image: 'https://picsum.photos/seed/8/800/600', text: 'Blurry Lights' },
  { image: 'https://picsum.photos/seed/9/800/600', text: 'New York' },
  { image: 'https://picsum.photos/seed/10/800/600', text: 'Good Boy' },
  { image: 'https://picsum.photos/seed/21/800/600', text: 'Coastline' },
  { image: 'https://picsum.photos/seed/12/800/600', text: 'Palm Trees' }
];

const VERTEX = `#version 300 es
in vec2 aPosition;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uAngle;
uniform float uPad;
uniform float uWave;
uniform float uWaveTime;
uniform float uFocal;
out vec2 vLocal;
void main() {
  vec2 local = aPosition * (uSize + 2.0 * uPad);
  vec2 unit = local / max(uSize, vec2(1.0));
  float z = uWave * (sin(unit.x * 4.0 + uWaveTime) + cos(unit.y * 2.0 + uWaveTime)) * 0.5;
  float depth = uFocal / max(uFocal - z, 1.0);
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 turned = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vLocal = local;
  gl_Position = vec4((uCenter + turned * depth) / (uResolution * 0.5), 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uSize;
uniform float uRadius;
uniform float uImageAspect;
uniform float uReady;
uniform vec3 uPlaceholder;
uniform float uGray;
uniform float uDim;
uniform float uAlpha;
uniform float uRing;
uniform vec3 uRingColor;
uniform float uRingWidth;
uniform float uRingGap;
uniform float uFade;
uniform float uShadow;
uniform float uBlur;
uniform vec2 uShadowOffset;
in vec2 vLocal;
out vec4 outColor;

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float edgeFade() {
  if (uFade <= 0.0) return 1.0;
  float u = gl_FragCoord.x / uResolution.x;
  return smoother(u / uFade) * smoother((1.0 - u) / uFade);
}

void main() {
  vec2 extent = uSize * 0.5;
  if (uShadow > 0.0) {
    float d = roundBox(vLocal - uShadowOffset, extent, uRadius);
    float a = uShadow * (1.0 - smoothstep(-uBlur, uBlur, d)) * uAlpha * edgeFade();
    outColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  float d = roundBox(vLocal, extent, uRadius);
  float pixel = max(length(vec2(dFdx(d), dFdy(d))), 1e-4);
  float cover = clamp(0.5 - d / pixel, 0.0, 1.0);
  vec2 uv = vLocal / uSize + 0.5;
  float aspect = uSize.x / uSize.y;
  vec2 crop = aspect > uImageAspect ? vec2(1.0, uImageAspect / aspect) : vec2(aspect / uImageAspect, 1.0);
  vec3 image = texture(uTexture, (uv - 0.5) * crop + 0.5).rgb;
  vec3 color = mix(uPlaceholder, image, uReady);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(luma), uGray) * (1.0 - uDim);
  float body = cover * mix(0.08, 1.0, uReady);
  float band = abs(d - uRingGap - uRingWidth * 0.5) - uRingWidth * 0.5;
  float ring = clamp(0.5 - band / pixel, 0.0, 1.0) * uRing;
  vec4 card = vec4(color * body, body);
  vec4 outline = vec4(uRingColor * ring, ring);
  outColor = (card + outline * (1.0 - card.a)) * uAlpha * edgeFade();
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = value => value * value * (3 - 2 * value);
const wrap = (value, length) => ((value % length) + length) % length;

function deriveFontFamilyFromUrl(url) {
  const fileName = (url.split('/').pop() || 'custom-font').split('?')[0];
  const base = fileName.replace(/\.(woff2?|ttf|otf|eot)$/i, '');
  return base.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'CircularGalleryFont';
}

async function loadFontFromStylesheet(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch font stylesheet (${response.status})`);
  const cssText = await response.text();
  const faceBlocks = cssText.match(/@font-face\s*{[^}]*}/g) || [];
  let family = null;
  const fontFaces = [];
  for (const block of faceBlocks) {
    const familyMatch = block.match(/font-family:\s*['"]?([^;'"]+)['"]?/);
    const urlMatch = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
    if (!familyMatch || !urlMatch) continue;
    family = familyMatch[1].trim();
    const descriptors = {};
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const rangeMatch = block.match(/unicode-range:\s*([^;]+);/);
    if (weightMatch) descriptors.weight = weightMatch[1].trim();
    if (styleMatch) descriptors.style = styleMatch[1].trim();
    if (rangeMatch) descriptors.unicodeRange = rangeMatch[1].trim();
    fontFaces.push(new FontFace(family, `url(${urlMatch[1]})`, descriptors));
  }
  if (!family) throw new Error('No @font-face rule found in the stylesheet');
  await Promise.allSettled(
    fontFaces.map(async face => {
      await face.load();
      document.fonts.add(face);
    })
  );
  return family;
}

async function loadFontFromFile(url) {
  const family = deriveFontFamilyFromUrl(url);
  const fontFace = new FontFace(family, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  return family;
}

async function resolveFont(font, fontUrl) {
  const url = fontUrl || (font === DEFAULT_FONT ? DEFAULT_FONT_URL : null);
  if (!url) return font;
  try {
    const isStylesheet = url.includes('fonts.googleapis.com') || /\.css(\?.*)?$/i.test(url);
    const family = isStylesheet ? await loadFontFromStylesheet(url) : await loadFontFromFile(url);
    const sizeMatch = font.match(/^\s*(.*?\d+px)/);
    return `${sizeMatch ? sizeMatch[1].trim() : 'bold 30px'} "${family}"`;
  } catch {
    return font;
  }
}

const fontScale = font => {
  const match = String(font).match(/(\d+(?:\.\d+)?)px/);
  return match ? parseFloat(match[1]) / 30 : 1;
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.error('shader compile failed:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
};

const link = gl => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

class CircularGallery {
  constructor(container, options = {}) {
    this.container = container;
    this.settings = Object.assign(
      {
        items: DEFAULT_ITEMS,
        bend: 3,
        textColor: '#ffffff',
        borderRadius: 0.05,
        font: DEFAULT_FONT,
        fontUrl: null,
        scrollSpeed: 2,
        scrollEase: 0.05,
        itemSize: 1,
        itemAspect: 0.78,
        gap: 0.26,
        wave: 1,
        fadeEdges: 0.12,
        shadow: 0.25,
        grayscale: false,
        showTitles: true,
        snap: true,
        autoScroll: 0,
        openOnClick: true,
        intro: true,
        dpr: undefined,
        onItemClick: undefined,
        onActiveChange: undefined,
        onStateChange: undefined
      },
      options
    );
    this.fontRef = this.settings.font;
    this.active = 0;
    this.open = false;
    this.cards = [];
    this.pool = [];
    this.raf = 0;
    this.last = 0;
    this.visible = true;
    this.snapTimer = 0;
    this.lastItems = null;
    this.typing = false;
    this.textures = new Map();
    this.colorCache = new Map();
    this.view = { width: 1, height: 1, ratio: 1 };
    this.state = {
      scroll: 0, target: 0, velocity: 0, open: 0, openTarget: 0,
      intro: this.settings.intro ? 0 : 1, waveTime: 0, ring: 0, keyboard: false,
      hovered: null, hover: new Map(), focus: new Map(), drag: null,
      lastInput: 0, active: 0, spacing: 1
    };
    this.buttons = [];
    this.frame = this.frame.bind(this);
    this.wake = this.wake.bind(this);

    this.build();
    if (!this.initGL()) return;
    this.bindEvents();
    this.resize();
    this.lastItems = this.settings.items;
    this.settings.items.forEach(item => this.textureFor(item.image));
    this.wake();
  }

  /* ---------- DOM ---------- */
  build() {
    const c = this.container;
    c.classList.add(CLASSES.root);
    c.tabIndex = 0;
    c.setAttribute('role', 'region');
    c.setAttribute('aria-roledescription', 'carousel');
    c.setAttribute('aria-label', 'Image gallery');

    this.canvas = document.createElement('canvas');
    this.canvas.className = CLASSES.canvas;
    this.canvas.setAttribute('aria-hidden', 'true');
    c.appendChild(this.canvas);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = CLASSES.labels;
    this.labelLayer.setAttribute('aria-hidden', 'true');
    c.appendChild(this.labelLayer);

    this.caption = document.createElement('div');
    this.caption.className = CLASSES.caption;
    this.caption.setAttribute('aria-hidden', 'true');
    c.appendChild(this.caption);

    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = CLASSES.close;
    this.closeBtn.dataset.galleryClose = '';
    this.closeBtn.tabIndex = -1;
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.closeBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
      '<path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>';
    this.closeBtn.addEventListener('click', () => this.doClose());
    c.appendChild(this.closeBtn);

    this.list = document.createElement('ul');
    this.list.className = CLASSES.hidden;
    this.list.dataset.galleryList = '';
    c.appendChild(this.list);
    this.buildList();

    this.live = document.createElement('div');
    this.live.className = CLASSES.hidden;
    this.live.setAttribute('aria-live', 'polite');
    c.appendChild(this.live);
  }

  buildList() {
    const list = this.settings.items;
    this.list.replaceChildren();
    this.buttons = list.map((item, index) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.text || item.alt || `Image ${index + 1}`;
      btn.setAttribute('aria-label', `${btn.textContent}, ${index + 1} of ${list.length}`);
      btn.tabIndex = index === this.active ? 0 : -1;
      btn.addEventListener('focus', () => this.focusIndex(index));
      btn.addEventListener('click', () => this.openIndex(index));
      li.appendChild(btn);
      this.list.appendChild(li);
      return btn;
    });
  }

  syncList() {
    const count = this.settings.items.length;
    this.buttons.forEach((btn, index) => {
      btn.tabIndex = index === this.active ? 0 : -1;
      if (index === this.active) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
    this.live.textContent = this.open
      ? `${this.settings.items[wrap(this.active, count)]?.text || 'Image'} opened`
      : '';
    /* 原生 DOM 里 dataset.x = undefined 会变成字符串 "undefined"（属性依旧存在），
       必须显式 toggle。React 版本的 data-visible={open ? '' : undefined} 是靠
       React 丢弃 undefined 属性实现的，移植过来必须改。*/
    this.closeBtn.toggleAttribute('data-visible', this.open);
    this.closeBtn.tabIndex = this.open ? 0 : -1;
    this.caption.setAttribute('aria-hidden', this.open ? 'false' : 'true');
    this.settings.onStateChange?.(this.active, this.open);
  }

  /* ---------- GL ---------- */
  initGL() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false
    });
    if (!gl) {
      /* 不依赖宿主页面上的任何元素：mount() 会负责显示降级提示。 */
      console.warn('[CircularGallery] 当前环境不支持 WebGL2，组件无法渲染。');
      return false;
    }
    this.gl = gl;
    const program = link(gl);
    if (!program) return false;
    this.program = program;
    this.u = program.uniforms;
    const u = this.u;
    this.uOk = Object.keys(u).length > 10;

    const vertices = [];
    for (let y = 0; y <= SEGMENTS_Y; y++)
      for (let x = 0; x <= SEGMENTS_X; x++)
        vertices.push(x / SEGMENTS_X - 0.5, y / SEGMENTS_Y - 0.5);
    const indices = [];
    for (let y = 0; y < SEGMENTS_Y; y++)
      for (let x = 0; x < SEGMENTS_X; x++) {
        const a = y * (SEGMENTS_X + 1) + x;
        const b = a + 1;
        const cc = a + SEGMENTS_X + 1;
        const d = cc + 1;
        indices.push(a, b, d, a, d, cc);
      }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    this.anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    this.blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    this.probe = probe;
    this.reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return true;
  }

  parse(value) {
    const key = String(value);
    if (this.colorCache.has(key)) return this.colorCache.get(key);
    let rgb = [1, 1, 1];
    if (this.probe) {
      this.probe.clearRect(0, 0, 1, 1);
      this.probe.fillStyle = '#ffffff';
      this.probe.fillStyle = key;
      this.probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = this.probe.getImageData(0, 0, 1, 1).data;
      rgb = [r / 255, g / 255, b / 255];
    }
    this.colorCache.set(key, rgb);
    return rgb;
  }

  textureFor(url) {
    const existing = this.textures.get(url);
    if (existing) return existing;
    const entry = { texture: null, aspect: 1, ready: 0, loaded: false };
    this.textures.set(url, entry);
    const gl = this.gl;
    const image = new Image();
    /* 只有跨域的 http(s) 图片才需要 crossOrigin（否则 WebGL 上传纹理会报安全错误）；
       同源 / data: / blob: 一律不加 —— 否则 file:// 直接打开时会加载失败。 */
    if (isCrossOrigin(url)) image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (!this.textures.has(url)) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (this.anisotropy) {
        const max = gl.getParameter(this.anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      }
      entry.texture = texture;
      entry.aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
      entry.loaded = true;
      this.wake();
    };
    image.src = url;
    return entry;
  }

  prune(list) {
    const keep = new Set(list.map(item => item.image));
    this.textures.forEach((entry, url) => {
      if (keep.has(url)) return;
      if (entry.texture) this.gl.deleteTexture(entry.texture);
      this.textures.delete(url);
    });
  }

  measure() {
    const s = this.settings;
    const height = 0.6 * this.view.height * s.itemSize;
    const width = height * s.itemAspect;
    const scale = Math.min(1, (this.view.width * 0.82) / width);
    return { w: width * scale, h: height * scale, spacing: width * scale * (1 + s.gap) };
  }

  arcOf(x) {
    const s = this.settings;
    if (!s.bend) return { y: 0, angle: 0 };
    const depth = (Math.abs(s.bend) * this.view.height) / WORLD_HEIGHT;
    const half = Math.max(this.view.width, this.view.height * 1.9) / 2;
    const radius = (half * half + depth * depth) / (2 * depth);
    const reach = Math.min(Math.abs(x), half, radius * 0.999);
    const arc = radius - Math.sqrt(radius * radius - reach * reach);
    const angle = Math.sign(x) * Math.asin(reach / radius);
    return s.bend > 0 ? { y: -arc, angle: -angle } : { y: arc, angle };
  }

  captionSize() {
    return clamp(this.view.height * 0.045, 15, 22);
  }

  ensurePool(spacing) {
    const size = Math.ceil(this.view.width / Math.max(spacing, 1)) + 8;
    if (this.pool.length === size) return;
    this.labelLayer.replaceChildren();
    this.pool = Array.from({ length: size }, () => {
      const el = document.createElement('span');
      el.className = CLASSES.label;
      el.style.opacity = '0';
      this.labelLayer.appendChild(el);
      return { el, slot: null, font: '', text: '' };
    });
  }

  layout() {
    const s = this.settings;
    const list = s.items;
    const count = list.length;
    const { w, h, spacing } = this.measure();
    this.state.spacing = spacing;
    const introEase = 1 - Math.pow(1 - this.state.intro, 3);
    const scroll = this.state.scroll + (1 - introEase) * spacing * 1.6;
    const margin = Math.max(20, Math.min(this.view.width, this.view.height) * 0.06);
    const baseLabel = h * 0.072 * fontScale(this.fontRef);
    const openFrame = item => {
      const aspect = this.textureFor(item.image).aspect || w / h;
      const titleSpace = item.text && s.showTitles ? this.captionSize() * 2.4 : 0;
      const captionSpace = titleSpace + (item.description ? 52 : 0);
      const width = Math.min(
        this.view.width - margin * 2,
        (this.view.height - margin * 2 - captionSpace) * aspect
      );
      return { width, height: width / aspect, y: captionSpace / 2, titleSpace };
    };
    const activeFrame = openFrame(list[wrap(this.state.active, count)]);
    const spread = Math.max(0, activeFrame.width / 2 - w / 2);
    const activeX = this.state.active * spacing - scroll;
    const first = Math.floor((scroll - this.view.width / 2 - spacing * 2) / spacing);
    const lastSlot = Math.ceil((scroll + this.view.width / 2 + spacing * 2) / spacing);
    const next = [];
    let lead = null;
    for (let slot = first; slot <= lastSlot; slot++) {
      const index = wrap(slot, count);
      const item = list[index];
      const entry = this.textureFor(item.image);
      const focus = ease(this.state.focus.get(slot) || 0);
      let x = slot * spacing - scroll;
      x += Math.sign(x - activeX) * this.state.open * (1 - focus) * spread;
      const arc = this.arcOf(x);
      const frame = focus > 0 ? openFrame(item) : activeFrame;
      const order = Math.abs(slot * spacing - this.state.scroll) / spacing;
      const shown = ease(clamp(this.state.intro * 2.2 - order * 0.22, 0, 1));
      const hover = this.state.hover.get(slot) || 0;
      const lift = 1 + hover * 0.04 * (1 - focus);
      const card = {
        slot, index, item, entry,
        x: mix(x, 0, focus),
        y: mix(arc.y, frame.y, focus) - (1 - shown) * h * 0.18,
        angle: arc.angle * (1 - focus),
        w: mix(w, frame.width, focus) * lift,
        h: mix(h, frame.height, focus) * lift,
        radius: s.borderRadius * Math.min(w, h),
        alpha: shown * mix(1, 0.12, this.state.open * (1 - focus)),
        dim: this.state.open * (1 - focus) * 0.4,
        gray: s.grayscale ? 1 - Math.max(hover, focus, slot === this.state.active ? this.state.ring : 0) : 0,
        focus,
        labelAlpha: mix(1 - this.state.open, 1, focus),
        labelSize: mix(baseLabel, this.captionSize(), focus),
        frame
      };
      if (!lead || focus > lead.focus) lead = card;
      next.push(card);
    }
    next.sort((a, b) => a.focus - b.focus || Math.abs(b.x) - Math.abs(a.x));
    this.cards = next;
    const frame = lead && lead.focus > 0 ? lead.frame : activeFrame;
    return { w, h, spacing, openH: frame.height, openY: frame.y, titleSpace: frame.titleSpace };
  }

  draw(metrics) {
    const gl = this.gl;
    const u = this.u;
    const s = this.settings;
    const ratio = this.view.ratio;
    const speed = Math.min(Math.abs(this.state.velocity) / Math.max(metrics.spacing * 4, 1), 1);
    const wavePx = this.reduce ? 0 : s.wave * speed * this.view.height * 0.08 * ratio;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uFocal, this.view.height * 1.207 * ratio);
    gl.uniform1f(u.uWaveTime, this.state.waveTime);
    gl.uniform1f(u.uFade, s.fadeEdges);
    gl.uniform3fv(u.uPlaceholder, this.parse(s.textColor));
    gl.uniform3fv(u.uRingColor, this.parse(s.textColor));
    gl.uniform1f(u.uRingWidth, 2 * ratio);
    gl.uniform1f(u.uRingGap, 5 * ratio);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.uTexture, 0);
    const count = SEGMENTS_X * SEGMENTS_Y * 6;
    const blur = Math.max(10, metrics.h * 0.09) * ratio;
    const place = card => {
      gl.uniform2f(u.uCenter, card.x * ratio, card.y * ratio);
      gl.uniform2f(u.uSize, card.w * ratio, card.h * ratio);
      gl.uniform1f(u.uAngle, card.angle);
      gl.uniform1f(u.uRadius, Math.min(card.radius, card.w / 2, card.h / 2) * ratio);
      gl.uniform1f(u.uWave, wavePx * (1 - card.focus));
      gl.uniform1f(u.uAlpha, card.alpha);
    };
    if (s.shadow > 0) {
      gl.uniform1f(u.uShadow, s.shadow);
      gl.uniform1f(u.uBlur, blur);
      gl.uniform2f(u.uShadowOffset, 0, -blur * 0.45);
      gl.uniform1f(u.uPad, blur * 1.6);
      gl.bindTexture(gl.TEXTURE_2D, this.blank);
      this.cards.forEach(card => {
        place(card);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      });
    }
    gl.uniform1f(u.uShadow, 0);
    gl.uniform1f(u.uPad, 10 * ratio);
    this.cards.forEach(card => {
      place(card);
      const entry = card.entry;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture || this.blank);
      gl.uniform1f(u.uImageAspect, entry.aspect);
      gl.uniform1f(u.uReady, entry.ready);
      gl.uniform1f(u.uGray, card.gray);
      gl.uniform1f(u.uDim, card.dim);
      gl.uniform1f(u.uRing, card.slot === this.state.active ? this.state.ring * (1 - card.focus) : 0);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    });
  }

  placeLabels(metrics) {
    const s = this.settings;
    this.ensurePool(metrics.spacing);
    const used = new Set();
    const font = this.fontRef;
    const fade = value => {
      if (s.fadeEdges <= 0) return 1;
      const t = clamp(value / s.fadeEdges, 0, 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    };
    if (s.showTitles) {
      this.cards.forEach(card => {
        if (!card.item.text) return;
        const entry = this.pool[wrap(card.slot, this.pool.length)];
        used.add(entry);
        if (entry.slot !== card.slot || entry.text !== card.item.text) {
          entry.slot = card.slot;
          entry.text = card.item.text;
          entry.el.textContent = card.item.text;
        }
        if (entry.font !== font) {
          entry.font = font;
          entry.el.style.font = font;
        }
        const size = card.labelSize;
        const offset = card.h / 2 + size * 1.75;   /* 标签整体下移 */
        const x = card.x + Math.sin(card.angle) * offset;
        const y = card.y - Math.cos(card.angle) * offset;
        const cssX = this.view.width / 2 + x;
        const cssY = this.view.height / 2 - y;
        const edge = fade(cssX / this.view.width) * fade(1 - cssX / this.view.width);
        entry.el.style.fontSize = `${size}px`;
        entry.el.style.color = s.textColor;
        entry.el.style.transform =
          `translate(${cssX}px, ${cssY}px) translate(-50%, -50%) rotate(${-card.angle}rad)`;
        entry.el.style.opacity = String(card.alpha * card.labelAlpha * mix(edge, 1, card.focus));
      });
    }
    this.pool.forEach(entry => {
      if (used.has(entry)) return;
      if (entry.el.style.opacity !== '0') entry.el.style.opacity = '0';
    });
    const top =
      this.view.height / 2 - (metrics.openY - metrics.openH / 2) + metrics.titleSpace + 4;
    this.caption.style.transform = `translate(-50%, ${top}px)`;
    this.caption.style.opacity = String(ease(clamp((this.state.open - 0.5) / 0.5, 0, 1)));
    this.caption.style.color = s.textColor;
    if (this.caption.dataset.font !== font) {
      this.caption.dataset.font = font;
      this.caption.style.font = font;
      this.caption.style.fontWeight = '400';
    }
    this.caption.style.fontSize = `${this.captionSize() * 0.8}px`;
    const current = s.items[wrap(this.state.active, s.items.length)];
    const text = current?.description || '';
    if (this.caption.dataset.text !== text) {
      this.caption.dataset.text = text;
      this.caption.replaceChildren();
      if (text) {
        const p = document.createElement('p');
        p.className = CLASSES.captionText;
        p.textContent = text;
        this.caption.appendChild(p);
      }
    }
  }

  nearest() {
    return Math.round(this.state.target / Math.max(this.state.spacing, 1));
  }

  setSlot(slot, announce = true) {
    const s = this.settings;
    this.state.target = slot * this.state.spacing;
    if (slot !== this.state.active) {
      this.state.active = slot;
      const index = wrap(slot, s.items.length);
      this.active = index;
      if (announce) this.syncList();
      s.onActiveChange?.(index);
      this.settings.onStateChange?.(this.active, this.open);
    }
    this.wake();
  }

  openSlot(slot) {
    this.setSlot(slot);
    this.state.openTarget = 1;
    this.open = true;
    this.syncList();
    this.wake();
  }

  doClose() {
    this.state.openTarget = 0;
    this.open = false;
    this.syncList();
    this.wake();
  }

  frame(now) {
    this.raf = 0;
    if (!this.visible || document.hidden) return;
    const s = this.settings;
    const dt = this.last ? clamp((now - this.last) / 1000, 0.0005, 0.05) : 1 / 60;
    this.last = now;
    if (s.items !== this.lastItems) {
      this.lastItems = s.items;
      this.prune(s.items);
      s.items.forEach(item => this.textureFor(item.image));
    }
    const idle = now - this.state.lastInput > 1800;
    const auto =
      s.autoScroll && !this.reduce && !this.state.drag && this.state.open < 0.01 &&
      this.state.hovered === null && !this.state.keyboard && idle;
    if (auto) this.state.target += s.autoScroll * this.state.spacing * 0.25 * dt;
    const follow = this.reduce ? 1 : 1 - Math.pow(1 - s.scrollEase, dt * 60);
    const before = this.state.scroll;
    this.state.scroll += (this.state.target - this.state.scroll) * follow;
    if (Math.abs(this.state.target - this.state.scroll) < 0.05) this.state.scroll = this.state.target;
    const velocity = (this.state.scroll - before) / dt;
    this.state.velocity += (velocity - this.state.velocity) * (1 - Math.exp(-dt / 0.08));
    if (Math.abs(this.state.velocity) < 0.5) this.state.velocity = 0;
    this.state.waveTime += dt * 2.4;
    const openFollow = this.reduce ? 1 : 1 - Math.exp(-dt / 0.14);
    this.state.open += (this.state.openTarget - this.state.open) * openFollow;
    if (Math.abs(this.state.openTarget - this.state.open) < 0.001) this.state.open = this.state.openTarget;
    this.state.ring += ((this.state.keyboard ? 1 : 0) - this.state.ring) * (1 - Math.exp(-dt / 0.1));
    if (Math.abs((this.state.keyboard ? 1 : 0) - this.state.ring) < 0.002)
      this.state.ring = this.state.keyboard ? 1 : 0;
    if (this.state.intro < 1)
      this.state.intro = Math.min(1, this.state.intro + dt / INTRO_SECONDS);
    let settling = false;
    this.state.hover.forEach((value, slot) => {
      const goal = slot === this.state.hovered ? 1 : 0;
      const next = value + (goal - value) * (1 - Math.exp(-dt / 0.12));
      if (Math.abs(goal - next) < 0.002) {
        if (goal === 0) this.state.hover.delete(slot);
        else this.state.hover.set(slot, 1);
      } else {
        this.state.hover.set(slot, next);
        settling = true;
      }
    });
    if (this.state.openTarget > 0 && !this.state.focus.has(this.state.active))
      this.state.focus.set(this.state.active, 0);
    this.state.focus.forEach((value, slot) => {
      const goal = this.state.openTarget > 0 && slot === this.state.active ? 1 : 0;
      const next = this.reduce ? goal : value + (goal - value) * (1 - Math.exp(-dt / 0.16));
      if (Math.abs(goal - next) < 0.001) {
        if (goal === 0) this.state.focus.delete(slot);
        else this.state.focus.set(slot, 1);
      } else {
        this.state.focus.set(slot, next);
        settling = true;
      }
    });
    this.textures.forEach(entry => {
      if (!entry.loaded || entry.ready >= 1) return;
      entry.ready = this.reduce ? 1 : Math.min(1, entry.ready + dt / 0.45);
      settling = true;
    });
    const slot = auto
      ? Math.round(this.state.scroll / Math.max(this.state.spacing, 1))
      : this.nearest();
    if (slot !== this.state.active && !this.state.drag) {
      this.state.active = slot;
      const index = wrap(slot, s.items.length);
      this.active = index;
      this.syncList();
      s.onActiveChange?.(index);
    }
    const metrics = this.layout();
    this.draw(metrics);
    this.placeLabels(metrics);
    const moving =
      (s.autoScroll && !this.reduce) ||
      this.state.scroll !== this.state.target ||
      this.state.velocity !== 0 ||
      this.state.open !== this.state.openTarget ||
      this.state.intro < 1 ||
      (this.state.ring !== 0 && this.state.ring !== 1) ||
      settling;
    if (moving) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  }

  wake() {
    if (!this.raf && this.visible && !document.hidden)
      this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    const s = this.settings;
    this.view.width = Math.max(1, this.container.clientWidth);
    this.view.height = Math.max(1, this.container.clientHeight);
    this.view.ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(this.view.width * this.view.ratio));
    this.canvas.height = Math.max(1, Math.round(this.view.height * this.view.ratio));
    const before = this.state.spacing;
    const { spacing } = this.measure();
    if (before > 1 && spacing !== before) {
      this.state.scroll = (this.state.scroll / before) * spacing;
      this.state.target = (this.state.target / before) * spacing;
    }
    this.state.spacing = spacing;
    this.wake();
  }

  point(event) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: rect.height / 2 - (event.clientY - rect.top)
    };
  }

  hit({ x, y }) {
    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i];
      if (card.alpha < 0.05) continue;
      const dx = x - card.x;
      const dy = y - card.y;
      const c = Math.cos(-card.angle);
      const s = Math.sin(-card.angle);
      const lx = c * dx - s * dy;
      const ly = s * dx + c * dy;
      if (Math.abs(lx) <= card.w / 2 && Math.abs(ly) <= card.h / 2) return card;
    }
    return null;
  }

  setPointer(card) {
    const slot = card ? card.slot : null;
    if (slot !== this.state.hovered) {
      this.state.hovered = slot;
      if (slot !== null && !this.state.hover.has(slot)) this.state.hover.set(slot, 0);
      this.wake();
    }
    if (card) this.container.setAttribute('data-pointer', '');
    else this.container.removeAttribute('data-pointer');
  }

  snapNow() {
    const s = this.settings;
    if (!s.snap && this.state.open < 0.5) return;
    this.setSlot(this.nearest());
  }

  bindEvents() {
    const container = this.container;
    const onPointerDown = event => {
      if (event.button !== 0 || event.target.closest('[data-gallery-close]')) return;
      this.state.drag = {
        id: event.pointerId,
        x0: event.clientX,
        y0: event.clientY,
        start: this.state.target,
        moved: false,
        samples: [],
        p: this.point(event)
      };
      this.state.lastInput = performance.now();
      this.wake();
    };
    const onPointerMove = event => {
      const drag = this.state.drag;
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x0;
        const dy = event.clientY - drag.y0;
        if (!drag.moved && Math.hypot(dx, dy) > 6) {
          if (Math.abs(dy) > Math.abs(dx) && event.pointerType !== 'mouse') {
            this.state.drag = null;
            return;
          }
          drag.moved = true;
          container.setPointerCapture?.(event.pointerId);
          container.setAttribute('data-dragging', '');
          this.setPointer(null);
        }
        if (drag.moved) {
          this.state.target = drag.start - dx * (this.settings.scrollSpeed / 2);
          drag.samples.push({ x: event.clientX, t: performance.now() });
          if (drag.samples.length > 6) drag.samples.shift();
          this.state.lastInput = performance.now();
          this.wake();
        }
        return;
      }
      if (event.pointerType === 'mouse') this.setPointer(this.hit(this.point(event)));
    };
    const onPointerUp = event => {
      const drag = this.state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      this.state.drag = null;
      container.removeAttribute('data-dragging');
      if (container.hasPointerCapture?.(event.pointerId))
        container.releasePointerCapture(event.pointerId);
      if (drag.moved) {
        const samples = drag.samples;
        if (samples.length > 1) {
          const a = samples[0];
          const b = samples[samples.length - 1];
          const span = Math.max(b.t - a.t, 16);
          const speed = ((b.x - a.x) / span) * 1000;
          this.state.target -= speed * 0.18 * (this.settings.scrollSpeed / 2);
        }
        this.snapNow();
        return;
      }
      const card = this.hit(drag.p);
      const s = this.settings;
      if (!card) {
        if (this.state.open > 0.5) this.doClose();
        return;
      }
      s.onItemClick?.(card.item, card.index);
      if (!s.openOnClick) {
        this.setSlot(card.slot);
        return;
      }
      if (this.state.open > 0.5 && card.slot === this.state.active) this.doClose();
      else this.openSlot(card.slot);
    };
    const onPointerCancel = event => {
      if (this.state.drag && this.state.drag.id === event.pointerId) {
        this.state.drag = null;
        container.removeAttribute('data-dragging');
        this.snapNow();
      }
    };
    const onPointerLeave = () => this.setPointer(null);
    const onWheel = event => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.view.height : 1;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      this.state.target += delta * unit * (this.settings.scrollSpeed / 2);
      this.state.lastInput = performance.now();
      clearTimeout(this.snapTimer);
      this.snapTimer = setTimeout(() => this.snapNow(), 140);
      this.wake();
    };
    const onKeyDown = event => {
      const s = this.settings;
      const step = STEPS[event.key];
      this.state.lastInput = performance.now();
      if (step) {
        event.preventDefault();
        if (container.contains(document.activeElement) && document.activeElement !== container)
          this.state.keyboard = true;
        this.setSlot(this.nearest() + step);
        const index = wrap(this.state.active, s.items.length);
        if (container.contains(document.activeElement))
          this.buttons[index]?.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const base = this.nearest() - wrap(this.nearest(), s.items.length);
        this.setSlot(event.key === 'Home' ? base : base + s.items.length - 1);
        return;
      }
      if (event.key === 'Escape' && this.state.openTarget > 0) {
        event.preventDefault();
        this.doClose();
      }
    };
    const onFocusIn = event => {
      if (!event.target.closest('[data-gallery-list]')) return;
      this.state.keyboard = this.typing || event.target.matches(':focus-visible');
      this.wake();
    };
    const onFocusOut = event => {
      if (container.contains(event.relatedTarget)) return;
      this.state.keyboard = false;
      this.wake();
    };
    const onAnyKey = event => {
      if (event.key === 'Tab' || event.key.startsWith('Arrow')) this.typing = true;
    };
    const onAnyPointer = () => {
      this.typing = false;
    };
    const onVisibility = () => {
      this.last = 0;
      this.wake();
    };

    this.handlers = {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave,
      onWheel, onKeyDown, onFocusIn, onFocusOut, onAnyKey, onAnyPointer, onVisibility
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerCancel);
    container.addEventListener('pointerleave', onPointerLeave);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onAnyKey, true);
    document.addEventListener('pointerdown', onAnyPointer, true);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) {
        this.last = 0;
        this.wake();
      }
    });
    this.intersection.observe(container);
  }

  slotFor(index) {
    const count = this.settings.items.length;
    const slot = this.nearest();
    const base = slot - wrap(slot, count) + index;
    return [base - count, base, base + count].reduce((best, value) =>
      Math.abs(value - slot) < Math.abs(best - slot) ? value : best
    );
  }

  /* ---------- 外部 API ---------- */
  setOptions(patch) {
    Object.assign(this.settings, patch);
    if (patch.items) {
      this.state.scroll = Math.min(this.state.scroll, (patch.items.length - 1) * this.state.spacing);
      this.state.target = Math.min(this.state.target, (patch.items.length - 1) * this.state.spacing);
      this.buildList();
      this.syncList();
    }
    if (patch.textColor !== undefined) this.container.style.color = patch.textColor;
    this.wake();
  }

  focusIndex(index) {
    this.setSlot(this.slotFor(index), false);
  }
  openIndex(index) {
    this.openSlot(this.slotFor(index));
  }
  replayIntro() {
    this.state.intro = 0;
    this.wake();
  }
  async useFont(url) {
    this.fontRef = await resolveFont(this.settings.font, url);
    this.wake();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.snapTimer);
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    const h = this.handlers || {};
    this.container.removeEventListener('pointerdown', h.onPointerDown);
    this.container.removeEventListener('pointermove', h.onPointerMove);
    this.container.removeEventListener('pointerup', h.onPointerUp);
    this.container.removeEventListener('pointercancel', h.onPointerCancel);
    this.container.removeEventListener('pointerleave', h.onPointerLeave);
    this.container.removeEventListener('wheel', h.onWheel);
    this.container.removeEventListener('keydown', h.onKeyDown);
    this.container.removeEventListener('focusin', h.onFocusIn);
    this.container.removeEventListener('focusout', h.onFocusOut);
    document.removeEventListener('visibilitychange', h.onVisibility);
    document.removeEventListener('keydown', h.onAnyKey, true);
    document.removeEventListener('pointerdown', h.onAnyPointer, true);
    this.labelLayer.replaceChildren();
    this.textures.forEach(entry => entry.texture && this.gl.deleteTexture(entry.texture));
    this.gl.deleteTexture(this.blank);
    this.gl.deleteProgram(this.program.program);
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteBuffer(this.indexBuffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

  /* ---------- 对外接口 ---------- */
  CircularGallery.mount = function (target, options) {
    options = options || {};
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) {
      console.warn('[CircularGallery] 找不到容器：', target);
      return null;
    }
    const gallery = new CircularGallery(el, options);
    if (!gallery.gl) {
      el.classList.add('circular-gallery--no-webgl');
      el.innerHTML =
        '<div style="display:grid;place-items:center;height:100%;padding:24px;' +
        'text-align:center;font:14px/1.6 system-ui,sans-serif;opacity:.7">' +
        '当前浏览器不支持 WebGL2，环形画廊无法渲染。<br>' +
        '（无障碍列表仍然保留，可用 Tab 浏览）</div>';
    }
    return gallery;
  };

  global.CircularGallery = CircularGallery;
})(typeof window !== 'undefined' ? window : globalThis);
