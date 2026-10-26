/* ============================================================
 * 塔罗牌数据 —— 78 张
 * 全部 78 张已接入真实韦特牌面图（assets/cards/，
 * 1909 年 Rider-Waite 公有领域版，m00-m21 大牌 + w/c/s/p 四花色）。
 * ============================================================ */

const MAJOR_ARCANA = [
  { name: '愚者',     en: 'THE FOOL',            num: '0',    up: '新的开始 · 自由 · 冒险',       rev: '鲁莽 · 犹豫不决 · 冒失',   img: '' },
  { name: '魔术师',   en: 'THE MAGICIAN',        num: 'I',    up: '创造力 · 行动力 · 潜能',       rev: '欺骗 · 才华误用 · 意志薄弱', img: '' },
  { name: '女祭司',   en: 'THE HIGH PRIESTESS',  num: 'II',   up: '直觉 · 神秘 · 内在智慧',       rev: '沉默 · 秘密被隐藏 · 直觉闭塞', img: '' },
  { name: '女皇',     en: 'THE EMPRESS',         num: 'III',  up: '丰饶 · 滋养 · 感官之美',       rev: '停滞 · 依赖 · 过度放纵',   img: '' },
  { name: '皇帝',     en: 'THE EMPEROR',         num: 'IV',   up: '权威 · 秩序 · 掌控力',         rev: '专制 · 僵化 · 失去控制',   img: '' },
  { name: '教皇',     en: 'THE HIEROPHANT',      num: 'V',    up: '传统 · 信仰 · 精神指引',       rev: '叛逆 · 教条 · 打破常规',   img: '' },
  { name: '恋人',     en: 'THE LOVERS',          num: 'VI',   up: '结合 · 选择 · 心灵契合',       rev: '失衡 · 诱惑 · 错误的选择', img: '' },
  { name: '战车',     en: 'THE CHARIOT',         num: 'VII',  up: '胜利 · 前进 · 意志的胜利',     rev: '失控 · 方向迷失 · 挫败',   img: '' },
  { name: '力量',     en: 'STRENGTH',            num: 'VIII', up: '勇气 · 柔韧 · 以柔克刚',       rev: '自我怀疑 · 软弱 · 内耗',   img: '' },
  { name: '隐士',     en: 'THE HERMIT',          num: 'IX',   up: '内省 · 孤独 · 寻求真理',       rev: '封闭 · 孤立 · 拒绝联结',   img: '' },
  { name: '命运之轮', en: 'WHEEL OF FORTUNE',    num: 'X',    up: '转机 · 宿命 · 时来运转',       rev: '厄运 · 抗拒改变 · 时运不济', img: '' },
  { name: '正义',     en: 'JUSTICE',             num: 'XI',   up: '公正 · 因果 · 权衡抉择',       rev: '偏袒 · 逃避责任 · 不公',   img: '' },
  { name: '倒吊人',   en: 'THE HANGED MAN',      num: 'XII',  up: '臣服 · 换个视角 · 停滞中的智慧', rev: '无谓的牺牲 · 僵持 · 拖延', img: '' },
  { name: '死神',     en: 'DEATH',               num: 'XIII', up: '终结与新生 · 放下 · 蜕变',     rev: '抗拒结束 · 停滞 · 恐惧转变', img: '' },
  { name: '节制',     en: 'TEMPERANCE',          num: 'XIV',  up: '平衡 · 调和 · 耐心',           rev: '失衡 · 极端 · 缺乏耐心',   img: '' },
  { name: '恶魔',     en: 'THE DEVIL',           num: 'XV',   up: '欲望 · 束缚 · 直面阴影',       rev: '挣脱 · 觉醒 · 打破枷锁',   img: '' },
  { name: '高塔',     en: 'THE TOWER',           num: 'XVI',  up: '骤变 · 崩塌 · 打破幻象',       rev: '余震 · 逃避灾变 · 勉强维持', img: '' },
  { name: '星星',     en: 'THE STAR',            num: 'XVII', up: '希望 · 疗愈 · 灵感',           rev: '失望 · 信心动摇 · 远离理想', img: '' },
  { name: '月亮',     en: 'THE MOON',            num: 'XVIII',up: '幻象 · 潜意识 · 不安',         rev: '迷雾散去 · 真相浮现 · 释怀', img: '' },
  { name: '太阳',     en: 'THE SUN',             num: 'XIX',  up: '喜悦 · 成功 · 生命力',         rev: '阴霾 · 暂时受挫 · 过度乐观', img: '' },
  { name: '审判',     en: 'JUDGEMENT',           num: 'XX',   up: '觉醒 · 召唤 · 重生',           rev: '自我怀疑 · 逃避审视 · 停滞', img: '' },
  { name: '世界',     en: 'THE WORLD',           num: 'XXI',  up: '圆满 · 完成 · 整合',           rev: '未竟 · 缺口 · 拖延收尾',   img: '' },
];

const SUITS = [
  { cn: '权杖', en: 'WANDS',     elem: '火', kw: ['创造', '行动', '热情', '事业'], img: '' },
  { cn: '圣杯', en: 'CUPS',      elem: '水', kw: ['情感', '关系', '直觉', '心灵'], img: '' },
  { cn: '宝剑', en: 'SWORDS',    elem: '风', kw: ['思想', '冲突', '决断', '真相'], img: '' },
  { cn: '星币', en: 'PENTACLES', elem: '土', kw: ['物质', '金钱', '身体', '踏实'], img: '' },
];

const RANKS = [
  { cn: '王牌',   en: 'ACE',     up: '开端 · 潜能',      rev: '错失时机' },
  { cn: '二',     en: 'TWO',     up: '抉择 · 平衡',      rev: '摇摆不定' },
  { cn: '三',     en: 'THREE',   up: '成长 · 协作',      rev: '失衡 · 纠缠' },
  { cn: '四',     en: 'FOUR',    up: '稳定 · 停驻',      rev: '僵化 · 不安' },
  { cn: '五',     en: 'FIVE',    up: '变动 · 挑战',      rev: '走出低谷' },
  { cn: '六',     en: 'SIX',     up: '调和 · 援助',      rev: '滞留过去' },
  { cn: '七',     en: 'SEVEN',   up: '省思 · 坚持',      rev: '放弃 · 幻灭' },
  { cn: '八',     en: 'EIGHT',   up: '推进 · 掌握',      rev: '原地打转' },
  { cn: '九',     en: 'NINE',    up: '临近 · 持守',      rev: '戒备 · 疲惫' },
  { cn: '十',     en: 'TEN',     up: '圆满 · 终章',      rev: '过载 · 收尾不力' },
  { cn: '侍从',   en: 'PAGE',    up: '学习 · 讯息',      rev: '稚嫩 · 分心' },
  { cn: '骑士',   en: 'KNIGHT',  up: '追求 · 行进',      rev: '冒进 · 失序' },
  { cn: '王后',   en: 'QUEEN',   up: '滋养 · 掌握内在',  rev: '情绪化 · 失焦' },
  { cn: '国王',   en: 'KING',    up: '统御 · 成熟',      rev: '专断 · 失衡' },
];

/* 牌面图路径：大牌 m00-m21；小牌按花色前缀（权杖w 圣杯c 宝剑s 星币p）+ 牌阶 01-14 */
const SUIT_PREFIX = { '权杖': 'w', '圣杯': 'c', '宝剑': 's', '星币': 'p' };
const pad2 = (n) => String(n).padStart(2, '0');
const majorImg = (i) => 'assets/cards/m' + pad2(i) + '.jpg';
const minorImg = (suitCn, rankIdx) => 'assets/cards/' + SUIT_PREFIX[suitCn] + pad2(rankIdx + 1) + '.jpg';

const TAROT_DECK = (() => {
  const deck = [];
  MAJOR_ARCANA.forEach((c, i) => deck.push({ ...c, img: majorImg(i), arcana: 'major' }));
  for (const s of SUITS) {
    RANKS.forEach((r, ri) => {
      deck.push({
        name: s.cn + r.cn,
        en: r.en + ' OF ' + s.en,
        num: '',
        up: r.up + ' · ' + s.kw.join(' / '),
        rev: r.rev,
        img: minorImg(s.cn, ri),
        arcana: 'minor',
      });
    });
  }
  return deck;
})();
