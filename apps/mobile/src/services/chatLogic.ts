export const mergeChatMessages = (current: any[], incoming: any[]) => {
  const merged = [...current];
  for (const message of incoming) {
    const index = merged.findIndex((item) =>
      (item._id && message._id && String(item._id) === String(message._id)) ||
      ((item.clientMessageId || item.nonce) && (message.clientMessageId || message.nonce) &&
        String(item.clientMessageId || item.nonce) === String(message.clientMessageId || message.nonce)),
    );
    if (index >= 0) merged[index] = { ...merged[index], ...message };
    else merged.push(message);
  }
  return merged.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

export const getChatDateLabel = (value: string, now = new Date()) => {
  const date = new Date(value);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = date.toDateString();
  if (key === now.toDateString()) return "Today";
  if (key === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};
