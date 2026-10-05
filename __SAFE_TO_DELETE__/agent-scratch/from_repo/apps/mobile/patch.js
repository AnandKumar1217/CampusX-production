const fs = require('fs');
const path = 'src/screens/main/ChatsScreen.tsx';
let txt = fs.readFileSync(path, 'utf8');
const search = `<CXText variant="small" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
                      {item.type === "community_group" ? (item.subtitle || "No description") : (item.lastMessage || "No messages yet")}
                    </CXText>
                  </CXRow>`;
const searchFallback = `<CXText variant="small" color={colors.textMuted} numberOfLines={1} style={styles.flex}>\r\n                      {item.type === "community_group" ? (item.subtitle || "No description") : (item.lastMessage || "No messages yet")}\r\n                    </CXText>\r\n                  </CXRow>`;

const replace = `<CXText variant="small" color={item.unread ? colors.ink : colors.textMuted} numberOfLines={1} style={styles.flex}>
                      {item.type === "community_group" ? (item.subtitle || "No description") : (item.lastMessage || "No messages yet")}
                    </CXText>
                    {item.type === "group" && item.unread ? (
                      <View style={styles.unread}>
                        <CXText variant="caption" color={colors.white}>{item.unread}</CXText>
                      </View>
                    ) : null}
                  </CXRow>`;
if (txt.includes(search)) {
  txt = txt.replace(search, replace);
} else if (txt.includes(searchFallback)) {
  txt = txt.replace(searchFallback, replace);
} else {
  console.log("NOT FOUND");
}
fs.writeFileSync(path, txt);
