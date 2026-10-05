import AsyncStorage from "@react-native-async-storage/async-storage";

export interface GameSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  animationsEnabled: boolean;
}

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  maxLevel?: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  animationsEnabled: true,
};

export class GameStorage {
  private static SETTINGS_KEY = "@games_settings";
  private static STATS_PREFIX = "@games_stats_";
  private static RECENT_GAMES_KEY = "@games_recent";

  static async getSettings(): Promise<GameSettings> {
    try {
      const data = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to load game settings", e);
    }
    return DEFAULT_SETTINGS;
  }

  static async saveSettings(settings: GameSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save game settings", e);
    }
  }

  static async getStats(gameId: string): Promise<GameStats> {
    try {
      const data = await AsyncStorage.getItem(`${this.STATS_PREFIX}${gameId}`);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(`Failed to load stats for ${gameId}`, e);
    }
    return { played: 0, wins: 0, losses: 0, draws: 0 };
  }

  static async updateStats(gameId: string, updates: Partial<GameStats>): Promise<void> {
    const current = await this.getStats(gameId);
    const newStats = {
      played: current.played + (updates.played || 0),
      wins: current.wins + (updates.wins || 0),
      losses: current.losses + (updates.losses || 0),
      draws: current.draws + (updates.draws || 0),
    };
    try {
      await AsyncStorage.setItem(`${this.STATS_PREFIX}${gameId}`, JSON.stringify(newStats));
    } catch (e) {
      console.error(`Failed to save stats for ${gameId}`, e);
    }
  }

  static async getRecentGames(): Promise<{ gameId: string; playedAt: number }[]> {
    try {
      const data = await AsyncStorage.getItem(this.RECENT_GAMES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error("Failed to load recent games", e);
    }
    return [];
  }

  static async addRecentGame(gameId: string): Promise<void> {
    try {
      let recent = await this.getRecentGames();
      recent = recent.filter(r => r.gameId !== gameId);
      recent.unshift({ gameId, playedAt: Date.now() });
      recent = recent.slice(0, 10);
      await AsyncStorage.setItem(this.RECENT_GAMES_KEY, JSON.stringify(recent));
    } catch (e) {
      console.error("Failed to save recent game", e);
    }
  }
}
