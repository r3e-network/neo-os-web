export interface TarotCardDefinition {
    id: number;
    name: string;
    icon: string;
    suit?: 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';
    number?: number;
    arcana?: 'Major Arcana' | 'Minor Arcana';
    suitLabel?: string;
    keywords?: string[];
    image: string;
    backImage: string;
}

export const TAROT_CARD_BACK = "./cards/back.svg";

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

const RAW_TAROT_DECK: Array<Omit<TarotCardDefinition, "image" | "backImage" | "arcana" | "suitLabel" | "keywords">> = [
    // Major Arcana
    { id: 0, name: "The Fool", icon: "🃏", suit: "major", number: 0 },
    { id: 1, name: "The Magician", icon: "🎩", suit: "major", number: 1 },
    { id: 2, name: "The High Priestess", icon: "🔮", suit: "major", number: 2 },
    { id: 3, name: "The Empress", icon: "👑", suit: "major", number: 3 },
    { id: 4, name: "The Emperor", icon: "⚔️", suit: "major", number: 4 },
    { id: 5, name: "The Hierophant", icon: "📜", suit: "major", number: 5 },
    { id: 6, name: "The Lovers", icon: "💕", suit: "major", number: 6 },
    { id: 7, name: "The Chariot", icon: "🏇", suit: "major", number: 7 },
    { id: 8, name: "Strength", icon: "🦁", suit: "major", number: 8 },
    { id: 9, name: "The Hermit", icon: "🕯️", suit: "major", number: 9 },
    { id: 10, name: "Wheel of Fortune", icon: "☸️", suit: "major", number: 10 },
    { id: 11, name: "Justice", icon: "⚖️", suit: "major", number: 11 },
    { id: 12, name: "The Hanged Man", icon: "🙃", suit: "major", number: 12 },
    { id: 13, name: "Death", icon: "💀", suit: "major", number: 13 },
    { id: 14, name: "Temperance", icon: "🍷", suit: "major", number: 14 },
    { id: 15, name: "The Devil", icon: "😈", suit: "major", number: 15 },
    { id: 16, name: "The Tower", icon: "🗼", suit: "major", number: 16 },
    { id: 17, name: "The Star", icon: "⭐", suit: "major", number: 17 },
    { id: 18, name: "The Moon", icon: "🌙", suit: "major", number: 18 },
    { id: 19, name: "The Sun", icon: "☀️", suit: "major", number: 19 },
    { id: 20, name: "Judgement", icon: "📯", suit: "major", number: 20 },
    { id: 21, name: "The World", icon: "🌍", suit: "major", number: 21 },

    // Wands
    { id: 22, name: "Ace of Wands", icon: "🔥", suit: "wands", number: 1 },
    { id: 23, name: "Two of Wands", icon: "🔥", suit: "wands", number: 2 },
    { id: 24, name: "Three of Wands", icon: "🔥", suit: "wands", number: 3 },
    { id: 25, name: "Four of Wands", icon: "🔥", suit: "wands", number: 4 },
    { id: 26, name: "Five of Wands", icon: "🔥", suit: "wands", number: 5 },
    { id: 27, name: "Six of Wands", icon: "🔥", suit: "wands", number: 6 },
    { id: 28, name: "Seven of Wands", icon: "🔥", suit: "wands", number: 7 },
    { id: 29, name: "Eight of Wands", icon: "🔥", suit: "wands", number: 8 },
    { id: 30, name: "Nine of Wands", icon: "🔥", suit: "wands", number: 9 },
    { id: 31, name: "Ten of Wands", icon: "🔥", suit: "wands", number: 10 },
    { id: 32, name: "Page of Wands", icon: "🔥", suit: "wands", number: 11 },
    { id: 33, name: "Knight of Wands", icon: "🔥", suit: "wands", number: 12 },
    { id: 34, name: "Queen of Wands", icon: "🔥", suit: "wands", number: 13 },
    { id: 35, name: "King of Wands", icon: "🔥", suit: "wands", number: 14 },

    // Cups
    { id: 36, name: "Ace of Cups", icon: "💧", suit: "cups", number: 1 },
    { id: 37, name: "Two of Cups", icon: "💧", suit: "cups", number: 2 },
    { id: 38, name: "Three of Cups", icon: "💧", suit: "cups", number: 3 },
    { id: 39, name: "Four of Cups", icon: "💧", suit: "cups", number: 4 },
    { id: 40, name: "Five of Cups", icon: "💧", suit: "cups", number: 5 },
    { id: 41, name: "Six of Cups", icon: "💧", suit: "cups", number: 6 },
    { id: 42, name: "Seven of Cups", icon: "💧", suit: "cups", number: 7 },
    { id: 43, name: "Eight of Cups", icon: "💧", suit: "cups", number: 8 },
    { id: 44, name: "Nine of Cups", icon: "💧", suit: "cups", number: 9 },
    { id: 45, name: "Ten of Cups", icon: "💧", suit: "cups", number: 10 },
    { id: 46, name: "Page of Cups", icon: "💧", suit: "cups", number: 11 },
    { id: 47, name: "Knight of Cups", icon: "💧", suit: "cups", number: 12 },
    { id: 48, name: "Queen of Cups", icon: "💧", suit: "cups", number: 13 },
    { id: 49, name: "King of Cups", icon: "💧", suit: "cups", number: 14 },

    // Swords
    { id: 50, name: "Ace of Swords", icon: "⚔️", suit: "swords", number: 1 },
    { id: 51, name: "Two of Swords", icon: "⚔️", suit: "swords", number: 2 },
    { id: 52, name: "Three of Swords", icon: "⚔️", suit: "swords", number: 3 },
    { id: 53, name: "Four of Swords", icon: "⚔️", suit: "swords", number: 4 },
    { id: 54, name: "Five of Swords", icon: "⚔️", suit: "swords", number: 5 },
    { id: 55, name: "Six of Swords", icon: "⚔️", suit: "swords", number: 6 },
    { id: 56, name: "Seven of Swords", icon: "⚔️", suit: "swords", number: 7 },
    { id: 57, name: "Eight of Swords", icon: "⚔️", suit: "swords", number: 8 },
    { id: 58, name: "Nine of Swords", icon: "⚔️", suit: "swords", number: 9 },
    { id: 59, name: "Ten of Swords", icon: "⚔️", suit: "swords", number: 10 },
    { id: 60, name: "Page of Swords", icon: "⚔️", suit: "swords", number: 11 },
    { id: 61, name: "Knight of Swords", icon: "⚔️", suit: "swords", number: 12 },
    { id: 62, name: "Queen of Swords", icon: "⚔️", suit: "swords", number: 13 },
    { id: 63, name: "King of Swords", icon: "⚔️", suit: "swords", number: 14 },

    // Pentacles
    { id: 64, name: "Ace of Pentacles", icon: "🪙", suit: "pentacles", number: 1 },
    { id: 65, name: "Two of Pentacles", icon: "🪙", suit: "pentacles", number: 2 },
    { id: 66, name: "Three of Pentacles", icon: "🪙", suit: "pentacles", number: 3 },
    { id: 67, name: "Four of Pentacles", icon: "🪙", suit: "pentacles", number: 4 },
    { id: 68, name: "Five of Pentacles", icon: "🪙", suit: "pentacles", number: 5 },
    { id: 69, name: "Six of Pentacles", icon: "🪙", suit: "pentacles", number: 6 },
    { id: 70, name: "Seven of Pentacles", icon: "🪙", suit: "pentacles", number: 7 },
    { id: 71, name: "Eight of Pentacles", icon: "🪙", suit: "pentacles", number: 8 },
    { id: 72, name: "Nine of Pentacles", icon: "🪙", suit: "pentacles", number: 9 },
    { id: 73, name: "Ten of Pentacles", icon: "🪙", suit: "pentacles", number: 10 },
    { id: 74, name: "Page of Pentacles", icon: "🪙", suit: "pentacles", number: 11 },
    { id: 75, name: "Knight of Pentacles", icon: "🪙", suit: "pentacles", number: 12 },
    { id: 76, name: "Queen of Pentacles", icon: "🪙", suit: "pentacles", number: 13 },
    { id: 77, name: "King of Pentacles", icon: "🪙", suit: "pentacles", number: 14 },
];

export const TAROT_DECK: TarotCardDefinition[] = RAW_TAROT_DECK.map((card) => {
    const suit = card.suit ?? "major";
    const arcana = suit === "major" ? "Major Arcana" : "Minor Arcana";

    return {
        ...card,
        arcana,
        suitLabel: SUIT_LABELS[suit],
        keywords: [SUIT_KEYWORDS[suit], arcana],
        image: `./cards/${String(card.id).padStart(2, "0")}-${slugify(card.name)}.svg`,
        backImage: TAROT_CARD_BACK,
    };
});
