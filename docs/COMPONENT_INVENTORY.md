# CampusX Component Inventory

## Foundation

- `CXScreen`, `CXScrollScreen`, `CXKeyboardScreen`, `CXRow`
- `CXText`
- `CXButton`, `CXIconButton`
- `CXInput`, `CXSearchBar`
- `CXCard`, `CXChip`, `CXAvatar`
- `CXHeader`, `CXSectionHeader`, `CXBottomNav`
- `CXListRow`, `CXState`

## Domain components

- Social: `CXStoryAvatar`, `CXPostCard`, `CXUserRow`
- Commerce: `CXEventCard`, `CXListingCard`
- Trips: `CXTripCard`
- Module-specific chat, group, timetable, utility, and game patterns stay local where they are not reused across domains.

The implementation reuses domain components when visual patterns repeat and keeps one-off layouts local to their module.
