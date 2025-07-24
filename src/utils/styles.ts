import { StyleSheet } from "react-native";

export const globalStyles = StyleSheet.create({
  // Text styles with system fonts
  text: {
    fontFamily: "System",
    fontWeight: "400",
    color: "#fff",
  },
  textLight: {
    fontFamily: "System",
    fontWeight: "300",
    color: "#fff",
  },
  textMedium: {
    fontFamily: "System",
    fontWeight: "500",
    color: "#fff",
  },
  textBold: {
    fontFamily: "System",
    fontWeight: "700",
    color: "#fff",
  },

  // Heading styles
  h1: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 32,
    color: "#fff",
  },
  h2: {
    fontFamily: "System",
    fontWeight: "700",
    fontSize: 24,
    color: "#fff",
  },
  h3: {
    fontFamily: "System",
    fontWeight: "500",
    fontSize: 20,
    color: "#fff",
  },
  h4: {
    fontFamily: "System",
    fontWeight: "500",
    fontSize: 18,
    color: "#fff",
  },

  // Body text styles
  bodyLarge: {
    fontFamily: "System",
    fontWeight: "400",
    fontSize: 18,
    color: "#fff",
  },
  bodyMedium: {
    fontFamily: "System",
    fontWeight: "400",
    fontSize: 16,
    color: "#fff",
  },
  bodySmall: {
    fontFamily: "System",
    fontWeight: "400",
    fontSize: 14,
    color: "#fff",
  },

  // Button text styles
  buttonText: {
    fontFamily: "System",
    fontWeight: "500",
    fontSize: 16,
    color: "#fff",
  },
  buttonTextLarge: {
    fontFamily: "System",
    fontWeight: "500",
    fontSize: 18,
    color: "#fff",
  },

  // Caption styles
  caption: {
    fontFamily: "System",
    fontWeight: "300",
    fontSize: 12,
    color: "#fff",
  },
});

// Font weight helper function
export const getFontFamily = (
  weight: "light" | "regular" | "medium" | "bold" = "regular"
) => {
  // For now, always return System font
  // In the future, this can be updated to return different font families based on weight
  console.log(`Using ${weight} weight for System font`);
  return "System";
};
