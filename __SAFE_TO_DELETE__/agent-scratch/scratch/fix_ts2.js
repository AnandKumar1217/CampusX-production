const fs = require('fs');

function fix(file) {
  let f = fs.readFileSync(file, 'utf-8');
  f = f.replace(/label=/g, 'title=');
  f = f.replace(/sublabel=/g, 'subtitle=');
  
  // MyEventsScreen: remove e.organizer?._id
  f = f.replace(/ \|\| e\.organizer\?\._id === user\?\.id/g, '');
  // EventDetailsScreen: remove event?.organizer?._id
  f = f.replace(/ \|\| event\?\.organizer\?\._id === user\?\.id/g, '');
  // attendee record: remove a.user?._id
  f = f.replace(/ \|\| a\.user\?\._id === user\?\.id/g, '');
  
  // Fix CXButton variant default to primary
  f = f.replace(/variant="default"/g, 'variant="primary"');

  // Fix CXButton size
  f = f.replace(/size="small"/g, '');

  fs.writeFileSync(file, f);
}

fix('apps/mobile/src/screens/events/EventDetailsScreen.tsx');
fix('apps/mobile/src/screens/events/MyEventsScreen.tsx');
fix('apps/mobile/src/screens/events/EventsScreen.tsx');
fix('apps/mobile/src/screens/events/CreateEventScreen.tsx');

let createEvent = fs.readFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', 'utf-8');
if (!createEvent.includes('function CustomInput')) {
  createEvent = createEvent.replace('import { TextInput as CXTextInput } from "react-native";', 'import { TextInput, View as RNView } from "react-native";\nconst CustomInput = ({title, ...props}: any) => (<RNView style={{marginBottom: 16}}><CXText variant="caption" style={{marginBottom: 4, fontWeight: "600"}}>{title}</CXText><TextInput style={{borderWidth: 1, borderColor: "#e5e7eb", padding: 12, borderRadius: 8, backgroundColor: "#fff"}} {...props} /></RNView>);');
  createEvent = createEvent.replace(/<CXTextInput/g, '<CustomInput');
  createEvent = createEvent.replace(/<\/CXTextInput>/g, '</CustomInput>');
  fs.writeFileSync('apps/mobile/src/screens/events/CreateEventScreen.tsx', createEvent);
}

console.log("Fixed errors");
