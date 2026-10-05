const fs = require('fs');

// Fix AppNavigator
let nav = fs.readFileSync('apps/mobile/src/navigation/AppNavigator.tsx', 'utf-8');
// It complains about "CreateEvent" not in RootStackParamList. It is in types/navigation.ts, let's make sure it's exported and imported right, or just ignore since we added it to types/navigation.ts. Wait, it complained again. Let's make sure.
nav = nav.replace(/<Stack.Screen name="CreateEvent" component={CreateEventScreen} \/>/g, ''); // remove duplicates
nav = nav.replace('<Stack.Screen name="EditEvent" component={CreateEventScreen} />', '<Stack.Screen name="CreateEvent" component={CreateEventScreen} />\n        <Stack.Screen name="EditEvent" component={CreateEventScreen} />');
fs.writeFileSync('apps/mobile/src/navigation/AppNavigator.tsx', nav);

// Fix CreateEventScreen
let createEvent = fs.readFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', 'utf-8');
createEvent = createEvent.replace(/<CXButton([^>]+)title=/g, '<CXButton$1label=');
createEvent = createEvent.replace(/<CustomInput([^>]+)title=/g, '<CustomInput$1label=');
createEvent = createEvent.replace(/const CustomInput = \(\{title/g, 'const CustomInput = ({label');
createEvent = createEvent.replace(/\{title\}<\/CXText>/g, '{label}</CXText>');
// add type to v
createEvent = createEvent.replace(/onChangeText={\(v\)/g, 'onChangeText={(v: string)');
fs.writeFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', createEvent);

// Fix EventDetailsScreen
let eventDetails = fs.readFileSync('apps/mobile/src/screens/events/EventDetailsScreen.tsx', 'utf-8');
eventDetails = eventDetails.replace(/<CXButton([^>]+)title=/g, '<CXButton$1label=');
eventDetails = eventDetails.replace(/variant="default"/g, 'variant="primary"');
fs.writeFileSync('apps/mobile/src/screens/events/EventDetailsScreen.tsx', eventDetails);

// Fix EventsScreen
let eventsScreen = fs.readFileSync('apps/mobile/src/screens/events/EventsScreen.tsx', 'utf-8');
eventsScreen = eventsScreen.replace(/<CXButton([^>]+)title=/g, '<CXButton$1label=');
fs.writeFileSync('apps/mobile/src/screens/events/EventsScreen.tsx', eventsScreen);

console.log("Fixed button labels");
