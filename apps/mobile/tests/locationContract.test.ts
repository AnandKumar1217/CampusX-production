import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal('__DEV__', true);
  (global as any).mockRegisteredTasks = {};
});

vi.mock("expo-modules-core", () => ({}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("@react-native-async-storage/async-storage", () => {
  const m = {
    getItem: vi.fn().mockResolvedValue(JSON.stringify({ state: { locationSharingEnabled: true } })),
    setItem: vi.fn(),
  };
  return {
    ...m,
    default: m,
  };
});
vi.mock("expo-notifications", () => ({ registerTaskAsync: vi.fn().mockResolvedValue(true) }));

import { api } from "../src/services/api";
import * as TaskManager from "expo-task-manager";
import { LOCATION_REFRESH_NOTIFICATION_TASK } from "../src/services/locationTask";
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

vi.mock("../src/services/socket", () => ({
  getSocket: () => ({
    on: (event: string, handler: any) => {
      (global as any).__mockSocketHandlers = (global as any).__mockSocketHandlers || {};
      (global as any).__mockSocketHandlers[event] = handler;
    },
    off: vi.fn()
  })
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

  it("sends 'on_demand' source from useLiveLocationWatcher when receiving socket event", async () => {
    useLiveLocationWatcher();
    
    // Simulate socket event
    const handler = (global as any).__mockSocketHandlers["location:refresh_request"];
    expect(handler).toBeDefined();
    
    await handler({ requestId: "123", requesterId: "456" });

    expect(api.post).toHaveBeenCalled();
    const calls = vi.mocked(api.post).mock.calls;
    
    let found = false;
    calls.forEach(call => {
      if (call[0] === "/location/position") {
        expect(call[1]).toHaveProperty("source", "on_demand");
        expect(call[1]).toHaveProperty("requestId", "123");
        found = true;
      }
    });
    expect(found).toBe(true);
  });

  it("sends 'on_demand' source from notification task", async () => {
    // Mock AsyncStorage for the task
    const AsyncStorage = require("@react-native-async-storage/async-storage");

    const taskCallback = (global as any).mockRegisteredTasks[LOCATION_REFRESH_NOTIFICATION_TASK];
    expect(taskCallback).toBeDefined();
    
    await taskCallback({
      data: {
        notification: {
          data: {
            type: "LOCATION_REFRESH_REQUEST",
            requestId: "req-1",
            requesterId: "user-b"
          }
        }
      },
      error: null
    });

    const apiCalls = vi.mocked(api.post).mock.calls;
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(apiCalls[0][1]).toHaveProperty("source", "on_demand");
    expect(apiCalls[0][1]).toHaveProperty("requestId", "req-1");
  });
});
