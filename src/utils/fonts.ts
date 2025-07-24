export const loadFonts = async () => {
  try {
    // For now, we'll use system fonts to avoid font loading issues
    // You can add custom fonts later when needed
    console.log("✅ Using system fonts");
  } catch (error) {
    console.error("❌ Error loading fonts:", error);
  }
};

export const fontFamily = {
  light: "System",
  regular: "System",
  medium: "System",
  bold: "System",
} as const;

export type FontWeight = keyof typeof fontFamily;
