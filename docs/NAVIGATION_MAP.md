# CampusX Navigation Map

## Root state

```text
Splash
├─ first launch → Onboarding 1 → Onboarding 2 → Onboarding 3 → Login / Signup
├─ signed out, returning → Login
└─ valid session → App tabs → Home
```

## Main tabs

| Tab      | Root screen | Important descendants                                     |
| -------- | ----------- | --------------------------------------------------------- |
| Home     | Home        | Feed, Events, Weather, Timetable, Notifications, CampusAI |
| Discover | Discover    | Campus Map, user profile, groups, marketplace, events     |
| Create   | Create Hub  | Create Post, Story, Group, Event, Listing, Trip           |
| Chats    | Chats       | Conversation, New Chat, Chat Info, CampusAI               |
| Profile  | Profile     | Friends, Requests, Saved, My Posts, QR, Settings, Games   |

All routes live in one typed root stack. The five tab roots render through a shared `CXBottomNav`; detail routes hide the bottom bar unless the reference displays it.

## Core action mapping

| Action                   | Result                                          |
| ------------------------ | ----------------------------------------------- |
| Login / Create account   | Persist secure session and open Home            |
| Home quick action        | Open corresponding module                       |
| User row / avatar        | Open user profile                               |
| Add friend               | Create pending friend request                   |
| Message                  | Open/create conversation                        |
| Feed card                | Open post details                               |
| Save / react             | Mutate server state optimistically              |
| Map privacy / Ghost Mode | Update location-sharing settings                |
| Timetable add/edit       | Open class form; save recurring entry           |
| Group tabs               | Members, polls, files, sessions                 |
| Marketplace CTA          | Create/update listing or contact seller         |
| Trip tabs                | Itinerary, voting, invitations, expenses        |
| QR scan                  | Resolve safe CampusX deep link and open profile |
| Game tile                | Open playable local game route                  |
