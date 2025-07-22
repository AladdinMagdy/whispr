/**
 * Profile Generation Utilities
 * Extracted from AuthService for better testability
 */

export interface AnonymousProfile {
  displayName: string;
  profileColor: string;
}

const ADJECTIVES = [
  "Whispering",
  "Silent",
  "Quiet",
  "Mysterious",
  "Secretive",
  "Gentle",
  "Soft",
  "Hushed",
  "Muted",
  "Subtle",
  "Hidden",
  "Veiled",
  "Concealed",
  "Private",
  "Intimate",
] as const;

const NOUNS = [
  "Whisperer",
  "Listener",
  "Voice",
  "Echo",
  "Shadow",
  "Ghost",
  "Spirit",
  "Soul",
  "Heart",
  "Mind",
  "Dreamer",
  "Thinker",
  "Observer",
  "Wanderer",
  "Seeker",
] as const;

const COLORS = [
  "#4CAF50",
  "#2196F3",
  "#9C27B0",
  "#FF9800",
  "#F44336",
  "#00BCD4",
  "#8BC34A",
  "#FF5722",
  "#795548",
  "#607D8B",
  "#E91E63",
  "#3F51B5",
  "#009688",
  "#FFC107",
  "#9E9E9E",
] as const;

/**
 * Generate a random anonymous profile with display name and color
 */
export function generateAnonymousProfile(): AnonymousProfile {
  const randomAdjective =
    ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  return {
    displayName: `${randomAdjective} ${randomNoun}`,
    profileColor: randomColor,
  };
}

/**
 * Validate if a display name follows the correct format
 */
export function isValidDisplayName(displayName: string): boolean {
  const pattern =
    /^(Whispering|Silent|Quiet|Mysterious|Secretive|Gentle|Soft|Hushed|Muted|Subtle|Hidden|Veiled|Concealed|Private|Intimate) (Whisperer|Listener|Voice|Echo|Shadow|Ghost|Spirit|Soul|Heart|Mind|Dreamer|Thinker|Observer|Wanderer|Seeker)$/;
  return pattern.test(displayName);
}

/**
 * Validate if a color is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  const pattern = /^#[0-9A-F]{6}$/i;
  return pattern.test(color);
}

/**
 * Get all possible adjectives
 */
export function getAdjectives(): readonly string[] {
  return ADJECTIVES;
}

/**
 * Get all possible nouns
 */
export function getNouns(): readonly string[] {
  return NOUNS;
}

/**
 * Get all possible colors
 */
export function getColors(): readonly string[] {
  return COLORS;
}

/**
 * Generate a profile with specific adjective and noun (for testing)
 */
export function generateProfileWithWords(
  adjective: string,
  noun: string
): AnonymousProfile {
  const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  return {
    displayName: `${adjective} ${noun}`,
    profileColor: randomColor,
  };
}
