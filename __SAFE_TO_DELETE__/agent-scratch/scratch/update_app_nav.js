const fs = require('fs');
let code = fs.readFileSync('apps/mobile/src/navigation/AppNavigator.tsx', 'utf-8');

code = code.replace(/\s*EditEventScreen,\s*EventDetailsScreen,\s*EventsScreen,/, '');
code = code.replace(/\s*MyEventsScreen,/, '');

const newImports = `
import { EventsScreen } from '@/screens/events/EventsScreen';
import { EventDetailsScreen } from '@/screens/events/EventDetailsScreen';
import { CreateEventScreen } from '@/screens/events/CreateEventScreen';
import { MyEventsScreen } from '@/screens/events/MyEventsScreen';
`;

code = code.replace('import { CXBottomNav } from "@/components/navigation/CXBottomNav";', 'import { CXBottomNav } from "@/components/navigation/CXBottomNav";' + newImports);

code = code.replace('<Stack.Screen name="EditEvent" component={EditEventScreen} />', '<Stack.Screen name="EditEvent" component={CreateEventScreen} />');
if (!code.includes('<Stack.Screen name="CreateEvent"')) {
  code = code.replace('<Stack.Screen name="EditEvent"', '<Stack.Screen name="CreateEvent" component={CreateEventScreen} />\n        <Stack.Screen name="EditEvent"');
}

fs.writeFileSync('apps/mobile/src/navigation/AppNavigator.tsx', code);
