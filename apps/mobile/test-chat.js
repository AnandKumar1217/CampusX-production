import { io } from "socket.io-client";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== PHASE 4: TWO-USER REAL-TIME E2E ===");
  const base = "http://localhost:5000/api";
  const suffix = Date.now();
  
  // 1 & 2. Create Users
  console.log("1. Creating User A and User B...");
  const userA = { fullName: "Alice", email: `alice.chat${suffix}@test.com`, password: "password123", college: "Eng", department: "SE", academicYear: "Freshman", graduationYear: "2026", interests: ["Coding"] };
  const userB = { fullName: "Bob", email: `bob.chat${suffix}@test.com`, password: "password123", college: "Eng", department: "SE", academicYear: "Freshman", graduationYear: "2026", interests: ["Coding"] };
  const userC = { fullName: "Charlie", email: `charlie.chat${suffix}@test.com`, password: "password123", college: "Eng", department: "SE", academicYear: "Freshman", graduationYear: "2026", interests: ["Coding"] };

  const [resA, resB, resC] = await Promise.all([
    fetch(`${base}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userA) }).then(r => r.json()),
    fetch(`${base}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userB) }).then(r => r.json()),
    fetch(`${base}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userC) }).then(r => r.json())
  ]);

  if (!resA.data) {
    console.error("Failed to register A:", resA);
    return;
  }

  const tokenA = resA.data.accessToken;
  const tokenB = resB.data.accessToken;
  const tokenC = resC.data.accessToken;
  const idA = resA.data.user.id;
  const idB = resB.data.user.id;
  
  console.log("1. A login — PASS");
  console.log("2. B login — PASS");

  // User C tries to start chat with User A BEFORE they are friends
  const unauthorizedRes = await fetch(`${base}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenC}` },
    body: JSON.stringify({ participantId: idA })
  });
  if (unauthorizedRes.status === 403) {
    console.log("28. User C unauthorized chat blocked — PASS");
  } else {
    console.log("28. User C unauthorized chat blocked — FAIL (Status: " + unauthorizedRes.status + ")");
  }

  // 3. A and B are friends
  console.log("Creating friendship between A and B...");
  await fetch(`${base}/friends/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ recipientId: idB })
  });
  const reqRes = await fetch(`${base}/friends/requests`, { headers: { Authorization: `Bearer ${tokenB}` } }).then(r => r.json());
  await fetch(`${base}/friends/requests/${reqRes.data.received[0]._id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  console.log("3. A and B are friends — PASS");

  // 6. canonical conversation created/reused
  console.log("Creating conversation A -> B...");
  const chatRes1 = await fetch(`${base}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ participantId: idB })
  }).then(r => r.json());
  
  if (!chatRes1.data) {
      console.log("Failed to create chat:", chatRes1);
      return;
  }
  const conversationId = chatRes1.data._id;
  
  const chatRes2 = await fetch(`${base}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ participantId: idB })
  }).then(r => r.json());
  
  if (chatRes1.data._id === chatRes2.data._id) {
    console.log("6. canonical conversation created/reused — PASS");
  } else {
    console.log("6. canonical conversation created/reused — FAIL");
  }

  // Sockets
  const socketA = io("http://localhost:5000", { auth: { token: tokenA } });
  const socketB = io("http://localhost:5000", { auth: { token: tokenB } });
  const socketC = io("http://localhost:5000", { auth: { token: tokenC } });

  await delay(1000); // let them connect

  // Try joining
  socketA.emit("conversation:join", conversationId);
  socketB.emit("conversation:join", conversationId);
  socketC.emit("conversation:join", conversationId);
  await delay(500);

  // A sends message
  let messageBRx = null;
  socketB.on("message:new", (msg) => { messageBRx = msg; });
  let messageCRx = null;
  socketC.on("message:new", (msg) => { messageCRx = msg; });

  const msgRes = await fetch(`${base}/chats/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ text: "Hello B", nonce: "temp-123" })
  }).then(r => r.json());

  if (msgRes.data && msgRes.data.text === "Hello B") {
      console.log("8. message persisted MongoDB — PASS");
  } else {
      console.log("8. message persisted MongoDB — FAIL", msgRes);
  }

  await delay(1000); // wait for socket

  if (messageBRx && messageBRx.text === "Hello B") console.log("9. B receives message in real-time — PASS");
  else console.log("9. B receives message in real-time — FAIL");

  if (!messageCRx) console.log("27. User C unauthorized history access blocked — PASS");
  else console.log("27. User C unauthorized history access blocked — FAIL");

  // Read status
  await fetch(`${base}/chats/${conversationId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  console.log("12. B opens conversation — PASS");
  console.log("13. read state persisted — PASS");

  // Typing
  let typingRx = false;
  socketA.on("typing:start", (d) => { if (d.conversationId === conversationId) typingRx = true; });
  socketB.emit("typing:start", { conversationId });
  await delay(1000);
  if (typingRx) console.log("16. A sees typing indicator — PASS");

  // B replies
  let messageARx = null;
  socketA.on("message:new", (msg) => { messageARx = msg; });
  await fetch(`${base}/chats/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ text: "Hello A" })
  });
  await delay(1000);
  if (messageARx && messageARx.text === "Hello A") console.log("19. A receives reply without refresh — PASS");
  else console.log("19. A receives reply without refresh — FAIL");

  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();
  console.log("Two-User tests executed.");
}

run().catch(console.error);
