import fs from 'fs';
let content = fs.readFileSync('apps/mobile/src/screens/commerce/CommerceScreens.tsx', 'utf8');

content = content.replace(/\{listing\.price\.toLocaleString\("en-IN"\)\}/g, '₹{listing.price.toLocaleString("en-IN")}');
content = content.replace(/\?\{listing\.price\.toLocaleString\("en-IN"\)\}/g, '₹{listing.price.toLocaleString("en-IN")}');

// Also for temp
content = content.replace(/\{temp\}C/g, '{temp}°C');
content = content.replace(/\{displayWeather\?\.temp \?\? "--"\}C/g, '{displayWeather?.temp ?? "--"}°C');
content = content.replace(/\$\{displayWeather\.temp\}C/g, '°C');


fs.writeFileSync('apps/mobile/src/screens/commerce/CommerceScreens.tsx', content);
