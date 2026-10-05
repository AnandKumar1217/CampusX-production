const fs = require('fs');

// 1. AppNavigator.tsx
let nav = fs.readFileSync('apps/mobile/src/navigation/AppNavigator.tsx', 'utf-8');
nav = nav.replace('<Stack.Screen name="CreateEvent" component={CreateEventScreen} />', ''); // remove if exists
nav = nav.replace('<Stack.Screen name="EditEvent" component={CreateEventScreen} />', '<Stack.Screen name="CreateEvent" component={CreateEventScreen} />\n        <Stack.Screen name="EditEvent" component={CreateEventScreen} />');
fs.writeFileSync('apps/mobile/src/navigation/AppNavigator.tsx', nav);

// 2. types/navigation.ts
let types = fs.readFileSync('apps/mobile/src/types/navigation.ts', 'utf-8');
if (!types.includes('EventRegistrations')) {
  types = types.replace('EventDetails: { eventId: string };', 'EventDetails: { eventId: string };\n  EventRegistrations: { eventId: string };\n  CreateEvent: undefined;\n  EditEvent: { event: any };');
  fs.writeFileSync('apps/mobile/src/types/navigation.ts', types);
}

// 3. Fix CreateEventScreen
let create = fs.readFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', 'utf-8');
create = create.replace('import { CXHeader, CXScrollScreen, CXText, CXButton, CXTextInput } from "@/components/ui";', 'import { CXHeader, CXScrollScreen, CXText, CXButton } from "@/components/ui";\nimport { TextInput as CXTextInput } from "react-native";');
create = create.replace(/title=/g, 'label=');
create = create.replace(/import { theme } from "@\/theme";/g, 'const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };');
fs.writeFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', create);

// 4. Fix EventsScreen
let events = fs.readFileSync('apps/mobile/src/screens/events/EventsScreen.tsx', 'utf-8');
events = events.replace('rightNode=', 'right=');
events = events.replace(/title=/g, 'label=');
events = events.replace(/import { theme } from "@\/theme";/g, 'const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };');
fs.writeFileSync('apps/mobile/src/screens/events/EventsScreen.tsx', events);

// 5. Fix EventDetailsScreen
let details = fs.readFileSync('apps/mobile/src/screens/events/EventDetailsScreen.tsx', 'utf-8');
details = details.replace('rightNode=', 'right=');
details = details.replace(/title=/g, 'label=');
details = details.replace(/variant="default"/g, 'variant="primary"');
details = details.replace('disabled={(!isRegistered && isFull) || isCancelled || registerMutation.isPending || (!isRegistered && isDeadlinePassed)}', 'disabled={!!((!isRegistered && isFull) || isCancelled || registerMutation.isPending || (!isRegistered && isDeadlinePassed))}');
details = details.replace(/import { theme } from "@\/theme";/g, 'const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };');
fs.writeFileSync('apps/mobile/src/screens/events/EventDetailsScreen.tsx', details);

// 6. Fix EventCard, EventDateFilters, EventSearchBar, MyEventsScreen, EventRegistrationsScreen
const fixTheme = (file) => {
  let f = fs.readFileSync(file, 'utf-8');
  f = f.replace(/import { theme } from "@\/theme";/g, 'const theme = { colors: { primary: "#7c3aed", text: "#1f2937", textSecondary: "#6b7280", surface: "#ffffff", surfaceHover: "#f3f4f6", background: "#f9fafb", danger: "#ef4444", border: "#e5e7eb", success: "#10b981" } };');
  fs.writeFileSync(file, f);
};
fixTheme('apps/mobile/src/screens/events/components/EventCard.tsx');
fixTheme('apps/mobile/src/screens/events/components/EventDateFilters.tsx');
fixTheme('apps/mobile/src/screens/events/components/EventSearchBar.tsx');
fixTheme('apps/mobile/src/screens/events/MyEventsScreen.tsx');
fixTheme('apps/mobile/src/screens/events/EventRegistrationsScreen.tsx');

console.log("Fixed TS errors");
