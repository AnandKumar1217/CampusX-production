const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles('src/features/games/games');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (!content.includes('import { CommonActions }') && content.includes('onQuit={')) {
    content = 'import { CommonActions } from "@react-navigation/native";\n' + content;
    changed = true;
  }
  
  const replaceTarget = /onQuit=\{\(\) => \{\s*setIsPaused\(false\);\s*navigation\.goBack\(\);\s*\}\}/g;
  
  const newQuit = `onQuit={() => {
          setIsPaused(false);
          navigation.dispatch((state) => {
            const hubIndex = state.routes.findIndex((r) => r.name === 'GamesHub');
            if (hubIndex !== -1) {
              return CommonActions.reset({
                ...state,
                routes: state.routes.slice(0, hubIndex + 1),
                index: hubIndex,
              });
            }
            return CommonActions.navigate('GamesHub');
          });
        }}`;
        
  if (content.match(replaceTarget)) {
    content = content.replace(replaceTarget, newQuit);
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
console.log('Done');
