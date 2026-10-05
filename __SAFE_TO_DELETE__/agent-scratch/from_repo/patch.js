const fs = require('fs');
let code = fs.readFileSync('apps/mobile/src/screens/main/ChatsScreen.tsx', 'utf8');
code = code.replace(
  '      setConversations(chatsRes.data.data);\r\n      setGroups(groupsRes.data || []);',
  '      setConversations(chatsRes.data.data);\n      setGroups(groupsRes.data || []);\n\n      const chats = chatsRes.data.data;\n      if (chats && chats.length > 0) {\n        setTimeout(() => {\n          chats.slice(0, 5).forEach((chat) => {\n            const id = chat._id || chat.id;\n            if (id) {\n              api.get(/chats/+id+/messages?limit=30).then(res => {\n                if (res.data?.data?.items) {\n                  queryClient.setQueryData(["chatMessages", id], res.data.data.items);\n                  AsyncStorage.setItem(chatMessages_+id, JSON.stringify(res.data.data.items)).catch(() => {});\n                }\n              }).catch(() => {});\n            }\n          });\n        }, 500);\n      }'
);
fs.writeFileSync('apps/mobile/src/screens/main/ChatsScreen.tsx', code);