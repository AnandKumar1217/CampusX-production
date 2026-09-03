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
  SignupInterests: undefined;
  SignupSuccess: undefined;
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
  Feed: undefined;
  PostDetails: { postId: string };
  UserProfile: { userId: string };
  EditProfile: undefined;
  Friends: undefined;
  FriendRequests: undefined;
  PeopleSuggestions: undefined;
  StoryViewer: { storyId?: string } | undefined;
  CreateStory: undefined;
  Saved: undefined;
  MyPosts: undefined;
  CreatePost: undefined;
  Reactions: { postId?: string } | undefined;
  MutualFriends: { userId?: string } | undefined;
  Conversation: { conversationId: string; name?: string };
  NewChat: undefined;
  ChatInfo: { conversationId: string };
  CreateChatGroup: undefined;
  CreateChatGroupDetails: { selectedIds: string[] };
  VideoCall: undefined;
  AIChat: { conversationId?: string } | undefined;
  AIHistory: undefined;
  AITools: undefined;

  LocationSettings: undefined;
  GhostMode: undefined;
  Timetable: undefined;
  TimetableSettings: undefined;
  EditClass: { entryId?: string; defaultDay?: number; defaultStartTime?: string } | undefined;
  StudyGroups: undefined;
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
  EditEvent: { eventId?: string } | undefined;
  Marketplace: undefined;
  ListingDetails: { listingId: string };
  CreateListing: { editId?: string } | undefined;
  ManageListings: undefined;
  Weather: undefined;
  WeatherDetails: undefined;
  Trips: undefined;
  TripDetails: { tripId: string };
  CreateTrip: undefined;
  InviteToTrip: { tripId: string };
  TripItinerary: { tripId: string };
  TripVoting: { tripId: string };
  TripExpenses: { tripId: string };
  Notifications: undefined;
  MyQR: undefined;
  QRScanner: undefined;
  Settings: undefined;
  GamesHub: undefined;
  Game2048: undefined;
  Sudoku: undefined;
  TicTacToe: undefined;
  Snake: undefined;
  MemoryMatch: undefined;
  WordGame: undefined;
  ChessPuzzles: undefined;
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
