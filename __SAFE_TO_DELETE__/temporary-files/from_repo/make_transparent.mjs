import fs from 'fs';
import { PNG } from 'pngjs';

const inputPath = 'apps/mobile/assets/branding/campusx-logo-new.png';
const outputPath = 'apps/mobile/assets/branding/campusx-logo-new-transparent.png';

fs.createReadStream(inputPath)
  .pipe(new PNG())
  .on('parsed', function() {
    const width = this.width;
    const height = this.height;

    // We'll do a simple flood fill from (0,0) assuming it's the background color
    const visited = new Uint8Array(width * height);
    const queue = [[0, 0]];
    
    // Get background color at (0,0)
    const idx0 = 0;
    const bgR = this.data[idx0];
    const bgG = this.data[idx0 + 1];
    const bgB = this.data[idx0 + 2];

    const isSimilar = (r, g, b) => {
      // Allow some tolerance for compression artifacts
      return Math.abs(r - bgR) < 15 && Math.abs(g - bgG) < 15 && Math.abs(b - bgB) < 15;
    };

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (width * y + x) << 2;
      const vIdx = width * y + x;
      
      if (visited[vIdx]) continue;
      visited[vIdx] = 1;

      const r = this.data[idx];
      const g = this.data[idx + 1];
      const b = this.data[idx + 2];

      if (isSimilar(r, g, b)) {
        // Make transparent
        this.data[idx + 3] = 0;
        
        // Add neighbors
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }

    // Also, to ensure smooth edges, any pixel that is near white but not removed can be anti-aliased, 
    // or we can just apply a simple pass to soften edges.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        if (this.data[idx + 3] !== 0) {
          const r = this.data[idx];
          const g = this.data[idx + 1];
          const b = this.data[idx + 2];
          // If it's very white (like the book), and we didn't touch it, leave it.
          // If it's an edge pixel (near a transparent pixel), maybe soften it? 
          // We'll leave it as is for now.
        }
      }
    }

    this.pack().pipe(fs.createWriteStream(outputPath)).on('finish', () => {
      console.log('Successfully made background transparent.');
    });
  })
  .on('error', (err) => {
    console.error('Error processing image:', err);
  });
