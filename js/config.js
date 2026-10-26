/* ============================================================
 * 翠玉录 · 塔罗网站 —— 交互配置
 * 想改交互效果，改这个文件就够了，不用碰其他代码。
 * 改完保存，刷新浏览器即可生效。
 * ============================================================ */

const CONFIG = {

  /* ---------- 第一页：首页 ---------- */
  home: {
    // 卡牌柔光多边形的四个角点 —— 【注意：现在填的是照片原图里的像素坐标】
    //（assets/home.jpg 是 720×1280，坐标就按这张图量）
    // 顺序：左上 → 右上 → 右下 → 左下。
    // 页面会根据当前窗口大小自动换算成屏幕位置，
    // 所以不管浏览器窗口是手机比例还是宽屏比例，光都贴着牌走。
    // 微调技巧：在画图软件里打开 home.jpg，量牌四个角的像素坐标填进来即可。
    glowCorners: {
      tl: { x: 135, y: 1001 },
      tr: { x: 311, y: 996 },
      br: { x: 297, y: 1162 },
      bl: { x: 90,  y: 1162 },
    },
    // 微光呼吸动画速度（秒/次），越小闪得越快
    glowSpeed: 3,
    // 点击后跳转的过渡时长（毫秒）
    transitionMs: 900,
  },

  /* ---------- 第二页：抽牌页 ---------- */
  draw: {
    // 头像图片路径。换成你自己的图就改这里，例如 'assets/avatar.jpg'
    avatar: '',            // 留空 = 显示默认占位
    // 抽牌范围: 'all' = 78 张全抽, 'major' = 只抽 22 张大阿卡纳
    pool: 'all',
    // 是否允许抽到逆位（true = 正逆位都会出现）
    allowReversed: true,
    // 点击六芒星后，牌出现前的"凝聚"动画时长（毫秒）
    shuffleMs: 1600,
    // 结果牌出现后停留多久自动跳下一页（毫秒）。设为 0 = 不自动跳，等用户手动点
    resultStayMs: 3200,
    // 结果牌宽度 —— 想再小就把 26vw / 132px 改小，高度会自动跟着按比例走
    cardWidth: 'min(38vw, 200px)',
    // 出牌时背景的雾化玻璃强度
    frost: {
      blur: 18,     // 模糊半径（px），越大越糊
      sat: 0.78,    // 饱和度
      dim: 0.68,    // 亮度压暗，越小背景越沉
      veil: 0.14,   // 玻璃本身的灰底不透明度
      ms: 800,      // 玻璃盖上的过渡时长（毫秒）
    },
  },

  /* ---------- 第三页：翻牌页 ---------- */
  reveal: {
    // 背景玫瑰十字水印的不透明度（0~1，越小越淡）
    watermarkOpacity: 0.14,
    // 翻牌动画时长（毫秒）
    flipMs: 900,
    // 四张牌全部翻开后是否触发"封印点亮"效果
    sealLightUp: true,
    // 全部翻开后显示的结语文字（显示在底部，2.5 秒后淡出）
    allRevealedText: '⌈ 命运的答案，已在牌中 ⌋',
    // 底部三块罗马数字金属牌（从左到右）。
    // enabled: true 才能点；target 填要跳到的页面 id。
    // 想开通卷 II / 卷 III：把 enabled 改成 true，target 改成对应页面 id。
    gates: [
      { name: '月亮', en: 'The Moon',   enabled: true,  target: '#page-chapter1' },
      { name: '战车', en: 'The Chariot', enabled: true,  popup: true,
        popupText: ['自由是意味着', '要离开我吗'] },
      { name: '愚人', en: 'The Fool',   enabled: true,  popup: true,
        textOnOpen: true,   // true = 点牌直接弹出文字，不经过文件夹
        popupText: ['好想离你近一点', '不管是距离还是心'] },
    ],
    // 弹窗文字的间隔（毫秒）。设为 0 = 不逐字，整段文字一口气弹出。
    popupText: null,     // 兼容旧字段：现在每块牌的文案在 gates[].popupText 里
    popupCharMs: 0,
    // 翻到这些国王牌：翻面后停留 kingStayMs 毫秒，自动跳到对应页面。
    // 增删触发牌直接增删条目；name 留空数组 [] 则不触发任何牌。
    kings: [
      { name: '权杖国王', target: '#page-scroll' },
      { name: '宝剑国王', target: '#page-sword' },
      // 圣杯国王：翻面后进入金杯注酒场景（金壶倒酒→退场→蜜酒金杯+哥特黑框照片）
      {
        name: '圣杯国王',
        cup: true,
        cupDelayMs: 900,
        // 照片堆：右下角角标循环切换（想加照片就在数组里加一行 'assets/xxx.jpg'）
        cupPhotos: [
          'assets/cups-photo.jpg',
          'assets/wushan.jpg',
        ],
        // 照片堆下面、上传画布上面夹的一句话（\n 表示换行，老板可随意改）
        cupGapText: '捆绑在一起吧\n头发  命运  我和你',
        // 云端照片：老板的照片直接放进 assets 再把文件名填这里（上传入口已隐藏，走云端）
        cupCloudPhoto: '',
        // 底层上传口令（隐藏入口：连点黑框 5 次弹出），平时用不上
        uploadPasscode: '520',
        cupPhoto: 'assets/cups-photo.jpg',
        // 金杯注酒 AI 视频素材：二维动漫风、纯黑底 + screen 混合 = 抠好透明
        cupVideo: 'assets/cups-2d-black.mp4',   // 背景压成纯黑的版本，screen 混合下只留金杯
      },
      // 星币国王：翻面后弹出淡紫巴洛克画框弹窗，框内先星币洒落一地，再浮出文字
      {
        name: '星币国王',
        popup: true,
        popupDelayMs: 900,        // 翻面后到弹窗出现的间隔（毫秒）
        popupTitle: '须知',        // 弹窗标题：大字居中在顶部
        popupText: [
          '好讲话',
          '不是持续踩雷不会客诉',
          '平时话少不是讨厌你',
          '我是皇帝',
        ],
        // 弹窗底部的尾句：小字一横排
        popupFoot: '当你感到幸福的时候 我的人生终于开始有意义',
      },
    ],
    kingStayMs: 3000,
        // 星币国王弹窗里洒落的金币数量（想更密就调大）
        pentacleCoins: 38,
  },

  /* ---------- 第六页：宝剑卷 · 左右文字板 ---------- */
  sword: {
    // 左板：一个主题字（大字居中）
    leftText: '恶',
    // 右板：每一项一行（想加行就在数组里加一项）
    rightLines: ['高擦', '贬低', '不尊重', '把我丢下去和路人玩', '平菇发型', '脏话'],
    // 剑尖下方的两行誓词
    vowLines: ['佩戴小一号的戒圈', '在你身上刻下属于我的年轮。'],
  },

  /* ---------- 第五页：卷 I · 燃烧的羊皮纸 ---------- */
  scroll: {
    // 右侧横线上的内容：第一项是主题字（大），其余每项占一行写在横线上。
    // 想改字/加行直接改这个数组；横线总数仍由 lineCount 控制，多余的行留白。
    lines: ['喜', '高恋日常', '白话', '低无', '幽默感'],
    // 横线的行数（横线比字少留几行空白就够，别铺太满）
    lineCount: 7,
    // 每行出现的间隔（毫秒），页面进入时一行一行浮现
    lineStaggerMs: 150,
    // 右上角对话：who 'q'=问句（金色）、'a'=答句（纸墨色），进页时权杖先浮现、对话随后
    dialogue: [
      { who: 'q', text: '“权杖是什么？”' },
      { who: 'a', text: '“权力的把柄，像火一样燃烧。”' },
    ],
    // 点击权杖后，羊皮纸从左下烧到右上的时长（毫秒）
    burnMs: 2800,
    // 烧尽后跳转到哪一页：留空 '' = 不跳转，停在羊皮纸页（只能点左上角「← 牌阵」离开）
    nextTarget: '#page-reveal',
    // —— 燃烧粒子密度（每帧生成个数，越大火越旺，性能也更吃）——
    sparkRate: 2.4,      // 明亮火星：爆出来又落回去
    emberRate: 1.1,      // 余烬：小而暗、飘得远
    smokeRate: .55,      // 烟：缓慢上升扩散
    flakeRate: .16,      // 焦纸碎片：烧脱落、旋转飘落
    // 纸烧尽后，余烬继续飘多久才切下一页（毫秒）—— 转场的呼吸口
    emberFadeMs: 1100,
  },

  /* ---------- 第四页：卷 I（画廊页） ---------- */
  chapter: {
    // 画廊方框：src 填图片路径，span 选 'hero'(2×3头图) / 'big'(2×2) / 'wide'(2×1) / 'tall'(1×2)，
    // 不填 span 就是标准格。src 留空 = 空框，页面上显示一个"＋"占位。
    // 增删方框直接增删这一列表里的条目。
    gallery: [
      // 「月亮」画廊：目前全部留空，老板自定义。
      // 用法：src 填图片路径（如 'assets/xxx.jpg'）就会显示；span 决定格子大小
      //（'hero'=2×3头图 / 'big'=2×2 / 'wide'=2×1 / 'tall'=1×2，不填=标准格）。
      // fit 可选 'contain'（完整展现，bg 可垫底图）；不填 = 铺满裁切。
      // 雾山影醉砚海报：hero 头图格完整展现（contain），底下垫 ins 风紫纹理
      { src: 'assets/wushan-poster.jpg', span: 'hero', fit: 'contain', bg: 'assets/ins-purple.jpg' },
      { src: '', span: 'big' },
      { src: '' },
      { src: '' },
      { src: '', span: 'wide' },
      { src: '' },
      { src: '' },
      { src: '' },
      { src: '' },
      { src: '', span: 'wide' },
      { src: '' },
      { src: '' },
    ],
  },

  /* ---------- 全局：左下角音乐乌鸦 ---------- */
  music: {
    // 音乐文件路径：把下载好的 mp3 命名为 music.mp3 放进 assets/ 即自动生效
    // （文件不存在时静音，不报错）。想换别的歌，改这里的文件名即可。
    src: 'assets/music.mp3',
    volume: 0.4,
    // 自动播放：进入翻牌页（第二次转场）时自动开始响——那时用户已经点过
    // 卡牌，浏览器允许出声。false = 只能点左下角小鸟手动播。
    autoplay: true,
  },

};

/* 四张翻牌页的牌（点击后翻出的牌面）。
 * 想换成别的牌：改 name / img / upright。img 指向 assets 里的图。 */
const REVEAL_CARDS = [
  { name: '权杖国王', en: 'KING OF WANDS',    img: 'assets/king-wands.jpg',     upright: '正位' },
  { name: '宝剑国王', en: 'KING OF SWORDS',   img: 'assets/king-swords.jpg',    upright: '正位' },
  { name: '星币国王', en: 'KING OF PENTACLES', img: 'assets/king-pentacles.jpg', upright: '正位' },
  { name: '圣杯国王', en: 'KING OF CUPS',     img: 'assets/king-cups.jpg',      upright: '正位' },
];
