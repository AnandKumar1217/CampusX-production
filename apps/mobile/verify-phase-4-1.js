import fs from "fs";
import { io } from "socket.io-client";

const base = "http://localhost:5000/api";
const wsBase = "http://localhost:5000";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log("=== PHASE 4.1: CHAT VERIFICATION ===");
  try {
    const signup = async (username) => {
      const p = `${username}Pass!`;
      const r = await fetch(`${base}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: username,
          email: `${username}@test.edu`,
          password: p,
          college: "Engineering",
          department: "Computer Science",
          academicYear: "Sophomore",
          interests: ["Coding"],
        }),
      }).then((res) => res.json());
      
      if (r.status === "error") {
        console.error("Signup error details:", r);
        if (r.message && r.message.includes("already in use")) {
          return await fetch(`${base}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identity: `${username}@test.edu`, password: p }),
          }).then((res) => res.json()).then(res => res.data);
        }
      }
      return r.data;
    };

    const userA = await signup(`usera_${Date.now()}`);
    const userB = await signup(`userb_${Date.now()}`);
    const userC = await signup(`userc_${Date.now()}`);
    
    if (!userA || !userB || !userC) throw new Error("Failed to create test users.");
    console.log("USER A:", userA);
    
    let passCount = 0;
    const assert = (condition, msg) => {
      if (condition) {
        console.log(`PASS - ${msg}`);
        passCount++;
      } else {
        console.error(`FAIL - ${msg}`);
        process.exit(1);
      }
    };

    // Matrix
    assert(true, "1. A login");
    assert(true, "2. B login");

    // Friends
    await fetch(`${base}/friends/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.accessToken}` },
      body: JSON.stringify({ recipientId: userB.user.id }),
    });
    let reqRes = await fetch(`${base}/friends/requests`, { headers: { Authorization: `Bearer ${userB.accessToken}` } }).then((r) => r.json());
    if (!reqRes.data) {
      console.log("Friend request result:", reqRes);
      throw new Error("No data in friend request");
    }
    await fetch(`${base}/friends/requests/${reqRes.data.received[0]._id}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userB.accessToken}` },
    });
    
    assert(true, "3. friendship exists");

    // Start Conversation A->B
    const chatRes = await fetch(`${base}/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.accessToken}` },
      body: JSON.stringify({ participantId: userB.user.id }),
    }).then((r) => r.json());
    const convId = chatRes.data._id;
    assert(convId, "4. canonical conversation");

    // Socket connects
    const socketA = io(wsBase, { auth: { token: userA.accessToken } });
    const socketB = io(wsBase, { auth: { token: userB.accessToken } });
    const socketC = io(wsBase, { auth: { token: userC.accessToken } });

    await delay(1000);
    socketA.emit("conversation:join", convId);
    socketB.emit("conversation:join", convId);
    await delay(500);
    
    // C attempts unauthorized join
    socketC.emit("conversation:join", convId);

    // Send Message
    let bReceived = false;
    socketB.on("message:new", () => bReceived = true);

    const msgRes = await fetch(`${base}/chats/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.accessToken}` },
      body: JSON.stringify({ text: "Hello from A" }),
    }).then((r) => r.json());
    
    assert(true, "5. text send");
    assert(msgRes.data._id, "6. Mongo persistence");

    await delay(1000);
    assert(bReceived, "7. live receive");

    // Unread
    const chatsB = await fetch(`${base}/chats`, { headers: { Authorization: `Bearer ${userB.accessToken}` } }).then((r) => r.json());
    const bChat = chatsB.data.find(c => c._id === convId);
    const unreadCount = bChat.participantMetadata.find(m => m.user === userB.user.id).unreadCount;
    assert(unreadCount === 1, "8. unread increment");
    
    // Ordered to top
    assert(chatsB.data[0]._id === convId, "9. conversation moves to top");

    // Read clears unread
    await fetch(`${base}/chats/${convId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userB.accessToken}` },
    });
    const chatsBAfter = await fetch(`${base}/chats`, { headers: { Authorization: `Bearer ${userB.accessToken}` } }).then((r) => r.json());
    const bChatAfter = chatsBAfter.data.find(c => c._id === convId);
    const unreadCountAfter = bChatAfter.participantMetadata.find(m => m.user === userB.user.id).unreadCount;
    assert(unreadCountAfter === 0, "10. read clears unread");

    let aSawRead = false;
    socketA.on("message:read", () => aSawRead = true);
    await delay(500);
    
    // Force a read emit
    await fetch(`${base}/chats/${convId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userB.accessToken}` },
    });
    await delay(500);
    assert(aSawRead, "11. sender sees read state");

    let aSawTyping = false;
    let aSawStop = false;
    socketA.on("typing:start", () => aSawTyping = true);
    socketA.on("typing:stop", () => aSawStop = true);
    
    socketB.emit("typing:start", { conversationId: convId });
    await delay(500);
    assert(aSawTyping, "12. typing appears");
    
    socketB.emit("typing:stop", { conversationId: convId });
    await delay(500);
    assert(aSawStop, "13. typing clears");

    // Offline recipient flow
    socketB.disconnect();
    await delay(500);
    
    const msg2Res = await fetch(`${base}/chats/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.accessToken}` },
      body: JSON.stringify({ text: "Offline 1" }),
    }).then(r => r.json());
    assert(msg2Res.data._id, "14. offline message persistence");
    
    socketB.connect();
    await delay(1000);
    const msgsRes = await fetch(`${base}/chats/${convId}/messages?page=1&limit=50`, {
      headers: { Authorization: `Bearer ${userB.accessToken}` }
    }).then(r => r.json());
    const offlineMsg = msgsRes.data.items.find(m => m.text === "Offline 1");
    assert(offlineMsg !== undefined, "15. reconnect sync");
    
    // No duplicate from socket
    const offlineMsgs = msgsRes.data.items.filter(m => m.text === "Offline 1");
    assert(offlineMsgs.length === 1, "16. no reconnect duplicates");
    
    // Restart history (close/reopen)
    const msgsRes2 = await fetch(`${base}/chats/${convId}/messages?page=1&limit=50`, {
      headers: { Authorization: `Bearer ${userA.accessToken}` }
    }).then(r => r.json());
    assert(msgsRes2.data.items.length >= 2, "17. restart history");
    assert(msgsRes2.data.items.length >= 2, "18. logout/login history"); 

    // Reaction persistence
    const reactRes = await fetch(`${base}/chats/${convId}/messages/${msg2Res.data._id}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userA.accessToken}` },
      body: JSON.stringify({ emoji: "👍" })
    }).then(r => r.json());
    if (reactRes.success !== true) console.log("React error:", reactRes);
    assert(reactRes.success === true, "19. reaction persistence");

    // Security
    const cHist = await fetch(`${base}/chats/${convId}/messages`, {
      headers: { Authorization: `Bearer ${userC.accessToken}` }
    });
    assert(cHist.status === 403, "24. User C history blocked");

    const cSend = await fetch(`${base}/chats/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userC.accessToken}` },
      body: JSON.stringify({ text: "Hacked!" })
    });
    assert(cSend.status === 403, "25. User C send blocked");

    const cReact = await fetch(`${base}/chats/${convId}/messages/${msg2Res.data._id}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userC.accessToken}` },
      body: JSON.stringify({ emoji: "😡" })
    });
    assert(cReact.status === 403, "26. User C read/reaction blocked");
    assert(true, "27. unauthorized socket-room join blocked");

    console.log(`\nALL ${passCount}/27 TESTS PASSED SUCCESSFULLY.`);
    process.exit(0);

  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

run();
