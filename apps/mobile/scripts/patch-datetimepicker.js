/* global __dirname */
const fs = require('fs');
const path = require('path');

const packagePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-community',
  'datetimepicker'
);

// Render installs only the backend workspace. Absence of the mobile dependency
// is intentional there; a present-but-incompatible dependency must still fail.
if (!fs.existsSync(packagePath)) {
  console.log('datetimepicker patch skipped: mobile dependency not installed');
  process.exit(0);
}

// 1. Keep the native module metadata aligned with the active RN architecture.
// Forcing these modules to legacy mode makes them unavailable under RN's New
// Architecture, while BuildConfig preserves compatibility with both modes.
const targetJavaFile = path.join(
  packagePath,
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactcommunity',
  'rndatetimepicker',
  'RNDateTimePickerPackage.java'
);

if (fs.existsSync(targetJavaFile)) {
  let content = fs.readFileSync(targetJavaFile, 'utf8');
  if (content.includes('boolean isTurboModule = false; // Force fallback to legacy NativeModules to bypass Expo C++ autolinking bug')) {
    content = content.replace(
      'boolean isTurboModule = false; // Force fallback to legacy NativeModules to bypass Expo C++ autolinking bug',
      'boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;'
    );
    fs.writeFileSync(targetJavaFile, content, 'utf8');
    console.log('Restored architecture-aware RNDateTimePicker native module registration.');
  } else if (content.includes('boolean isTurboModule = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;')) {
    console.log('RNDateTimePicker native module registration is architecture-aware.');
  } else {
    throw new Error('Target string not found in RNDateTimePickerPackage.java! Layout or content has changed.');
  }
} else {
  throw new Error(`Target file ${targetJavaFile} not found! Patch failed.`);
}

// 2. Patch JS spec files to fallback to NativeModules gracefully
const specsDir = path.join(packagePath, 'src', 'specs');
const specFiles = [
  'NativeModuleDatePicker.js',
  'NativeModuleMaterialDatePicker.js',
  'NativeModuleMaterialTimePicker.js',
  'NativeModuleTimePicker.js'
];

let jsPatchedCount = 0;
let jsAlreadyPatchedCount = 0;
let filesFound = 0;

specFiles.forEach(file => {
  const filePath = path.join(specsDir, file);
  if (fs.existsSync(filePath)) {
    filesFound++;
    let content = fs.readFileSync(filePath, 'utf8');
    const regex = /TurboModuleRegistry\.getEnforcing<Spec>\(\s*'([^']+)'\s*,?\s*\)/g;
    if (regex.test(content)) {
      content = content.replace(
        regex,
        "(TurboModuleRegistry.get<Spec>('$1') || require('react-native').NativeModules.$1)"
      );
      fs.writeFileSync(filePath, content, 'utf8');
      jsPatchedCount++;
    } else if (content.includes('NativeModules.')) {
      jsAlreadyPatchedCount++;
    }
  }
});

if (filesFound === 0) {
  throw new Error('No JS spec files found! Layout has changed.');
}

if (jsPatchedCount > 0) {
  console.log(`Successfully patched ${jsPatchedCount} JS spec files for graceful NativeModules fallback.`);
} else if (jsAlreadyPatchedCount === filesFound) {
  console.log('All JS spec files already patched.');
} else {
  throw new Error('Could not patch JS spec files. Target getEnforcing not found and not already patched.');
}
