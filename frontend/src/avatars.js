// Preset gradient avatars (stored as a key on the patient; no photo upload).
export const AVATARS = {
  mint: ["#8fd3c3", "#4faf9a"],
  peach: ["#f4c9a3", "#e79b6a"],
  rose: ["#f3a6b0", "#e0798a"],
  sky: ["#a9c7f5", "#6d94e8"],
  violet: ["#c3b3f6", "#8b5cf6"],
  sage: ["#b7d1a3", "#7fa86a"],
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export function avatarGradient(key) {
  const [a, b] = AVATARS[key] ?? AVATARS.mint;
  return `linear-gradient(135deg, ${a}, ${b})`;
}
