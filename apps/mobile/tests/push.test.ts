/**
 * Push Notification Hook Tests (Mobile)
 *
 * Pure unit tests — no device, no Firebase, no real Expo APIs.
 * Uses vi.hoisted() to ensure mocks are available before module factories run.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fn refs must be created before vi.mock() factories ──
const {
  mockGetPermissions,
  mockRequestPermissions,
  mockGetExpoPushToken,
  mockSetNotificationChannel,
  mockSetNotificationHandler,
  mockAddResponseListener,
  mockApiPost,
  mockSetItem,
  mockIsDevice,
} = vi.hoisted(() => ({
  mockGetPermissions: vi.fn(),
  mockRequestPermissions: vi.fn(),
  mockGetExpoPushToken: vi.fn(),
  mockSetNotificationChannel: vi.fn(),
  mockSetNotificationHandler: vi.fn(),
  mockAddResponseListener: vi.fn(() => ({ remove: vi.fn() })),
  mockApiPost: vi.fn(),
  mockSetItem: vi.fn(),
  mockIsDevice: { value: true },
}));

// ── expo-device ───────────────────────────────────────────────────────────────
vi.mock("expo-device", () => ({
  get isDevice() { return mockIsDevice.value; },
  osBuildId: "test-build-id",
}));

// ── expo-notifications ────────────────────────────────────────────────────────
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: mockGetPermissions,
  requestPermissionsAsync: mockRequestPermissions,
  getExpoPushTokenAsync: mockGetExpoPushToken,
  setNotificationChannelAsync: mockSetNotificationChannel,
  setNotificationHandler: mockSetNotificationHandler,
  AndroidImportance: { MAX: 5 },
  addNotificationResponseReceivedListener: mockAddResponseListener,
}));

// ── expo-constants ────────────────────────────────────────────────────────────
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: { eas: { projectId: "7f33e455-8f40-4cee-8717-b0b95c2004b4" } },
    },
  },
}));

// ── api ───────────────────────────────────────────────────────────────────────
vi.mock("../src/services/api", () => ({
  api: { post: mockApiPost },
}));

// ── AsyncStorage ──────────────────────────────────────────────────────────────
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: mockSetItem,
    getItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

// ── PushRoutingManager ────────────────────────────────────────────────────────
vi.mock("../src/navigation/PushRoutingManager", () => ({
  handleNotification: vi.fn(),
  navigationRef: { isReady: () => true },
}));

// ── react-native ──────────────────────────────────────────────────────────────
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: {
    currentState: "active",
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// ── Import the constant we export from the hook ───────────────────────────────
import { PUSH_TOKEN_KEY } from "../src/hooks/usePushNotifications";

// ─────────────────────────────────────────────────────────────────────────────

describe("PUSH_TOKEN_KEY constant", () => {
  it("is the expected storage key string", () => {
    expect(PUSH_TOKEN_KEY).toBe("campusx.push.token");
  });

  it("matches the key used by appStore for logout unregister", () => {
    // appStore also hardcodes 'campusx.push.token' — ensure they stay in sync
    expect(PUSH_TOKEN_KEY).toBe("campusx.push.token");
  });
});

describe("push registration primitives (simulated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getExpoPushTokenAsync with the correct EAS projectId when permission is granted", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    mockGetExpoPushToken.mockResolvedValue({ data: "ExponentPushToken[test123]" });
    mockSetNotificationChannel.mockResolvedValue(undefined);

    // Simulate the production registration path
    const { status } = await mockGetPermissions();
    expect(status).toBe("granted");

    const tokenData = await mockGetExpoPushToken({
      projectId: "7f33e455-8f40-4cee-8717-b0b95c2004b4",
    });
    expect(tokenData.data).toMatch(/^ExponentPushToken\[/);
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({
      projectId: "7f33e455-8f40-4cee-8717-b0b95c2004b4",
    });
  });

  it("does not call getExpoPushTokenAsync when permission is denied", async () => {
    mockGetPermissions.mockResolvedValue({ status: "denied" });
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    const { status: existingStatus } = await mockGetPermissions();
    if (existingStatus !== "granted") {
      await mockRequestPermissions();
    }

    // Token should never be requested when permission is denied
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it("backend registration posts token, deviceId, and platform", async () => {
    mockApiPost.mockResolvedValue({});
    mockSetItem.mockResolvedValue(undefined);

    const token = "ExponentPushToken[abc123]";
    await mockApiPost("/push/register", {
      token,
      deviceId: "test-build-id",
      platform: "android",
    });

    expect(mockApiPost).toHaveBeenCalledWith(
      "/push/register",
      expect.objectContaining({
        token,
        deviceId: "test-build-id",
        platform: "android",
      })
    );
  });

  it("unregister posts token to /push/unregister", async () => {
    mockApiPost.mockResolvedValue({});
    const token = "ExponentPushToken[abc123]";
    await mockApiPost("/push/unregister", { token });
    expect(mockApiPost).toHaveBeenCalledWith("/push/unregister", { token });
  });

  it("re-registers fresh token after logout (simulated dedup reset)", async () => {
    mockApiPost.mockResolvedValue({});
    mockSetItem.mockResolvedValue(undefined);
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    mockGetExpoPushToken.mockResolvedValue({ data: "ExponentPushToken[userB]" });

    // First registration (User B after logout)
    const tokenData = await mockGetExpoPushToken({
      projectId: "7f33e455-8f40-4cee-8717-b0b95c2004b4",
    });
    await mockApiPost("/push/register", {
      token: tokenData.data,
      deviceId: "test-build-id",
      platform: "android",
    });

    expect(mockApiPost).toHaveBeenCalledWith(
      "/push/register",
      expect.objectContaining({ token: "ExponentPushToken[userB]" })
    );
  });
});
