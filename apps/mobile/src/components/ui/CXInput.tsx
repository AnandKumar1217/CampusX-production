import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef, useState, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { colors, radius, spacing, typography } from "@/theme";

import { CXText } from "./CXText";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  trailing?: ReactNode;
  onPress?: () => void;
};

export const CXInput = forwardRef<TextInput, Props>(function CXInput(
  { label, error, hint, icon, trailing, secureTextEntry, style, onPress, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const internalRef = useRef<TextInput>(null);

  // Merge forwarded ref with internal ref so we can programmatically focus
  const handleRef = (node: TextInput | null) => {
    internalRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <View style={styles.wrapper}>
      {label ? <CXText variant="smallStrong">{label}</CXText> : null}
      <Pressable
        onPress={() => {
          if (onPress) {
            onPress();
          } else {
            internalRef.current?.focus();
          }
        }}
        style={[
          styles.field,
          focused && styles.focused,
          error && styles.errorField,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.textFaint}
          />
        ) : null}
        <TextInput
          ref={handleRef}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          secureTextEntry={Boolean(hidden)}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[styles.input, style]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        ) : (
          trailing
        )}
      </Pressable>
      {error ? (
        <CXText variant="caption" color={colors.danger}>
          {error}
        </CXText>
      ) : hint ? (
        <CXText variant="caption" color={colors.textMuted}>
          {hint}
        </CXText>
      ) : null}
    </View>
  );
});

export function CXSearchBar({
  style,
  onPressFilter,
  value,
  onClear,
  ...props
}: TextInputProps & { onPressFilter?: () => void; onClear?: () => void }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        accessibilityLabel="Search"
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        style={[styles.input, style]}
        value={value}
        {...props}
      />
      {!!value && (
        <Pressable 
          onPress={() => {
            props.onChangeText?.("");
            onClear?.();
          }} 
          hitSlop={10} 
          style={{ paddingHorizontal: 4 }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      {onPressFilter ? (
        <Pressable onPress={onPressFilter} hitSlop={10}>
          <Ionicons name="options-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : (
        <Ionicons name="options-outline" size={18} color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  field: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  focused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  errorField: { borderColor: colors.danger },
  input: { flex: 1, minWidth: 0, color: colors.ink, ...typography.body },
  search: {
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
