import axios, { AxiosError } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "campusx.auth.access-token";

const defaultApiUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api";

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl,
  timeout: 12_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear session using a delayed require to avoid circular dependency
      const { useAppStore } = require("../store/appStore");
      await useAppStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      (error.code === "ECONNABORTED"
        ? "CampusX took too long to respond. Please try again."
        : "CampusX could not reach the server. Check your connection.")
    );
  }
  return "Something unexpected happened. Please try again.";
}
