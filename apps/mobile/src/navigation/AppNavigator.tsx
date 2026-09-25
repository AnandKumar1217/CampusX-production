import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef, consumePendingRoute } from "./PushRoutingManager";

import { CXBottomNav } from "@/components/navigation/CXBottomNav";
import {
  AIChatScreen,
  AIHistoryScreen,
  ChatInfoScreen,
  ConversationScreen,
  NewChatScreen,
  CreateChatGroupScreen,
  CreateChatGroupDetailsScreen,
} from "@/screens/chat/ChatScreens";
import {
  EditClassScreen,
  LocationSettingsScreen,
  TimetableScreen,
  TimetableSettingsScreen,
  TimetableReviewScreen,
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
  GamesHubScreen,
  AirHockeyScreen,
  ReactionBattleScreen,
  TicTacToeGlowScreen,
} from "@/screens/games";
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
  PeopleScreen,
  GlobalUsersScreen,
  FriendsScreen,
  CreatePostScreen,
  MutualFriendsScreen,
  MyPostsScreen,
  MyEventsScreen,
  PeopleSuggestionsScreen,
  PostDetailsScreen,
  ReactionsScreen,
  SavedScreen,
  UserProfileScreen,
} from "@/screens/social/SocialScreens";
import {
  CreateTripScreen,
  EditTripScreen,
  InviteToTripScreen,
  TripDetailsScreen,
  TripsScreen,
} from "@/screens/trips/TripScreens";
import {
  MyQRScreen,
  NotificationsScreen,
  QRScannerScreen,
  SettingsScreen,
} from "@/screens/utilities/UtilityScreens";
import { SGPACalculatorScreen } from "@/screens/utilities/SGPACalculatorScreen";
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
      GroupDetails: "group/:groupId",
      QRScanner: "scan",
    },
  },
};

import { useLiveLocationWatcher } from "@/hooks/useLiveLocationWatcher";

export function AppNavigator() {
  useLiveLocationWatcher();

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        const pending = consumePendingRoute();
        if (pending) {
          // @ts-ignore
          navigationRef.navigate(pending.screen, pending.params);
        }
      }}
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
        <Stack.Screen name="People" component={PeopleScreen} />
        <Stack.Screen
          name="PeopleSuggestions"
          component={PeopleSuggestionsScreen}
        />
        <Stack.Screen name="GlobalUsers" component={GlobalUsersScreen} />
        <Stack.Screen name="Saved" component={SavedScreen} />
        <Stack.Screen name="MyPosts" component={MyPostsScreen} />
        <Stack.Screen name="MyEvents" component={MyEventsScreen} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} />
        <Stack.Screen name="Reactions" component={ReactionsScreen} />
        <Stack.Screen name="MutualFriends" component={MutualFriendsScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
        <Stack.Screen name="GroupConversation" component={ConversationScreen as any} />
        <Stack.Screen name="NewChat" component={NewChatScreen} />
        <Stack.Screen name="ChatInfo" component={ChatInfoScreen} />
        <Stack.Screen name="CreateChatGroup" component={CreateChatGroupScreen} />
        <Stack.Screen name="CreateChatGroupDetails" component={CreateChatGroupDetailsScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="AIHistory" component={AIHistoryScreen} />

        <Stack.Screen
          name="LocationSettings"
          component={LocationSettingsScreen}
        />

        <Stack.Screen name="Timetable" component={TimetableScreen} />
        <Stack.Screen name="TimetableSettings" component={TimetableSettingsScreen} />
        <Stack.Screen name="TimetableReview" component={TimetableReviewScreen} />
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
        <Stack.Screen name="EditTrip" component={EditTripScreen} />
        <Stack.Screen name="InviteToTrip" component={InviteToTripScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MyQR" component={MyQRScreen} />
        <Stack.Screen
          name="SGPACalculator"
          component={SGPACalculatorScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ animation: "fade" }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="GamesHub" component={GamesHubScreen} />
        <Stack.Screen name="AirHockey" component={AirHockeyScreen} />
        <Stack.Screen name="ReactionBattle" component={ReactionBattleScreen} />
        <Stack.Screen name="TicTacToeGlow" component={TicTacToeGlowScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
