import type { ViewStyle } from "react-native";

export const shadows = {
  card: {
    shadowColor: "#4C24D8",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: "#351AA0",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 7,
  },
} satisfies Record<string, ViewStyle>;
