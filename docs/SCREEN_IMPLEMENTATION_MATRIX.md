# CampusX Screen Implementation Matrix

Updated: 2026-08-30

Legend: `PASS`, `PARTIAL`, `BLOCKED`, `NOT VERIFIED`.

- `UI PASS` means a semantic React Native screen exists and compiles; it does not mean pixel review passed.
- `Responsive PARTIAL` means flex/scroll/safe-area behavior is implemented but the multi-device capture matrix has not been executed.
- `Pixel NOT VERIFIED` is an explicit release gate, not an implementation omission.

|   # | Semantic route    | UI   | Asset policy | Navigation | Responsive | Pixel review |
| --: | ----------------- | ---- | ------------ | ---------- | ---------- | ------------ |
|  01 | Splash            | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  02 | OnboardingOne     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  03 | OnboardingTwo     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  04 | OnboardingThree   | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  05 | Login             | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  06 | ForgotPassword    | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  07 | ResetPassword     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  08 | SignupAccount     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  09 | SignupProfile     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  10 | SignupInterests   | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  11 | Home              | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  12 | Discover          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  13 | CreateHub         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  14 | Chats             | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  15 | Profile           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  16 | Feed              | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  17 | PostDetails       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  18 | UserProfile       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  19 | Friends           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  20 | FriendRequests    | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  21 | PeopleSuggestions | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  22 | StoryViewer       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  23 | CreateStory       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  24 | Saved             | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  25 | MyPosts           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  26 | CreatePost        | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  27 | Reactions         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  28 | MutualFriends     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  29 | Conversation      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  30 | NewChat           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  31 | ChatInfo          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  32 | AIChat            | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  33 | AIHistory         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  34 | AITools           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  35 | CampusMap         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  36 | LocationSettings  | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  37 | GhostMode         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  38 | Timetable         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  39 | EditClass         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  40 | StudyGroups       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  41 | GroupDetails      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
| 42A | GroupMembers      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
| 42B | GroupPolls        | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  44 | GroupFiles        | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  45 | StudySessions     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  46 | InviteToGroup     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  47 | Events            | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  48 | EventDetails      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  49 | EditEvent         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  50 | Marketplace       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  51 | ListingDetails    | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  52 | CreateListing     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  53 | ManageListings    | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  54 | Weather           | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  55 | WeatherDetails    | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  56 | Trips             | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  57 | TripDetails       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  58 | CreateTrip        | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  59 | InviteToTrip      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  60 | TripItinerary     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  61 | TripVoting        | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  62 | TripExpenses      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  63 | Notifications     | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  64 | MyQR              | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  65 | QRScanner         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  66 | Settings          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  67 | GamesHub          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  68 | Game2048          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  69 | Sudoku            | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  70 | TicTacToe         | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  71 | Snake             | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  72 | MemoryMatch       | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  73 | WordGame          | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |
|  74 | ChessPuzzles      | PASS | PASS         | PASS       | PARTIAL    | NOT VERIFIED |

All 74 rows correspond one-to-one with `DESIGN_REFERENCE_MANIFEST.md`. The missing canonical filename `43` and duplicate `42` prefix are preserved rather than renumbered.
