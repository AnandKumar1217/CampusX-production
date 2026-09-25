import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/theme";
import { CXText } from "./CXText";

export function CXDropdown({
  zIndex,
  label,
  placeholder,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  onChangeText,
  editable,
  containerStyle,
}: {
  zIndex: number;
  label: string;
  placeholder?: string;
  value: string;
  options: readonly string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (val: string) => void;
  onChangeText: (val: string) => void;
  editable?: boolean;
  containerStyle?: any;
}) {
  const filteredOptions = React.useMemo(() => {
    if (!value || options.includes(value as any)) return options;
    return options.filter((o) => o.toLowerCase().includes(value.toLowerCase()));
  }, [options, value]);

  return (
    <View style={[styles.choiceWrap, { zIndex }]}>
      <CXText variant="smallStrong">{label}</CXText>
      <View style={[styles.choice, isOpen && styles.choiceOpen, containerStyle]}>
        <TextInput
          style={[styles.flex, { color: colors.inkSoft, fontSize: 16 }]}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (!isOpen) onToggle();
          }}
          onFocus={() => {
            if (!isOpen) onToggle();
          }}
          placeholder={placeholder || "Type or select..."}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable !== false}
        />
        <Pressable onPress={editable !== false ? onToggle : undefined} style={{ padding: 4 }}>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {isOpen && (
        <View style={styles.dropdownList}>
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filteredOptions.length === 0 ? (
              <View style={{ padding: spacing.md, alignItems: "center" }}>
                <CXText color={colors.textMuted} variant="small">No results found</CXText>
              </View>
            ) : (
              filteredOptions.map((opt) => {
                const selected = opt === value;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                    onPress={() => onSelect(opt)}
                  >
                    <CXText color={selected ? colors.primary : colors.inkSoft}>
                      {opt}
                    </CXText>
                    {selected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  choiceWrap: { gap: spacing.xs },
  choice: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  choiceOpen: {
    borderColor: colors.primary,
  },
  dropdownList: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.surfaceLavender,
  },
});
