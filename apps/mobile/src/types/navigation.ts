import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabName =
  "Home" | "Discover" | "CreateHub" | "Chats" | "Profile";

export type RootStackParamList = {
  Splash: undefined;
  OnboardingOne: undefined;
  OnboardingTwo: undefined;
  OnboardingThree: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  SignupAccount: undefined;
  SignupProfile: undefined;
  SignupSuccess: { firstName?: string } | undefined;
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
  Feed: undefined;
  PostDetails: { postId: string };
  UserProfile: { userId: string };
  EditProfile: undefined;
  Friends: undefined;
  FriendRequests: undefined;
  People: undefined;
  PeopleSuggestions: undefined;
  GlobalUsers: undefined;
  Saved: undefined;
  MyPosts: undefined;
  MyEvents: undefined;
  CreatePost: undefined;
  Reactions: { postId?: string } | undefined;
  MutualFriends: { userId?: string } | undefined;
  Conversation: { conversationId: string; name?: string; source?: "notification" | "chat_list" };
  GroupConversation: { groupId: string; name?: string };
  NewChat: undefined;
  ChatInfo: { conversationId: string };
  CreateChatGroup: undefined;
  CreateChatGroupDetails: { selectedIds: string[] };
  ArchivedChats: undefined;
  AIChat: { conversationId?: string } | undefined;
  AIHistory: undefined;
  CreateStory: undefined;
  StoryViewer: { storyId: string };

  LocationSettings: undefined;

  Timetable: undefined;
  Calendar: undefined;
  TimetableSettings: undefined;
  TimetableReview: {
    entries: any[];
    gridTimeSlots?: any[];
    imageUri: string;
    missingCells?: any[];
    warnings?: string[];
    hasExistingTimetable?: boolean;
  };
  EditClass: {
    entryId?: string;
    defaultDay?: number;
    defaultStartTime?: string;
    defaultEndTime?: string;
    mode?: "base" | "special";
    date?: string;
  } | undefined;
  MoveClass: { classId: string; date: string; mode: "base" | "occurrence" };
  StudyGroups: { initialCategory?: "My Groups" | "Joined" } | undefined;
  GroupDetails: { groupId: string };
  GroupMembers: { groupId: string };
  GroupPolls: { groupId: string };
  GroupFiles: { groupId: string };
  GroupPosts: { groupId: string };
  StudySessions: { groupId?: string } | undefined;
  InviteToGroup: { groupId: string };
  CreateGroup: undefined;
  EditGroup: { groupId: string };
  Events: undefined;
  EventDetails: { eventId: string };
  EventRegistrations: { eventId: string };
  CreateEvent: { eventId?: string } | undefined;
  EditEvent: { eventId?: string } | undefined;
  Marketplace: undefined;
  ListingDetails: { listingId: string };
  CreateListing: { editId?: string } | undefined;
  ManageListings: undefined;
  Weather: undefined;
  WeatherDetails: { lat: number; lon: number; name: string };
  Trips: undefined;
  TripDetails: { tripId: string };
  CreateTrip: undefined;
  EditTrip: { tripId: string };
  InviteToTrip: { tripId: string };
  TripItinerary: { tripId: string };
  TripVoting: { tripId: string };
  TripExpenses: { tripId: string };
  Notifications: undefined;
  SGPACalculator: undefined;
  MyQR: undefined;
  QRScanner: undefined;
  Settings: undefined;
  GamesHub: undefined;
  GameSetup: { gameId: string };
  ActiveGame: { gameId: string; mode: "1P" | "2P" | "3P" | "4P"; difficulty: string; matchLength: number };
  GameResult: { gameId: string; status: string; scoreText?: string; nextLevel?: number };
  AirHockey: undefined;
  Game2048: undefined;
  Sudoku: undefined;
  TicTacToe: undefined;
  Snake: undefined;
  MemoryMatch: undefined;
  WordGame: undefined;
  ChessPuzzles: undefined;
  ReactionBattle: undefined;
  TicTacToeGlow: undefined;
};

export type MainTabsParamList = {
  Home: undefined;
  Discover: undefined;
  CreateHub: undefined;
  Chats: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
