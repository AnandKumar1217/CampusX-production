import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENS = [
  "Splash", "OnboardingOne", "OnboardingTwo", "OnboardingThree", "Login", 
  "ForgotPassword", "ResetPassword", "SignupAccount", "SignupProfile", "SignupInterests",
  "Main", "Feed", "Friends", "FriendRequests", "PeopleSuggestions", "StoryViewer",
  "CreateStory", "Saved", "MyPosts", "CreatePost", "Reactions", "MutualFriends",
  "Conversation", "NewChat", "ChatInfo", "AIChat", "AIHistory", "AITools",
  "CampusMap", "LocationSettings", "GhostMode", "Timetable", "EditClass", "StudyGroups",
  "GroupDetails", "GroupMembers", "GroupPolls", "GroupFiles", "StudySessions", "InviteToGroup",
  "Events", "EditEvent", "Marketplace", "CreateListing", "ManageListings", "Weather",
  "WeatherDetails", "Trips", "CreateTrip", "InviteToTrip", "TripItinerary", "TripVoting",
  "TripExpenses", "Notifications", "MyQR", "Settings", "GamesHub", "Game2048", "Sudoku",
  "TicTacToe", "Snake", "MemoryMatch", "WordGame", "ChessPuzzles"
];

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'qa-evidence', 'antigravity-audit', 'runtime');

async function runAudit() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to 390x844 (Standard mobile)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  console.log(`Starting audit of ${SCREENS.length} screens...`);

  for (let i = 0; i < SCREENS.length; i++) {
    const screen = SCREENS[i];
    const url = screen === "Main" ? "http://localhost:8082/" : `http://localhost:8082/qa/${screen}`;
    console.log(`Navigating to [${i+1}/${SCREENS.length}] ${screen} at ${url}...`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
      // Small delay to allow react navigation animations to settle
      await new Promise(r => setTimeout(r, 1000));
      
      const fileName = `${String(i+1).padStart(2, '0')}-${screen.toLowerCase()}-runtime-390x844.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      
      await page.screenshot({ path: filePath });
      console.log(`Captured ${fileName}`);
    } catch (err) {
      console.error(`Failed to capture ${screen}:`, err.message);
    }
  }

  await browser.close();
  console.log('Audit complete.');
}

runAudit();
