import type { TextStyle } from "react-native";

const fontFamily = {
  display: "System",
  body: "System",
  mono: "monospace",
} as const;

export const typography = {
  hero: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
  },
  h1: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
  },
  h2: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
  },
  h3: {
    fontFamily: fontFamily.display,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400",
  },
  bodyStrong: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  small: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },
  smallStrong: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  button: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
} satisfies Record<string, TextStyle>;
