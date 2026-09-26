import mongoose from "mongoose";
import { User } from "../models/User.js";
import { LocationSharing, AIConversation } from "../models/System.js";
import { TimetableEntry, TimetableSettings, Event, MarketplaceListing } from "../models/Commerce.js";
import { PushDevice } from "../models/PushDevice.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { Post, Comment, Reaction, Story, SavedItem, Notification, Friendship, FriendRequest } from "../models/Social.js";
import { Trip, TripExpense } from "../models/Trip.js";
import { Group, GroupMembership, GroupMessage, Poll } from "../models/Group.js";
import { Message } from "../models/Chat.js";
import { AppError } from "../utils/http.js";
import { cloudinaryService } from "./cloudinary.js";

export const deleteUserAccount = async (userId: string) => {
  const session = await mongoose.startSession();

  let cloudinaryPublicIds: string[] = [];

  try {
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    // 1. HARD DELETE: Private Data
    await User.deleteOne({ _id: userId }, { session });
    await LocationSharing.deleteOne({ user: userId }, { session });
    await AIConversation.deleteMany({ user: userId }, { session });
    await TimetableEntry.deleteMany({ user: userId }, { session });
    await TimetableSettings.deleteOne({ user: userId }, { session });
    await PushDevice.deleteMany({ user: userId }, { session });
    await RefreshToken.deleteMany({ user: userId }, { session });

    // Notifications where user is recipient or actor
    await Notification.deleteMany({ $or: [{ user: userId }, { actor: userId }] }, { session });

    // 2. HARD DELETE: Owned Public Content
    // Collect image public IDs first
    const events = await Event.find({ creator: userId }).session(session);
    events.forEach((e: any) => { if (e.imagePublicId) cloudinaryPublicIds.push(e.imagePublicId); });
    await Event.deleteMany({ creator: userId }, { session });

    const listings = await MarketplaceListing.find({ seller: userId }).session(session);
    listings.forEach((l: any) => { if (l.imagePublicIds) cloudinaryPublicIds.push(...l.imagePublicIds); });
    await MarketplaceListing.deleteMany({ seller: userId }, { session });

    const posts = await Post.find({ author: userId }).session(session);
    posts.forEach((p: any) => {
      if (p.media && Array.isArray(p.media)) {
        p.media.forEach((m: any) => { if (m.publicId) cloudinaryPublicIds.push(m.publicId); });
      }
    });
    await Post.deleteMany({ author: userId }, { session });

    await Story.deleteMany({ author: userId }, { session });

    await Trip.deleteMany({ createdBy: userId }, { session });
    await TripExpense.deleteMany({ paidBy: userId }, { session });

    // 3. REMOVE: Shared Relations
    await SavedItem.deleteMany({ user: userId }, { session });
    await Reaction.deleteMany({ user: userId }, { session });
    await Friendship.deleteMany({ users: userId }, { session });
    await FriendRequest.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] }, { session });
    await GroupMembership.deleteMany({ user: userId }, { session });
    await Event.updateMany({ "attendees.user": userId }, { $pull: { attendees: { user: userId } } }, { session });

    // 4. TOMBSTONE: Messages & Comments
    await Comment.updateMany(
      { author: userId },
      { $set: { text: "Comment unavailable", attachments: [] } },
      { session }
    );
    await Message.updateMany(
      { sender: userId },
      { $set: { text: "Message unavailable", attachments: [] } },
      { session }
    );

    await GroupMessage.updateMany(
      { sender: userId },
      { $set: { text: "Message unavailable", attachments: [] } },
      { session }
    );

    // 5. GROUP OWNERSHIP TRANSFER
    const ownedGroups = await Group.find({ owner: userId }).session(session);
    for (const group of ownedGroups) {
      const members = await GroupMembership.find({ group: group._id, user: { $ne: userId } })
        .session(session);

      if (members.length > 0) {
        let newOwner = members.find(m => (m as any).role === "admin");
        if (!newOwner) newOwner = members.find(m => (m as any).role === "moderator");
        if (!newOwner) newOwner = members[0];

        await Group.updateOne({ _id: group._id }, { $set: { owner: newOwner!.user } }, { session });
        await GroupMembership.updateOne({ _id: newOwner!._id }, { $set: { role: "owner" } }, { session });
      } else {
        if ((group as any).avatarPublicId) cloudinaryPublicIds.push((group as any).avatarPublicId);
        await Group.deleteOne({ _id: group._id }, { session });
        await Poll.deleteMany({ group: group._id }, { session });
        await GroupMessage.deleteMany({ group: group._id }, { session });
      }
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // 6. ASYNC CLOUDINARY CLEANUP
  Promise.allSettled(
    cloudinaryPublicIds.map(id => cloudinaryService.deleteImage(id).catch(() => {}))
  );

  return true;
};
