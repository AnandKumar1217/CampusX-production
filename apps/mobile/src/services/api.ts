import axios, { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireServiceUrl } from "@/config/runtimeEnvironment";

const ACCESS_TOKEN_KEY = "campusx.auth.access-token";
const REFRESH_TOKEN_KEY = "campusx.auth.refresh-token";

const configuredApiUrl = requireServiceUrl(
  "EXPO_PUBLIC_API_URL",
  process.env.EXPO_PUBLIC_API_URL,
);

export const api = axios.create({
  baseURL: configuredApiUrl,
  timeout: 12_000,
  headers: { "Content-Type": "application/json" },
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  __sessionEpoch?: number;
  __sessionController?: AbortController;
  __externalSignal?: NonNullable<InternalAxiosRequestConfig["signal"]>;
  __onExternalAbort?: () => void;
};

let sessionEpoch = 0;
let activeAccessToken: string | null = null;
const inFlight = new Set<AbortController>();
let credentialOperation: Promise<unknown> = Promise.resolve();

export function queueCredentialOperation<T>(operation: () => Promise<T>): Promise<T> {
  const current = credentialOperation.then(operation, operation);
  credentialOperation = current.catch(() => {});
  return current;
}

const getStoredToken = (key: string) => Platform.OS === "web"
  ? AsyncStorage.getItem(key)
  : SecureStore.getItemAsync(key);
const setStoredToken = (key: string, value: string) => Platform.OS === "web"
  ? AsyncStorage.setItem(key, value)
  : SecureStore.setItemAsync(key, value);

function releaseRequest(config?: SessionRequestConfig) {
  if (!config) return;
  if (config.__sessionController) inFlight.delete(config.__sessionController);
  if (config.__externalSignal && config.__onExternalAbort) {
    config.__externalSignal.removeEventListener?.("abort", config.__onExternalAbort);
  }
}

export function setApiSessionToken(token: string | null) {
  activeAccessToken = token;
}

export function resetApiSession() {
  sessionEpoch += 1;
  activeAccessToken = null;
  inFlight.forEach((controller) => controller.abort());
  inFlight.clear();
  processQueue(new CanceledError("Account changed"));
  isRefreshing = false;
  delete api.defaults.headers.common.Authorization;
}

api.interceptors.request.use(async (config) => {
  const request = config as SessionRequestConfig;
  request.__sessionEpoch = sessionEpoch;
  const controller = new AbortController();
  request.__sessionController = controller;
  if (config.signal) {
    request.__externalSignal = config.signal;
    request.__onExternalAbort = () => controller.abort();
    if (config.signal.aborted) controller.abort();
    else config.signal.addEventListener?.("abort", request.__onExternalAbort, { once: true });
  }
  config.signal = controller.signal;
  inFlight.add(controller);
  const token = activeAccessToken;
  if (request.__sessionEpoch !== sessionEpoch) {
    releaseRequest(request);
    throw new CanceledError("Account changed");
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

let isHandlingAccountDeletion = false;
async function handleAccountNoLongerExists() {
  if (isHandlingAccountDeletion) return;
  isHandlingAccountDeletion = true;
  try {
    const { useAppStore } = require("../store/appStore");
    const { navigationRef } = require("../navigation/PushRoutingManager");
    await useAppStore.getState().clearSession();
    if (navigationRef.isReady()) {
      const state = navigationRef.getRootState();
      if (state?.routes[state.index]?.name !== "Login") {
        navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    }
  } catch (err) {
    console.warn("Failed to handle account deletion reset", err);
  } finally {
    setTimeout(() => { isHandlingAccountDeletion = false; }, 2000);
  }
}

api.interceptors.response.use(
  (response) => {
    const request = response.config as SessionRequestConfig;
    releaseRequest(request);
    if (request.__sessionEpoch !== sessionEpoch) {
      return Promise.reject(new CanceledError("Account changed"));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as SessionRequestConfig | undefined;
    releaseRequest(originalRequest);
    if (originalRequest?.__sessionEpoch !== undefined && originalRequest.__sessionEpoch !== sessionEpoch) {
      return Promise.reject(new CanceledError("Account changed"));
    }

    if (error.response?.status === 401 && error.response?.data?.code === "ACCOUNT_NOT_FOUND") {
      await handleAccountNoLongerExists();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.startsWith("/auth/")) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshEpoch = sessionEpoch;
      const refreshController = new AbortController();
      inFlight.add(refreshController);

      try {
        const refreshToken = await getStoredToken(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const res = await axios.post<{ data: { accessToken: string; refreshToken: string; user: any } }>(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
          { signal: refreshController.signal }
        );
        if (refreshEpoch !== sessionEpoch) throw new CanceledError("Account changed");

        const newAccessToken = res.data.data.accessToken;
        const newRefreshToken = res.data.data.refreshToken;

        await queueCredentialOperation(async () => {
          if (refreshEpoch !== sessionEpoch) throw new CanceledError("Account changed");
          await Promise.all([
            setStoredToken(ACCESS_TOKEN_KEY, newAccessToken),
            setStoredToken(REFRESH_TOKEN_KEY, newRefreshToken),
          ]);
        });
        if (refreshEpoch !== sessionEpoch) throw new CanceledError("Account changed");

        activeAccessToken = newAccessToken;
        const { useAppStore } = require("../store/appStore");
        useAppStore.setState({ accessToken: newAccessToken });
        const { updateSocketAuthToken } = require("../services/socket");
        updateSocketAuthToken(newAccessToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError: any) {
        if (refreshEpoch === sessionEpoch) {
          processQueue(refreshError as Error, null);
          if (refreshError.response?.status === 401 && refreshError.response?.data?.code === "ACCOUNT_NOT_FOUND") {
            await handleAccountNoLongerExists();
          } else {
            const { useAppStore } = require("../store/appStore");
            await useAppStore.getState().clearSession();
          }
        }
        return Promise.reject(refreshError);
      } finally {
        inFlight.delete(refreshController);
        if (refreshEpoch === sessionEpoch) isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: any) {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;

  if (code === "INVALID_CREDENTIALS") {
    return "Incorrect email/username or password.";
  }
  if (status === 429 || code === "RATE_LIMITED") {
    return error?.response?.data?.message || "Too many requests. Please try again later.";
  }
  if (status >= 500) {
    return "Couldn't sign in right now. Please try again.";
  }
  if (error?.code === "ECONNABORTED" || error?.message === "Network Error" || error?.message?.includes("Network")) {
    return "Unable to connect. Check your internet connection and try again.";
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  return "Something went wrong. Please try again.";
}

export async function wakeBackend(signal?: AbortSignal): Promise<boolean> {
  const startTime = Date.now();
  const maxWait = 75000; // 75 seconds

  while (Date.now() - startTime < maxWait) {
    if (signal?.aborted) return false;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const outerAbortListener = () => controller.abort();
    if (signal) signal.addEventListener("abort", outerAbortListener);

    try {
      const res = await fetch(`${configuredApiUrl}/health`, {
        method: "GET",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json.success === true && json.data?.status === "ok" && json.data?.database === "connected") {
          return true;
        }
      }
    } catch {
      // Ignore fetch errors (timeout, network down, etc.)
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", outerAbortListener);
    }

    if (signal?.aborted) return false;
    await new Promise(r => setTimeout(r, 2500));
  }
  return false;
}
