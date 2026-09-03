# CampusX Design Reference Manifest

## Audit result

- Canonical PNG files found: **74**
- Reference group 01–60: **941 × 1672 px**
- Reference group 61–74: **1080 × 1920 px**
- Both groups use an approximately **9:16** phone canvas.
- Duplicate numeric prefix `42` is intentional: Group Members and Group Polls are separate screens.
- No canonical `43` filename exists.
- Signup Step 3 says “Step 3 of 4”, but no fourth signup reference exists. The third screen completes registration until a fourth approved design is supplied.

## Visual system

| Token family   | Canonical direction                                               |
| -------------- | ----------------------------------------------------------------- |
| Primary        | Violet/purple gradient, approximately `#5F38F1` → `#8B5CF6`       |
| Background     | Cool near-white, approximately `#FBFBFD`                          |
| Main text      | Ink/navy, approximately `#0F0E23`                                 |
| Secondary text | Cool gray, approximately `#656191`                                |
| Border         | Pale lavender-gray, approximately `#E3DDF6`                       |
| Surfaces       | White cards, soft lavender highlights, subtle shadows             |
| Shape          | Rounded cards and fields; pill filters; prominent rounded CTAs    |
| Typography     | Poppins-style display headings with an Inter-style UI/body system |

## Asset policy

The original screenshots remain unchanged under `assets-reference/original/`. Only genuine graphical regions—logo, onboarding illustrations, photos, and decorative artwork—may be extracted into `apps/mobile/assets/`. Text, controls, cards, navigation, fields, lists, and game boards must be native components.

## Canonical registry

|   # | Reference filename                  | Semantic route    | Module      |
| --: | ----------------------------------- | ----------------- | ----------- |
|  01 | 01 splash.png                       | Splash            | Auth        |
|  02 | 02 onboarding.png                   | OnboardingOne     | Auth        |
|  03 | 03 onboarding.png                   | OnboardingTwo     | Auth        |
|  04 | 04 onboarding.png                   | OnboardingThree   | Auth        |
|  05 | 05 login.png                        | Login             | Auth        |
|  06 | 06 forget pass.png                  | ForgotPassword    | Auth        |
|  07 | 07 reset pass.png                   | ResetPassword     | Auth        |
|  08 | 08 signup.png                       | SignupAccount     | Auth        |
|  09 | 09 signup.png                       | SignupProfile     | Auth        |
|  10 | 10 signup.png                       | SignupInterests   | Auth        |
|  11 | 11 home.png                         | Home              | Main        |
|  12 | 12 discovery.png                    | Discover          | Main        |
|  13 | 13 create tab.png                   | CreateHub         | Main        |
|  14 | 14 chats.png                        | Chats             | Main        |
|  15 | 15 profile.png                      | Profile           | Main        |
|  16 | 16 feed.png                         | Feed              | Social      |
|  17 | 17 post details.png                 | PostDetails       | Social      |
|  18 | 18 other user details.png           | UserProfile       | Social      |
|  19 | 19 friends.png                      | Friends           | Social      |
|  20 | 20 friend requests.png              | FriendRequests    | Social      |
|  21 | 21 People You May Know.png          | PeopleSuggestions | Social      |
|  22 | 22 Story Viewer.png                 | StoryViewer       | Social      |
|  23 | 23 Create Story.png                 | CreateStory       | Social      |
|  24 | 24 saved.png                        | Saved             | Social      |
|  25 | 25 My Post.png                      | MyPosts           | Social      |
|  26 | 26 create post.png                  | CreatePost        | Social      |
|  27 | 27 reactions.png                    | Reactions         | Social      |
|  28 | 28 mutual friends.png               | MutualFriends     | Social      |
|  29 | 29 conversation screem.png          | Conversation      | Chat        |
|  30 | 30 new chat orselect friend.png     | NewChat           | Chat        |
|  31 | 31 chat info.png                    | ChatInfo          | Chat        |
|  32 | 32 Ai chat.png                      | AIChat            | AI          |
|  33 | 33 ai coversation history.png       | AIHistory         | AI          |
|  34 | 34 ai tools.png                     | AITools           | AI          |
|  35 | 35 campus map.png                   | CampusMap         | Location    |
|  36 | 36 location settings.png            | LocationSettings  | Location    |
|  37 | 37 ghost mode.png                   | GhostMode         | Location    |
|  38 | 38 time table.png                   | Timetable         | Timetable   |
|  39 | 39 add or edit class.png            | EditClass         | Timetable   |
|  40 | 40 study groups.png                 | StudyGroups       | Groups      |
|  41 | 41 group details.png                | GroupDetails      | Groups      |
| 42A | 42 group members.png                | GroupMembers      | Groups      |
| 42B | 42 group polls.png                  | GroupPolls        | Groups      |
|  44 | 44 group files and notes.png        | GroupFiles        | Groups      |
|  45 | 45 study sessions.png               | StudySessions     | Groups      |
|  46 | 46 intive to group.png              | InviteToGroup     | Groups      |
|  47 | 47 event list.png                   | Events            | Events      |
|  48 | 48 event details.png                | EventDetails      | Events      |
|  49 | 49 create event or edit.png         | EditEvent         | Events      |
|  50 | 50 market place.png                 | Marketplace       | Marketplace |
|  51 | 51 market place itemss.png          | ListingDetails    | Marketplace |
|  52 | 52 create listing.png               | CreateListing     | Marketplace |
|  53 | 53 edit or manage listing.png       | ManageListings    | Marketplace |
|  54 | 54 weather.png                      | Weather           | Weather     |
|  55 | 55 weather and forecast details.png | WeatherDetails    | Weather     |
|  56 | 56 trips.png                        | Trips             | Trips       |
|  57 | 57 trip details.png                 | TripDetails       | Trips       |
|  58 | 58 create trip or trip planner.png  | CreateTrip        | Trips       |
|  59 | 59 invite to trip.png               | InviteToTrip      | Trips       |
|  60 | 60 trip itinerary.png               | TripItinerary     | Trips       |
|  61 | 61_Trip_Voting.png                  | TripVoting        | Trips       |
|  62 | 62_Trip_Expenses_Settlements.png    | TripExpenses      | Trips       |
|  63 | 63_Notifications_Center.png         | Notifications     | Utilities   |
|  64 | 64_My_CampusX_QR.png                | MyQR              | Utilities   |
|  65 | 65_QR_Scanner.png                   | QRScanner         | Utilities   |
|  66 | 66_Settings.png                     | Settings          | Utilities   |
|  67 | 67_Games_Hub.png                    | GamesHub          | Games       |
|  68 | 68_2048.png                         | Game2048          | Games       |
|  69 | 69_Sudoku.png                       | Sudoku            | Games       |
|  70 | 70_Tic_Tac_Toe.png                  | TicTacToe         | Games       |
|  71 | 71_Snake.png                        | Snake             | Games       |
|  72 | 72_Memory_Match.png                 | MemoryMatch       | Games       |
|  73 | 73_Word_Game.png                    | WordGame          | Games       |
|  74 | 74_Chess_Puzzles.png                | ChessPuzzles      | Games       |
