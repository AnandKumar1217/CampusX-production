import type { ComponentProps } from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { colors, typography } from "@/theme";

type TextVariant = keyof typeof typography;

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle["textAlign"];
};

export function CXText({
  variant = "body",
  color = colors.ink,
  align,
  style,
  ...props
}: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.35}
      style={[
        styles.base,
        typography[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({ base: { includeFontPadding: false } });

export type CXTextProps = ComponentProps<typeof CXText>;
