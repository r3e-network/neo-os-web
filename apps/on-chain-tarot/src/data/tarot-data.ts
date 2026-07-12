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

    if (locale === "zh") {
        return {
            ...card,
            name: ZH_CARD_NAMES[card.id] ?? canonical?.name ?? card.name,
            arcana: suit === "major" ? "大阿卡纳" : "小阿卡纳",
            suitLabel: ZH_SUIT_LABELS[suit],
            keywords: [ZH_SUIT_KEYWORDS[suit], suit === "major" ? "大阿卡纳" : "小阿卡纳"],
        } as T;
    }

    return {
        ...card,
        name: canonical?.name ?? card.name,
        arcana,
        suitLabel: SUIT_LABELS[suit],
        keywords: [SUIT_KEYWORDS[suit], arcana],
    } as T;
}
