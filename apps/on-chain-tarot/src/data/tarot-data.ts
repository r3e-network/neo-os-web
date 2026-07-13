export interface TarotCardDefinition {
    id: number;
    name: string;
    icon: string;
    suit?: 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
    number?: number;
    arcana?: string;
    suitLabel?: string;
    keywords?: string[];
    image: string;
    backImage: string;
    /** Localized one-line essence, shown the instant a card flips. */
    essence?: string;
    /** Localized 1–2 sentence interpretation for the reading panel / share copy. */
    reading?: string;
}

/**
 * Per-card upright interpretation. The tarot *fantasy* is that the cards answer
 * the player's question — without this layer the game only renders pretty faces
 * and a name, which is a slot machine, not a reading. `essence` is the flip
 * moment payoff (≤10 chars CN / ≤3 words EN); `reading` is the synthesized
 * answer shown in the drawer and the copy/share text.
 */
export interface TarotCardMeaning {
    essence: string;
    reading: string;
}

export type TarotLocale = "en" | "zh";

export const TAROT_CARD_BACK = "./cards/back.webp";

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replaceAll("&", "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const SUIT_LABELS: Record<NonNullable<TarotCardDefinition["suit"]>, string> = {
    major: "Major Arcana",
    wands: "Wands",
    cups: "Cups",
    swords: "Swords",
    pentacles: "Pentacles",
};

const SUIT_KEYWORDS: Record<NonNullable<TarotCardDefinition["suit"]>, string> = {
    major: "Oracle",
    wands: "Will",
    cups: "Feeling",
    swords: "Mind",
    pentacles: "Matter",
};

const ZH_SUIT_LABELS: Record<NonNullable<TarotCardDefinition["suit"]>, string> = {
    major: "大阿卡纳",
    wands: "权杖",
    cups: "圣杯",
    swords: "宝剑",
    pentacles: "星币",
};

const ZH_SUIT_KEYWORDS: Record<NonNullable<TarotCardDefinition["suit"]>, string> = {
    major: "启示",
    wands: "意志",
    cups: "情感",
    swords: "思维",
    pentacles: "现实",
};

/**
 * Stable Simplified-Chinese names keyed by the immutable on-chain card id.
 *
 * The English names below remain the canonical asset slugs. Keeping localized
 * copy in a separate id-keyed table prevents a locale change from altering a
 * card image path or the card id emitted by the contract.
 */
const ZH_CARD_NAMES: Record<number, string> = {
    0: "愚者",
    1: "魔术师",
    2: "女祭司",
    3: "皇后",
    4: "皇帝",
    5: "教皇",
    6: "恋人",
    7: "战车",
    8: "力量",
    9: "隐者",
    10: "命运之轮",
    11: "正义",
    12: "倒吊人",
    13: "死神",
    14: "节制",
    15: "恶魔",
    16: "高塔",
    17: "星星",
    18: "月亮",
    19: "太阳",
    20: "审判",
    21: "世界",
    22: "权杖王牌",
    23: "权杖二",
    24: "权杖三",
    25: "权杖四",
    26: "权杖五",
    27: "权杖六",
    28: "权杖七",
    29: "权杖八",
    30: "权杖九",
    31: "权杖十",
    32: "权杖侍从",
    33: "权杖骑士",
    34: "权杖皇后",
    35: "权杖国王",
    36: "圣杯王牌",
    37: "圣杯二",
    38: "圣杯三",
    39: "圣杯四",
    40: "圣杯五",
    41: "圣杯六",
    42: "圣杯七",
    43: "圣杯八",
    44: "圣杯九",
    45: "圣杯十",
    46: "圣杯侍从",
    47: "圣杯骑士",
    48: "圣杯皇后",
    49: "圣杯国王",
    50: "宝剑王牌",
    51: "宝剑二",
    52: "宝剑三",
    53: "宝剑四",
    54: "宝剑五",
    55: "宝剑六",
    56: "宝剑七",
    57: "宝剑八",
    58: "宝剑九",
    59: "宝剑十",
    60: "宝剑侍从",
    61: "宝剑骑士",
    62: "宝剑皇后",
    63: "宝剑国王",
    64: "星币王牌",
    65: "星币二",
    66: "星币三",
    67: "星币四",
    68: "星币五",
    69: "星币六",
    70: "星币七",
    71: "星币八",
    72: "星币九",
    73: "星币十",
    74: "星币侍从",
    75: "星币骑士",
    76: "星币皇后",
    77: "星币国王",
};

const RAW_TAROT_DECK: Array<Omit<TarotCardDefinition, "image" | "backImage" | "arcana" | "suitLabel" | "keywords">> = [
    // Major Arcana
    { id: 0, name: "The Fool", icon: "M", suit: "major", number: 0 },
    { id: 1, name: "The Magician", icon: "M", suit: "major", number: 1 },
    { id: 2, name: "The High Priestess", icon: "M", suit: "major", number: 2 },
    { id: 3, name: "The Empress", icon: "M", suit: "major", number: 3 },
    { id: 4, name: "The Emperor", icon: "M", suit: "major", number: 4 },
    { id: 5, name: "The Hierophant", icon: "M", suit: "major", number: 5 },
    { id: 6, name: "The Lovers", icon: "M", suit: "major", number: 6 },
    { id: 7, name: "The Chariot", icon: "M", suit: "major", number: 7 },
    { id: 8, name: "Strength", icon: "M", suit: "major", number: 8 },
    { id: 9, name: "The Hermit", icon: "M", suit: "major", number: 9 },
    { id: 10, name: "Wheel of Fortune", icon: "M", suit: "major", number: 10 },
    { id: 11, name: "Justice", icon: "M", suit: "major", number: 11 },
    { id: 12, name: "The Hanged Man", icon: "M", suit: "major", number: 12 },
    { id: 13, name: "Death", icon: "M", suit: "major", number: 13 },
    { id: 14, name: "Temperance", icon: "M", suit: "major", number: 14 },
    { id: 15, name: "The Devil", icon: "M", suit: "major", number: 15 },
    { id: 16, name: "The Tower", icon: "M", suit: "major", number: 16 },
    { id: 17, name: "The Star", icon: "M", suit: "major", number: 17 },
    { id: 18, name: "The Moon", icon: "M", suit: "major", number: 18 },
    { id: 19, name: "The Sun", icon: "M", suit: "major", number: 19 },
    { id: 20, name: "Judgement", icon: "M", suit: "major", number: 20 },
    { id: 21, name: "The World", icon: "M", suit: "major", number: 21 },

    // Wands
    { id: 22, name: "Ace of Wands", icon: "W", suit: "wands", number: 1 },
    { id: 23, name: "Two of Wands", icon: "W", suit: "wands", number: 2 },
    { id: 24, name: "Three of Wands", icon: "W", suit: "wands", number: 3 },
    { id: 25, name: "Four of Wands", icon: "W", suit: "wands", number: 4 },
    { id: 26, name: "Five of Wands", icon: "W", suit: "wands", number: 5 },
    { id: 27, name: "Six of Wands", icon: "W", suit: "wands", number: 6 },
    { id: 28, name: "Seven of Wands", icon: "W", suit: "wands", number: 7 },
    { id: 29, name: "Eight of Wands", icon: "W", suit: "wands", number: 8 },
    { id: 30, name: "Nine of Wands", icon: "W", suit: "wands", number: 9 },
    { id: 31, name: "Ten of Wands", icon: "W", suit: "wands", number: 10 },
    { id: 32, name: "Page of Wands", icon: "W", suit: "wands", number: 11 },
    { id: 33, name: "Knight of Wands", icon: "W", suit: "wands", number: 12 },
    { id: 34, name: "Queen of Wands", icon: "W", suit: "wands", number: 13 },
    { id: 35, name: "King of Wands", icon: "W", suit: "wands", number: 14 },

    // Cups
    { id: 36, name: "Ace of Cups", icon: "C", suit: "cups", number: 1 },
    { id: 37, name: "Two of Cups", icon: "C", suit: "cups", number: 2 },
    { id: 38, name: "Three of Cups", icon: "C", suit: "cups", number: 3 },
    { id: 39, name: "Four of Cups", icon: "C", suit: "cups", number: 4 },
    { id: 40, name: "Five of Cups", icon: "C", suit: "cups", number: 5 },
    { id: 41, name: "Six of Cups", icon: "C", suit: "cups", number: 6 },
    { id: 42, name: "Seven of Cups", icon: "C", suit: "cups", number: 7 },
    { id: 43, name: "Eight of Cups", icon: "C", suit: "cups", number: 8 },
    { id: 44, name: "Nine of Cups", icon: "C", suit: "cups", number: 9 },
    { id: 45, name: "Ten of Cups", icon: "C", suit: "cups", number: 10 },
    { id: 46, name: "Page of Cups", icon: "C", suit: "cups", number: 11 },
    { id: 47, name: "Knight of Cups", icon: "C", suit: "cups", number: 12 },
    { id: 48, name: "Queen of Cups", icon: "C", suit: "cups", number: 13 },
    { id: 49, name: "King of Cups", icon: "C", suit: "cups", number: 14 },

    // Swords
    { id: 50, name: "Ace of Swords", icon: "S", suit: "swords", number: 1 },
    { id: 51, name: "Two of Swords", icon: "S", suit: "swords", number: 2 },
    { id: 52, name: "Three of Swords", icon: "S", suit: "swords", number: 3 },
    { id: 53, name: "Four of Swords", icon: "S", suit: "swords", number: 4 },
    { id: 54, name: "Five of Swords", icon: "S", suit: "swords", number: 5 },
    { id: 55, name: "Six of Swords", icon: "S", suit: "swords", number: 6 },
    { id: 56, name: "Seven of Swords", icon: "S", suit: "swords", number: 7 },
    { id: 57, name: "Eight of Swords", icon: "S", suit: "swords", number: 8 },
    { id: 58, name: "Nine of Swords", icon: "S", suit: "swords", number: 9 },
    { id: 59, name: "Ten of Swords", icon: "S", suit: "swords", number: 10 },
    { id: 60, name: "Page of Swords", icon: "S", suit: "swords", number: 11 },
    { id: 61, name: "Knight of Swords", icon: "S", suit: "swords", number: 12 },
    { id: 62, name: "Queen of Swords", icon: "S", suit: "swords", number: 13 },
    { id: 63, name: "King of Swords", icon: "S", suit: "swords", number: 14 },

    // Pentacles
    { id: 64, name: "Ace of Pentacles", icon: "P", suit: "pentacles", number: 1 },
    { id: 65, name: "Two of Pentacles", icon: "P", suit: "pentacles", number: 2 },
    { id: 66, name: "Three of Pentacles", icon: "P", suit: "pentacles", number: 3 },
    { id: 67, name: "Four of Pentacles", icon: "P", suit: "pentacles", number: 4 },
    { id: 68, name: "Five of Pentacles", icon: "P", suit: "pentacles", number: 5 },
    { id: 69, name: "Six of Pentacles", icon: "P", suit: "pentacles", number: 6 },
    { id: 70, name: "Seven of Pentacles", icon: "P", suit: "pentacles", number: 7 },
    { id: 71, name: "Eight of Pentacles", icon: "P", suit: "pentacles", number: 8 },
    { id: 72, name: "Nine of Pentacles", icon: "P", suit: "pentacles", number: 9 },
    { id: 73, name: "Ten of Pentacles", icon: "P", suit: "pentacles", number: 10 },
    { id: 74, name: "Page of Pentacles", icon: "P", suit: "pentacles", number: 11 },
    { id: 75, name: "Knight of Pentacles", icon: "P", suit: "pentacles", number: 12 },
    { id: 76, name: "Queen of Pentacles", icon: "P", suit: "pentacles", number: 13 },
    { id: 77, name: "King of Pentacles", icon: "P", suit: "pentacles", number: 14 },
];

// ============================================================================
// Card meanings (the "解答" layer)
// ============================================================================
// Keyed by the immutable on-chain card id. Authored from standard Rider-Waite
// upright readings, player-facing and self-reflective in tone. The flip moment
// gets `essence`; the drawer / share copy gets `reading`.

const CARD_MEANINGS_ZH: Record<number, TarotCardMeaning> = {
    // Major Arcana
    0: { essence: "新的起点", reading: "愚者邀你放下计划，信任未知的第一步——旅程本身就带着答案。" },
    1: { essence: "意志显化", reading: "你已握有所需的一切工具，专注地把意图变成现实。" },
    2: { essence: "内在直觉", reading: "答案不在喧哗里，而在你静下来的那一刻浮现。" },
    3: { essence: "丰盛滋养", reading: "允许自己被照顾与创造，丰盛正从你手中生长。" },
    4: { essence: "秩序掌控", reading: "用清晰的结构与边界稳稳接住局面，掌控来自秩序。" },
    5: { essence: "传统传承", reading: "向可靠的指引与传统求教，会给你稳固的根。" },
    6: { essence: "真心选择", reading: "这不是二选一，而是看清什么真正与你契合。" },
    7: { essence: "坚定前行", reading: "方向已定，靠自律与专注把两股力量拉向同一目标。" },
    8: { essence: "温柔勇气", reading: "真正的力量是耐心与温柔，驯服冲动而非压服它。" },
    9: { essence: "独处自省", reading: "退一步，提灯自照，答案在你自己的光里。" },
    10: { essence: "顺势轮转", reading: "命运正在转动，顺势而为比逆势挣扎更省力。" },
    11: { essence: "因果平衡", reading: "过往的因正在结成果，诚实面对自会得到公正。" },
    12: { essence: "换个视角", reading: "暂停并倒过来看，卡住处会浮现意外的领悟。" },
    13: { essence: "结束新生", reading: "一段必须落幕，空出的位置才能迎来新生。" },
    14: { essence: "调和平衡", reading: "不偏不倚地调和，耐心把对立融成恰到好处。" },
    15: { essence: "执念束缚", reading: "看清是什么让你自愿戴上锁链，松开手便能走。" },
    16: { essence: "剧变真相", reading: "旧结构被撼动，裂开处反而是真相照进来的地方。" },
    17: { essence: "希望疗愈", reading: "风暴之后，星星还在，给自己一点温柔的相信。" },
    18: { essence: "迷雾直觉", reading: "前路有雾，别急着下结论，让直觉替你看清暗处。" },
    19: { essence: "明朗喜悦", reading: "阳光铺开，事情比想象中明亮，放心去享受。" },
    20: { essence: "觉醒召唤", reading: "听见内在的召唤，为过往释怀，做出清醒的选择。" },
    21: { essence: "圆满完成", reading: "一个循环走到圆满，带着所学从容步入下一段。" },
    // Wands
    22: { essence: "灵感火花", reading: "一团火被点燃，立刻行动，别让灵感冷却。" },
    23: { essence: "远望规划", reading: "站在已有之上眺望远方，是时候把计划铺开。" },
    24: { essence: "拓展出海", reading: "根基已稳，把目光投向更远的合作与机会。" },
    25: { essence: "庆祝安定", reading: "一段努力有了着落，停下来与同路人共享。" },
    26: { essence: "竞争磨合", reading: "众人各执一词，混乱里藏着厘清方向的机会。" },
    27: { essence: "胜利认可", reading: "你的付出被看见，带着谦逊接下这份喝彩。" },
    28: { essence: "守住阵地", reading: "风向对你不利，但站位还在，咬住别退。" },
    29: { essence: "消息疾驰", reading: "事情突然加速，信息与人流齐至，顺势推进。" },
    30: { essence: "韧性坚持", reading: "已伤痕累累却仍站着，最后一程靠的是不松手。" },
    31: { essence: "负重过载", reading: "你扛得太多，分一些出去，轻装才能走远。" },
    32: { essence: "好奇探索", reading: "一个跃跃欲试的念头，允许自己先玩起来。" },
    33: { essence: "热情冲锋", reading: "热血上头就出发，速度带来突破，也别忘看路。" },
    34: { essence: "自信光芒", reading: "做自己最自在，你的热情自然吸引同频的人。" },
    35: { essence: "远见领导", reading: "以清晰愿景领路，敢想也敢担，团队随之而行。" },
    // Cups
    36: { essence: "情感涌流", reading: "一颗心重新打开，爱或感动正要流进来。" },
    37: { essence: "双向吸引", reading: "平等的相遇，彼此映照，关系在此刻成形。" },
    38: { essence: "欢聚同庆", reading: "与合拍的人举杯，喜悦在联结里被放大。" },
    39: { essence: "倦怠内收", reading: "眼前皆有却提不起劲，先接纳空虚再看清所求。" },
    40: { essence: "遗憾失落", reading: "盯着打翻的杯，别忘了身后还立着满的。" },
    41: { essence: "温暖回忆", reading: "旧时光回甜，从熟悉的源头找回安心。" },
    42: { essence: "幻象迷梦", reading: "选项很多却多是泡影，分清哪个真实可得。" },
    43: { essence: "转身离开", reading: "明知该走，纵有不舍也迈步，为更真的自己。" },
    44: { essence: "心愿得偿", reading: "所求将近在手，安心享受这份知足。" },
    45: { essence: "圆满和睦", reading: "长久的安稳与爱在望，家和心安皆可得。" },
    46: { essence: "柔情讯息", reading: "一个柔软的讯号，用孩子般的好奇接住它。" },
    47: { essence: "浪漫追寻", reading: "带着真心而来的人或事，值得你温柔回应。" },
    48: { essence: "共情包容", reading: "以同理心承接情绪，先安己心再渡人。" },
    49: { essence: "沉稳情智", reading: "在风浪里仍稳住情绪，用理解而非反应处世。" },
    // Swords
    50: { essence: "清明破局", reading: "一道利刃切开迷雾，真相与决断同时到来。" },
    51: { essence: "两难僵持", reading: "蒙眼也要选，先摘下遮蔽，答案不在逃避里。" },
    52: { essence: "心碎疗伤", reading: "痛是真实的，但裂开处也是愈合开始的地方。" },
    53: { essence: "休整蓄力", reading: "打得太久，暂歇不是退，是为下一剑蓄力。" },
    54: { essence: "险胜代价", reading: "赢了争论却失了人，问自己这胜是否值得。" },
    55: { essence: "渡向平稳", reading: "带着伤划向平静水域，离开是为了好起来。" },
    56: { essence: "巧取规避", reading: "正面硬刚不划算，用巧思绕开，但别骗自己。" },
    57: { essence: "自我设限", reading: "锁你的多是自己的念头，看得见路就迈出。" },
    58: { essence: "焦虑黑夜", reading: "夜里的担忧被放大，天亮再看多半没那么糟。" },
    59: { essence: "谷底终结", reading: "最坏已落地，再也无处可跌，反转由此开始。" },
    60: { essence: "求知警觉", reading: "一个想弄清的疑问，带着警觉去探查真相。" },
    61: { essence: "疾言猛进", reading: "想清楚就冲，速度能破局，也别撞了人。" },
    62: { essence: "清醒边界", reading: "用理性护住自己，温柔但分明，不陷纠缠。" },
    63: { essence: "公正研判", reading: "以事实与逻辑裁断，不被情绪带偏。" },
    // Pentacles
    64: { essence: "实质开端", reading: "一个可落地的机会在手中，先稳稳接住它。" },
    65: { essence: "灵动平衡", reading: "多线并行，保持弹性比死守计划更稳。" },
    66: { essence: "协作精进", reading: "与对的人各展所长，手艺在配合里变好。" },
    67: { essence: "紧握守成", reading: "想守住所得没错，但别让紧抓变成僵固。" },
    68: { essence: "匮乏求助", reading: "看似落单又紧缺，其实援手就在不远处。" },
    69: { essence: "施受有度", reading: "量力给予也坦然接受，流动比囤积更有力。" },
    70: { essence: "耐心耕耘", reading: "种下已久，成果未显，信任节奏，莫急于拔苗。" },
    71: { essence: "匠艺打磨", reading: "一遍遍打磨手里的活，熟练与品质由此而来。" },
    72: { essence: "独立丰足", reading: "凭自己的积累安享成果，独处也从容富足。" },
    73: { essence: "长久基业", reading: "积累成家业与传承，安稳的根可荫后人。" },
    74: { essence: "踏实学习", reading: "一个想落地的念头，从最基础的步骤认真学起。" },
    75: { essence: "稳健前行", reading: "不快但稳，一步一个脚印把事做成。" },
    76: { essence: "务实养育", reading: "把资源与关系都照顾得当，丰盛自然生长。" },
    77: { essence: "雄厚掌舵", reading: "以稳健与远见掌管实务，成果可靠而持久。" },
};

const CARD_MEANINGS_EN: Record<number, TarotCardMeaning> = {
    // Major Arcana
    0: { essence: "New beginnings", reading: "The Fool invites you to release the plan and trust the first step into the unknown — the journey holds the answer." },
    1: { essence: "Manifestation", reading: "You already hold every tool you need; focus and turn intention into reality." },
    2: { essence: "Intuition", reading: "The answer is not in the noise; it surfaces in the moment you grow still." },
    3: { essence: "Abundance", reading: "Let yourself be nurtured and creative; abundance is growing through your hands." },
    4: { essence: "Structure", reading: "Hold the situation with clear structure and boundaries; control comes from order." },
    5: { essence: "Tradition", reading: "Seek guidance from trusted tradition; it gives you a steady root." },
    6: { essence: "Aligned choice", reading: "This is not either/or, but seeing what truly aligns with you." },
    7: { essence: "Driven will", reading: "The direction is set; discipline and focus pull two forces toward one aim." },
    8: { essence: "Inner strength", reading: "True strength is patience and gentleness — taming impulse, not crushing it." },
    9: { essence: "Soul-searching", reading: "Step back, lantern in hand; the answer lives in your own light." },
    10: { essence: "Turning point", reading: "Fortune is turning; flow with it rather than fighting the spin." },
    11: { essence: "Fairness", reading: "Past causes are bearing fruit; meet them honestly and fairness follows." },
    12: { essence: "New perspective", reading: "Pause and turn it upside down; the stuck place yields a sudden insight." },
    13: { essence: "Ending & rebirth", reading: "Something must end so the space can welcome what is new." },
    14: { essence: "Balance", reading: "Blend with patience; moderation fuses opposites into just right." },
    15: { essence: "Bondage", reading: "See what makes you wear the chains willingly; loosen your grip and walk." },
    16: { essence: "Sudden upheaval", reading: "The old structure shakes; the crack is where truth breaks through." },
    17: { essence: "Hope", reading: "After the storm the star remains; offer yourself a gentle faith." },
    18: { essence: "Illusion", reading: "There is fog ahead; don't rush to judge — let intuition read the dark." },
    19: { essence: "Joy", reading: "Sunlight spreads; things are brighter than feared — enjoy it." },
    20: { essence: "Awakening", reading: "Hear the inner call; release the past and choose with clarity." },
    21: { essence: "Wholeness", reading: "A cycle completes; carry the lesson and step into what is next." },
    // Wands
    22: { essence: "Spark", reading: "A fire is lit — act now before the spark cools." },
    23: { essence: "Planning", reading: "From what you have, look further; it is time to lay out the plan." },
    24: { essence: "Expansion", reading: "Roots are set; look to farther partnerships and chances." },
    25: { essence: "Celebration", reading: "Effort has landed; pause and share it with your people." },
    26: { essence: "Conflict", reading: "Many voices clash; within the noise is a chance to find direction." },
    27: { essence: "Recognition", reading: "Your effort is seen; accept the applause with humility." },
    28: { essence: "Defending", reading: "The wind is against you, but your ground holds — don't yield." },
    29: { essence: "Swift motion", reading: "Things speed up suddenly; news and momentum arrive — ride it." },
    30: { essence: "Resilience", reading: "Bruised yet standing, the last stretch asks only that you hold on." },
    31: { essence: "Burden", reading: "You carry too much; share the load or you won't go far." },
    32: { essence: "Exploration", reading: "A restless idea — let yourself play with it first." },
    33: { essence: "Bold action", reading: "Charged with passion, you ride — speed breaks through, but watch the road." },
    34: { essence: "Warm confidence", reading: "Be unapologetically you; your warmth draws the right crowd." },
    35: { essence: "Visionary lead", reading: "Lead with a clear vision; dare to dream and own it, others follow." },
    // Cups
    36: { essence: "Open heart", reading: "A heart reopens; love or feeling is about to flow in." },
    37: { essence: "Union", reading: "An equal meeting, two mirrors — the bond forms now." },
    38: { essence: "Friendship", reading: "Raise a cup with kindred souls; joy multiplies in connection." },
    39: { essence: "Apathy", reading: "Much is offered yet you're flat; sit with the emptiness, then see what you want." },
    40: { essence: "Disappointment", reading: "Eyes on the spilled cups — yet full ones stand behind you." },
    41: { essence: "Nostalgia", reading: "The past turns sweet; find comfort in a familiar source." },
    42: { essence: "Temptation", reading: "Many options, mostly mirages; tell which one is real." },
    43: { essence: "Walking away", reading: "You know it's time; leave despite the ache, for a truer self." },
    44: { essence: "Contentment", reading: "What you wished for is near; rest in this contentment." },
    45: { essence: "Harmony", reading: "Lasting peace and love are in view; home and heart aligned." },
    46: { essence: "Tender news", reading: "A soft signal arrives; receive it with childlike wonder." },
    47: { essence: "Romantic offer", reading: "One who comes with heart — worth your tender reply." },
    48: { essence: "Emotional depth", reading: "Hold feelings with empathy; steady your own heart before others'." },
    49: { essence: "Emotional mastery", reading: "Calm amid the waves; respond with understanding, not reaction." },
    // Swords
    50: { essence: "Clarity", reading: "A blade cuts the fog; truth and decision arrive together." },
    51: { essence: "Indecision", reading: "Even blinded you must choose; lift the cover, the answer isn't in avoidance." },
    52: { essence: "Heartache", reading: "The pain is real, yet the break is where healing begins." },
    53: { essence: "Rest", reading: "Long in the fight — rest is not retreat, it reloads the next strike." },
    54: { essence: "Hollow win", reading: "You won the fight but lost the room — ask if the win was worth it." },
    55: { essence: "Transition", reading: "Carry the wound toward calm water; leaving is how you heal." },
    56: { essence: "Strategy", reading: "A straight fight won't pay; maneuver around it — but don't fool yourself." },
    57: { essence: "Self-bound", reading: "What binds you is mostly your own thought; the path is visible — step." },
    58: { essence: "Anxiety", reading: "Night magnifies worry; by daylight it's seldom as bad." },
    59: { essence: "Rock bottom", reading: "The worst has landed; with nowhere lower to fall, the turn begins." },
    60: { essence: "Curiosity", reading: "A question to untangle; probe for truth with alert eyes." },
    61: { essence: "Swift truth", reading: "Once clear, charge; speed breaks the deadlock — mind who you hit." },
    62: { essence: "Clear boundaries", reading: "Protect yourself with reason; kind yet clear, no entanglement." },
    63: { essence: "Objective mind", reading: "Judge by fact and logic; don't let feeling skew the call." },
    // Pentacles
    64: { essence: "New resource", reading: "A tangible opportunity is in hand — hold it steady first." },
    65: { essence: "Juggling", reading: "Many balls in the air; stay flexible, not rigid." },
    66: { essence: "Teamwork", reading: "With the right others, each lends strength; craft improves in team." },
    67: { essence: "Holding on", reading: "Guarding what's yours is fine — just don't let grip become rigidity." },
    68: { essence: "Hardship", reading: "You seem alone and short — yet help is closer than it looks." },
    69: { essence: "Generosity", reading: "Give what you can and receive with grace; flow beats hoarding." },
    70: { essence: "Patience", reading: "Sown long ago, not yet ripe; trust the pace, don't pull it early." },
    71: { essence: "Craft", reading: "Refine the work again and again; mastery and quality follow." },
    72: { essence: "Self-sufficiency", reading: "Enjoy the fruit of your own work; alone yet at ease and full." },
    73: { essence: "Legacy", reading: "Effort becomes legacy; a steady root that shelters those after you." },
    74: { essence: "Study", reading: "An idea to ground; learn it from the most basic step, earnestly." },
    75: { essence: "Steady progress", reading: "Not fast but sure; one steady step at a time gets it done." },
    76: { essence: "Nurturing wealth", reading: "Tend resources and people well; abundance grows on its own." },
    77: { essence: "Material mastery", reading: "Steward the practical with steadiness and foresight; results last." },
};

/** Resolve the upright meaning for a card id in the requested locale. */
export function getCardMeaning(id: number, locale: TarotLocale): TarotCardMeaning | undefined {
    const table = locale === "zh" ? CARD_MEANINGS_ZH : CARD_MEANINGS_EN;
    return table[id];
}

export const TAROT_DECK: TarotCardDefinition[] = RAW_TAROT_DECK.map((card) => {
    const suit = card.suit ?? "major";
    const arcana = suit === "major" ? "Major Arcana" : "Minor Arcana";

    return {
        ...card,
        arcana,
        suitLabel: SUIT_LABELS[suit],
        keywords: [SUIT_KEYWORDS[suit], arcana],
        image: `./cards/${String(card.id).padStart(2, "0")}-${slugify(card.name)}.webp`,
        backImage: TAROT_CARD_BACK,
    };
});

const TAROT_DECK_BY_ID = new Map(TAROT_DECK.map((card) => [card.id, card] as const));

/** Resolve an app locale marker without comparing any translated UI copy. */
export function normalizeTarotLocale(localeCode: string): TarotLocale {
    const normalized = localeCode.trim().toLowerCase().replaceAll("_", "-");
    return normalized === "zh" || normalized.startsWith("zh-") ? "zh" : "en";
}

/**
 * Localize a card for presentation while preserving its immutable id and
 * canonical image paths. Looking the canonical card up by id also makes locale
 * switching reversible: an already-Chinese card can always be rendered in
 * English again without comparing translated names.
 */
export function localizeTarotCard<T extends TarotCardDefinition>(
    card: T,
    localeCode: string,
): T {
    const locale = normalizeTarotLocale(localeCode);
    const canonical = TAROT_DECK_BY_ID.get(card.id);
    const suit = canonical?.suit ?? card.suit ?? "major";
    const arcana = suit === "major" ? "Major Arcana" : "Minor Arcana";
    const meaning = getCardMeaning(card.id, locale);

    if (locale === "zh") {
        return {
            ...card,
            name: ZH_CARD_NAMES[card.id] ?? canonical?.name ?? card.name,
            arcana: suit === "major" ? "大阿卡纳" : "小阿卡纳",
            suitLabel: ZH_SUIT_LABELS[suit],
            keywords: [ZH_SUIT_KEYWORDS[suit], suit === "major" ? "大阿卡纳" : "小阿卡纳"],
            essence: meaning?.essence,
            reading: meaning?.reading,
        } as T;
    }

    return {
        ...card,
        name: canonical?.name ?? card.name,
        arcana,
        suitLabel: SUIT_LABELS[suit],
        keywords: [SUIT_KEYWORDS[suit], arcana],
        essence: meaning?.essence,
        reading: meaning?.reading,
    } as T;
}
