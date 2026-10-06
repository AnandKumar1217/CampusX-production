import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'child_process';

async function runTests() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri() + 'campusx-test';
  
  console.log(`Started memory server at ${uri}`);
  
  try {
    const args = process.argv.slice(2);
    const testFiles = args.length > 0 ? args : ['tests/location.test.ts', 'tests/push.test.ts'];
    await new Promise((resolve, reject) => {
      const p = spawn('npx', ['vitest', 'run', ...testFiles], {
        env: { ...process.env, MONGODB_TEST_URI: uri },
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      p.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Exit code ${code}`));
      });
    });
  } catch (err) {
    console.error('Tests failed', err);
    process.exitCode = 1;
  } finally {
    await mongod.stop();
  }
}

runTests();
