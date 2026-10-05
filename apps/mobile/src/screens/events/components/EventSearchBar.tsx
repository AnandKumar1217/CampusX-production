import React, { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };

interface EventSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function EventSearchBar({ value, onChangeText, placeholder = "Search events, organizers, locations..." }: EventSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Ionicons 
        name="search" 
        color={isFocused ? theme.colors.primary : theme.colors.textSecondary} 
        size={20} 
        style={styles.icon} 
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <Ionicons 
          name="close-circle" 
          color={theme.colors.textSecondary} 
          size={18} 
          style={styles.clearIcon}
          onPress={() => onChangeText("")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  containerFocused: {
    backgroundColor: '#e5e7eb',
  },
  icon: {
    marginRight: 10,
  },
  clearIcon: {
    marginLeft: 10,
    padding: 4,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  }
});
