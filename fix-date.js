const fs = require('fs');
const file = 'apps/mobile/src/screens/commerce/CommerceScreens.tsx';
let content = fs.readFileSync(file, 'utf8');

const parseDateString = `  const parseExistingDate = () => {
    if (!existing || !existing.date || !existing.time) return new Date();
    const partsDate = existing.date.split('/');
    const partsTime = existing.time.match(/(\\d+):(\\d+)\\s*(AM|PM)/i);
    if (partsDate.length === 3 && partsTime) {
      let hrs = parseInt(partsTime[1], 10);
      if (partsTime[3].toUpperCase() === 'PM' && hrs < 12) hrs += 12;
      if (partsTime[3].toUpperCase() === 'AM' && hrs === 12) hrs = 0;
      return new Date(parseInt(partsDate[2], 10), parseInt(partsDate[1], 10) - 1, parseInt(partsDate[0], 10), hrs, parseInt(partsTime[2], 10));
    }
    return new Date();
  };`;

content = content.replace(
  '  const [showDatePicker, setShowDatePicker] = useState(false);',
  parseDateString + '\n  const [showDatePicker, setShowDatePicker] = useState(false);'
);

content = content.replace(
  '  const [dateObj, setDateObj] = useState(new Date());',
  '  const [dateObj, setDateObj] = useState(parseExistingDate());'
);

const oldOnDateChange = `  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const year = selectedDate.getFullYear();
      setForm((v) => ({ ...v, date: \`\${day}/\${month}/\${year}\` }));
    }
  };`;

const newOnDateChange = `  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === "set" && selectedDate) {
      setDateObj(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const year = selectedDate.getFullYear();
      setForm((v) => ({ ...v, date: \`\${day}/\${month}/\${year}\` }));
    }
  };`;

content = content.replace(oldOnDateChange, newOnDateChange);

const oldOnTimeChange = `  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setForm((v) => ({ ...v, time: \`\${String(hours).padStart(2, "0")}:\${minutes} \${ampm}\` }));
    }
  };`;

const newOnTimeChange = `  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === "set" && selectedDate) {
      setDateObj(selectedDate);
      let hours = selectedDate.getHours();
      const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      setForm((v) => ({ ...v, time: \`\${String(hours).padStart(2, "0")}:\${minutes} \${ampm}\` }));
    }
  };`;

content = content.replace(oldOnTimeChange, newOnTimeChange);

fs.writeFileSync(file, content);
console.log('done');
