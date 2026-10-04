const id = (value: any): string | undefined => {
  const candidate = value?._id ?? value;
  return candidate == null ? undefined : String(candidate);
};

const receipt = (entry: any, dateKey: "deliveredAt" | "readAt") => ({
  user: id(entry?.user),
  [dateKey]: entry?.[dateKey] ? new Date(entry[dateKey]).toISOString() : undefined,
});

export function serializeChatMessage(document: any) {
  const message = typeof document?.toObject === "function"
    ? document.toObject({ depopulate: false })
    : document;
  const conversationId = id(message?.conversation);
  const senderId = id(message?.sender);
  const reply = message?.replyTo;
  const attachment = message?.attachments?.[0];
  const type = attachment ? "image" : "text";

  return {
    _id: id(message?._id),
    conversationId,
    senderId,
    sender: message?.sender && typeof message.sender === "object"
      ? {
          _id: senderId,
          name: message.sender.name,
          username: message.sender.username,
          avatarUrl: message.sender.avatarUrl,
        }
      : { _id: senderId },
    clientMessageId: message?.nonce,
    nonce: message?.nonce,
    type,
    ...(type === "text" ? { text: message?.text ?? "" } : {}),
    attachments: message?.attachments ?? [],
    ...(attachment
      ? {
          image: {
            url: attachment.url,
            thumbnailUrl: attachment.thumbnailUrl ?? attachment.url,
            publicId: attachment.publicId,
            width: attachment.width,
            height: attachment.height,
            size: attachment.size,
            mimeType: attachment.mimeType,
          },
        }
      : {}),
    replyToMessageId: id(reply),
    replyTo: reply
      ? {
          _id: id(reply),
          sender: reply.sender && typeof reply.sender === "object"
            ? { _id: id(reply.sender), name: reply.sender.name }
            : { _id: id(reply.sender) },
          text: reply.attachments?.length ? "Photo" : String(reply.text ?? "").slice(0, 160),
        }
      : undefined,
    replyPreview: reply
      ? {
          senderName: reply.sender?.name,
          type: reply.attachments?.length ? "image" : "text",
          text: reply.attachments?.length ? "Photo" : String(reply.text ?? "").slice(0, 160),
        }
      : undefined,
    reactions: (message?.reactions ?? []).map((reaction: any) => ({
      userId: id(reaction.user),
      emoji: reaction.emoji,
    })),
    deliveredTo: (message?.deliveredTo ?? []).map((entry: any) => receipt(entry, "deliveredAt")),
    readBy: (message?.readBy ?? []).map((entry: any) => receipt(entry, "readAt")),
    deletedFor: (message?.deletedFor ?? []).map(id).filter(Boolean),
    deletedForEveryoneAt: message?.deletedForEveryoneAt
      ? new Date(message.deletedForEveryoneAt).toISOString()
      : undefined,
    editedAt: message?.editedAt ? new Date(message.editedAt).toISOString() : undefined,
    createdAt: message?.createdAt ? new Date(message.createdAt).toISOString() : undefined,
    updatedAt: message?.updatedAt ? new Date(message.updatedAt).toISOString() : undefined,
  };
}
