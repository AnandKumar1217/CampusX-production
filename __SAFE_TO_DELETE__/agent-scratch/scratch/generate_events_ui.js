const fs = require('fs');
const path = require('path');

const baseDir = 'apps/mobile/src/screens/events';
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

const files = {
  'EventsScreen.tsx': `import React, { useState, useMemo, useEffect } from "react";
import { View, FlatList, RefreshControl, Pressable } from "react";
import { CXScrollScreen, CXText, CXButton, CXHeader } from "@/components/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/eventService";
import { EventCard } from "./components/EventCard";
import { EventDateFilters } from "./components/EventDateFilters";
import { EventSearchBar } from "./components/EventSearchBar";
import { useAppStore } from "@/store/appStore";

export function EventsScreen({ navigation }: any) {
  return (
    <CXScrollScreen>
      <CXHeader title="Events" subtitle="Find what's happening on campus" />
      <CXText>Under Construction</CXText>
    </CXScrollScreen>
  );
}
`,
  'EventDetailsScreen.tsx': `import React from "react";
import { View } from "react";
import { CXScrollScreen, CXText, CXHeader } from "@/components/ui";

export function EventDetailsScreen({ navigation, route }: any) {
  return (
    <CXScrollScreen>
      <CXHeader title="Event Details" onBack={() => navigation.goBack()} />
      <CXText>Details</CXText>
    </CXScrollScreen>
  );
}
`,
  'CreateEventScreen.tsx': `import React from "react";
import { View } from "react";
import { CXScrollScreen, CXText, CXHeader } from "@/components/ui";

export function CreateEventScreen({ navigation, route }: any) {
  return (
    <CXScrollScreen>
      <CXHeader title="Create Event" onBack={() => navigation.goBack()} />
      <CXText>Create Form</CXText>
    </CXScrollScreen>
  );
}
`,
  'MyEventsScreen.tsx': `import React from "react";
import { View } from "react";
import { CXScrollScreen, CXText, CXHeader } from "@/components/ui";

export function MyEventsScreen({ navigation }: any) {
  return (
    <CXScrollScreen>
      <CXHeader title="My Events" onBack={() => navigation.goBack()} />
      <CXText>Owner Events</CXText>
    </CXScrollScreen>
  );
}
`,
  'components/EventCard.tsx': `import React from "react";
import { View, Pressable } from "react-native";
import { CXText } from "@/components/ui";

export function EventCard({ event, onPress }: any) {
  return (
    <Pressable onPress={onPress}>
      <CXText>{event.title}</CXText>
    </Pressable>
  );
}
`,
  'components/EventDateFilters.tsx': `import React from "react";
import { View } from "react-native";

export function EventDateFilters() {
  return <View />;
}
`,
  'components/EventSearchBar.tsx': `import React from "react";
import { View } from "react-native";

export function EventSearchBar() {
  return <View />;
}
`
};

for (const [filename, content] of Object.entries(files)) {
  const fullPath = path.join(baseDir, filename);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
}

console.log("Created scaffolding in " + baseDir);
