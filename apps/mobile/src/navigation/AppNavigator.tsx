import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CXBottomNav } from "@/components/navigation/CXBottomNav";
import {
  AIChatScreen,
  AIHistoryScreen,
  AIToolsScreen,
  ChatInfoScreen,
  ConversationScreen,
  NewChatScreen,
  VideoCallScreen,
  CreateChatGroupScreen,
  CreateChatGroupDetailsScreen,
} from "@/screens/chat/ChatScreens";
import {
  EditClassScreen,
  GhostModeScreen,
  LocationSettingsScreen,
  TimetableScreen,
  TimetableSettingsScreen,
} from "@/screens/campus/CampusScreens";
import {
  CreateListingScreen,
  EditEventScreen,
  EventDetailsScreen,
  EventsScreen,
  ListingDetailsScreen,
  ManageListingsScreen,
  MarketplaceScreen,
  WeatherDetailsScreen,
  WeatherScreen,
} from "@/screens/commerce/CommerceScreens";
import {
  ChessPuzzlesScreen,
  Game2048Screen,
  GamesHubScreen,
  MemoryMatchScreen,
  SnakeScreen,
  SudokuScreen,
  TicTacToeScreen,
  WordGameScreen,
} from "@/screens/games/GameScreens";
import {
  GroupDetailsScreen,
  GroupFilesScreen,
  GroupMembersScreen,
  GroupPollsScreen,
  GroupPostsScreen,
  InviteToGroupScreen,
  StudyGroupsScreen,
  StudySessionsScreen,
  CreateGroupScreen,
  EditGroupScreen,
} from "@/screens/groups/GroupScreens";
import { CreateHubScreen } from "@/screens/main/CreateHubScreen";
import { ChatsScreen } from "@/screens/main/ChatsScreen";
import { DiscoverScreen } from "@/screens/main/DiscoverScreen";
import { HomeScreen } from "@/screens/main/HomeScreen";
import { ProfileScreen } from "@/screens/main/ProfileScreen";
import { EditProfileScreen } from "@/screens/main/EditProfileScreen";
import {
  FeedScreen,
  FriendRequestsScreen,
  FriendsScreen,
  CreatePostScreen,
  CreateStoryScreen,
  MutualFriendsScreen,
  MyPostsScreen,
  PeopleSuggestionsScreen,
  PostDetailsScreen,
  ReactionsScreen,
  SavedScreen,
  StoryViewerScreen,
  UserProfileScreen,
} from "@/screens/social/SocialScreens";
import {
  CreateTripScreen,
  InviteToTripScreen,
  TripDetailsScreen,
  TripExpensesScreen,
  TripItineraryScreen,
  TripsScreen,
  TripVotingScreen,
} from "@/screens/trips/TripScreens";
import {
  MyQRScreen,
  NotificationsScreen,
  QRScannerScreen,
  SettingsScreen,
} from "@/screens/utilities/UtilityScreens";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import {
  OnboardingOneScreen,
  OnboardingThreeScreen,
  OnboardingTwoScreen,
} from "@/screens/auth/OnboardingScreens";
import {
  ForgotPasswordScreen,
  ResetPasswordScreen,
} from "@/screens/auth/RecoveryScreens";
import {
  SignupAccountScreen,
  SignupInterestsScreen,
  SignupProfileScreen,
  SignupSuccessScreen,
} from "@/screens/auth/SignupScreens";
import { SplashScreen } from "@/screens/auth/SplashScreen";
import { colors } from "@/theme";
import type { MainTabsParamList, RootStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={(props) => <CXBottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        lazy: true,
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="CreateHub" component={CreateHubScreen} />
      <Tabs.Screen name="Chats" component={ChatsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["campusx://"],
  config: {
    screens: {
      Main: "",
      UserProfile: "user/:userId",
      PostDetails: "post/:postId",
      EventDetails: "event/:eventId",
      ListingDetails: "listing/:listingId",
      TripDetails: "trip/:tripId",
      QRScanner: "scan",
    },
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer
      linking={linking}
      theme={{
        dark: false,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.white,
          text: colors.ink,
          border: colors.border,
          notification: colors.danger,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "900" },
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: colors.background },
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ animation: "fade" }}
        />
        <Stack.Screen
          name="OnboardingOne"
          component={OnboardingOneScreen}
          options={{ animation: "fade" }}
        />
        <Stack.Screen
          name="OnboardingTwo"
          component={OnboardingTwoScreen}
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="OnboardingThree"
          component={OnboardingThreeScreen}
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="SignupAccount" component={SignupAccountScreen} />
        <Stack.Screen name="SignupProfile" component={SignupProfileScreen} />
        <Stack.Screen
          name="SignupInterests"
          component={SignupInterestsScreen}
        />
        <Stack.Screen
          name="SignupSuccess"
          component={SignupSuccessScreen}
        />
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="PostDetails" component={PostDetailsScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
        <Stack.Screen name="FriendRequests" component={FriendRequestsScreen} />
        <Stack.Screen
          name="PeopleSuggestions"
          component={PeopleSuggestionsScreen}
        />
        <Stack.Screen
          name="StoryViewer"
          component={StoryViewerScreen}
          options={{ animation: "fade", gestureDirection: "vertical" }}
        />
        <Stack.Screen name="CreateStory" component={CreateStoryScreen} />
        <Stack.Screen name="Saved" component={SavedScreen} />
        <Stack.Screen name="MyPosts" component={MyPostsScreen} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} />
        <Stack.Screen name="Reactions" component={ReactionsScreen} />
        <Stack.Screen name="MutualFriends" component={MutualFriendsScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="NewChat" component={NewChatScreen} />
        <Stack.Screen name="ChatInfo" component={ChatInfoScreen} />
        <Stack.Screen name="CreateChatGroup" component={CreateChatGroupScreen} />
        <Stack.Screen name="CreateChatGroupDetails" component={CreateChatGroupDetailsScreen} />
        <Stack.Screen name="VideoCall" component={VideoCallScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="AIHistory" component={AIHistoryScreen} />
        <Stack.Screen name="AITools" component={AIToolsScreen} />

        <Stack.Screen
          name="LocationSettings"
          component={LocationSettingsScreen}
        />
        <Stack.Screen name="GhostMode" component={GhostModeScreen} />
        <Stack.Screen name="Timetable" component={TimetableScreen} />
        <Stack.Screen name="TimetableSettings" component={TimetableSettingsScreen} />
        <Stack.Screen name="EditClass" component={EditClassScreen} />
        <Stack.Screen name="StudyGroups" component={StudyGroupsScreen} />
        <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
        <Stack.Screen name="GroupMembers" component={GroupMembersScreen} />
        <Stack.Screen name="GroupPolls" component={GroupPollsScreen} />
        <Stack.Screen name="GroupPosts" component={GroupPostsScreen} />
        <Stack.Screen name="GroupFiles" component={GroupFilesScreen} />
        <Stack.Screen name="StudySessions" component={StudySessionsScreen} />
        <Stack.Screen name="InviteToGroup" component={InviteToGroupScreen} />
        <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
        <Stack.Screen name="EditGroup" component={EditGroupScreen} />
        <Stack.Screen name="Events" component={EventsScreen} />
        <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
        <Stack.Screen name="EditEvent" component={EditEventScreen} />
        <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
        <Stack.Screen name="ListingDetails" component={ListingDetailsScreen} />
        <Stack.Screen name="CreateListing" component={CreateListingScreen} />
        <Stack.Screen name="ManageListings" component={ManageListingsScreen} />
        <Stack.Screen name="Weather" component={WeatherScreen} />
        <Stack.Screen name="WeatherDetails" component={WeatherDetailsScreen} />
        <Stack.Screen name="Trips" component={TripsScreen} />
        <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
        <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
        <Stack.Screen name="InviteToTrip" component={InviteToTripScreen} />
        <Stack.Screen name="TripItinerary" component={TripItineraryScreen} />
        <Stack.Screen name="TripVoting" component={TripVotingScreen} />
        <Stack.Screen name="TripExpenses" component={TripExpensesScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MyQR" component={MyQRScreen} />
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="GamesHub" component={GamesHubScreen} />
        <Stack.Screen name="Game2048" component={Game2048Screen} />
        <Stack.Screen name="Sudoku" component={SudokuScreen} />
        <Stack.Screen name="TicTacToe" component={TicTacToeScreen} />
        <Stack.Screen name="Snake" component={SnakeScreen} />
        <Stack.Screen name="MemoryMatch" component={MemoryMatchScreen} />
        <Stack.Screen name="WordGame" component={WordGameScreen} />
        <Stack.Screen name="ChessPuzzles" component={ChessPuzzlesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
