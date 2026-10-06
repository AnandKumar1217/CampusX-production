import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal('__DEV__', true);
  (global as any).mockRegisteredTasks = {};
});

vi.mock("expo-modules-core", () => ({}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("@react-native-async-storage/async-storage", () => ({}));

import { api } from "../src/services/api";
import * as TaskManager from "expo-task-manager";
import { BACKGROUND_LOCATION_TASK } from "../src/services/locationTask";
import { useLiveLocationWatcher } from "../src/hooks/useLiveLocationWatcher";

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() })
  },
  Platform: { OS: "ios" },
  TurboModuleRegistry: { get: vi.fn() }
}));

vi.mock("react", () => {
  return {
    useEffect: (fn: any) => {
      fn();
    },
    useRef: (val: any) => ({ current: val })
  };
});

vi.mock("../src/services/api", () => ({
  api: {
    post: vi.fn(),
    defaults: { headers: { common: { Authorization: "token" } } }
  }
}));

vi.mock("expo-task-manager", () => ({
  defineTask: vi.fn((name, callback) => {
    (global as any).mockRegisteredTasks[name] = callback;
  }),
  isTaskRegisteredAsync: vi.fn().mockResolvedValue(false),
}));

vi.mock("expo-location", () => ({
  getForegroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getBackgroundPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: vi.fn().mockResolvedValue({ coords: { latitude: 1, longitude: 2 } }),
  watchPositionAsync: vi.fn().mockImplementation((options: any, callback: any) => {
    (global as any).__triggerWatchPosition = callback;
    return { remove: vi.fn() };
  }),
  startLocationUpdatesAsync: vi.fn(),
  stopLocationUpdatesAsync: vi.fn(),
  Accuracy: { Balanced: 3 }
}));

vi.mock("../src/store/appStore", () => {
  const state = {
    locationSharingEnabled: true,
    user: { id: "1" },
    setLocationCoords: vi.fn(),
    fetchInitialFriendLocations: vi.fn().mockResolvedValue(true),
  };
  const mockUseAppStore: any = vi.fn().mockImplementation((selector) => selector(state));
  mockUseAppStore.getState = () => state;
  return { useAppStore: mockUseAppStore };
});

describe("Location Source Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends 'foreground' source from useLiveLocationWatcher", async () => {
    useLiveLocationWatcher();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(api.post).toHaveBeenCalled();
    const calls = vi.mocked(api.post).mock.calls;
    
    calls.forEach(call => {
      expect(call[0]).toBe("/location/position");
      expect(call[1]).toHaveProperty("source", "foreground");
      expect(call[1].source).not.toMatch(/^(foreground_init|heartbeat|movement|foreground_resume)$/);
    });
  });

  it("sends 'background' source from background task", async () => {
    const taskCallback = (global as any).mockRegisteredTasks[BACKGROUND_LOCATION_TASK];
    expect(taskCallback).toBeDefined();
    
    await taskCallback({
      data: {
        locations: [{ coords: { latitude: 10, longitude: 20 } }]
      },
      error: null
    });

    const apiCalls = vi.mocked(api.post).mock.calls;
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(apiCalls[0][1]).toHaveProperty("source", "background");
  });
});
