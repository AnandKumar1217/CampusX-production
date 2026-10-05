const fs = require('fs');

const map = {
  'Calendar': 'calendar',
  'MapPin': 'location',
  'Users': 'people',
  'Search': 'search',
  'Bookmark': 'bookmark',
  'MoreVertical': 'ellipsis-vertical',
  'Edit2': 'pencil',
  'Trash2': 'trash',
  'XCircle': 'close-circle',
  'Share': 'share'
};

const replaceLucide = (file) => {
  if (!fs.existsSync(file)) return;
  let f = fs.readFileSync(file, 'utf-8');
  
  if (f.includes('lucide-react-native')) {
    f = f.replace(/import\s+\{[^}]+\}\s+from\s+["']lucide-react-native["'];/g, 'import { Ionicons } from "@expo/vector-icons";');
    
    // Replace <IconName ... /> with <Ionicons name="mapped-name" ... />
    for (const [lucide, ion] of Object.entries(map)) {
      const regex = new RegExp('<' + lucide + '\\s+([^>]*)>', 'g');
      f = f.replace(regex, '<Ionicons name="' + ion + '" $1 >');
      const regex2 = new RegExp('<' + lucide + '\\s*/>', 'g');
      f = f.replace(regex2, '<Ionicons name="' + ion + '" />');
    }
    fs.writeFileSync(file, f);
  }
};

const files = [
  'apps/mobile/src/screens/events/components/EventCard.tsx',
  'apps/mobile/src/screens/events/components/EventSearchBar.tsx',
  'apps/mobile/src/screens/events/EventDetailsScreen.tsx',
];

files.forEach(replaceLucide);
console.log('Replaced lucide-react-native with Ionicons');
