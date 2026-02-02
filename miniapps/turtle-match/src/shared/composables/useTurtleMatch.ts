/**
 * Turtle Match game types and utilities
 * Re-exports from useTurtleGame for backward compatibility
 */
export { TurtleColor, type Turtle, type GameSession, type GameStats, useTurtleGame } from "../../composables/useTurtleGame";

/**
 * CSS color map for turtle colors
 */
export const COLOR_CSS: Record<number, string> = {
    0: "#50C878", // Green
    1: "#FF6B6B", // Red
    2: "#4ECDC4", // Blue
    3: "#9B59B6", // Purple
    4: "#FFD700", // Gold
};

/**
 * Human-readable color names
 */
export const COLOR_NAMES: Record<number, string> = {
    0: "Green",
    1: "Red",
    2: "Blue",
    3: "Purple",
    4: "Gold",
};
