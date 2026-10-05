const fs = require('fs');

const files = [
  'src/features/games/games/checkers/CheckersScreen.tsx',
  'src/features/games/games/chess/ChessScreen.tsx',
  'src/features/games/games/reversi/ReversiScreen.tsx',
  'src/features/games/games/mancala/MancalaScreen.tsx',
  'src/features/games/games/dotsAndBoxes/DotsAndBoxesScreen.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Remove the import
  content = content.replace(/import \{ GameResultScreen \} from "\.\.\/\.\.\/components\/GameResultScreen";\r?\n?/g, '');
  content = content.replace(/import \{ GameResultScreen \} from "\.\.\/components\/GameResultScreen";\r?\n?/g, ''); // just in case

  // Remove the inline JSX
  content = content.replace(/\{winner && \(\s*<GameResultScreen[\s\S]*?\/>\s*\)\}\r?\n?/g, '');

  // Add the setTimeout to handleRoundEnd if it doesn't exist
  if (!content.includes('setTimeout(() => {\n      handleRematch();\n    }, 2000);')) {
    content = content.replace(
      /setWinner\(gameWinner\);\r?\n?(\s*)\};/g,
      'setWinner(gameWinner);\n$1setTimeout(() => {\n$1  handleRematch();\n$1}, 2000);\n$1};'
    );
  }

  fs.writeFileSync(file, content);
}
console.log('Fixed imports and removed inline GameResultScreen overlays.');
