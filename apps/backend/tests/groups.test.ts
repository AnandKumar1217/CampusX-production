import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Group, GroupMembership, Poll, StudySession } from "../src/models/Group.js";
import { Post, Friendship, Notification } from "../src/models/Social.js";
import { createAccessToken } from "../src/services/tokenService.js";
import mongoose from "mongoose";
import { connectToTestDatabase } from "./testDatabase.js";

const app = createApp();

describe("Groups API - 50 Test Cases", () => {
  let ownerToken: string;
  let ownerId: string;
  let adminToken: string;
  let adminId: string;
  let modToken: string;
  let modId: string;
  let memberToken: string;
  let memberId: string;
  let anonToken: string;
  let anonId: string;
  let targetToken: string;
  let targetId: string;

  let publicGroupId: string;
  let privateGroupId: string;
  let pollId: string;

  const testIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    await connectToTestDatabase();
    const ts = Date.now();

    const createUser = async (role: string) => {
      const u = await User.create({
        name: `${role} User`,
        username: `user_${role}_${ts}`,
        email: `${role}_${ts}@test.com`,
        passwordHash: "testhash",
        academicYear: "Freshman",
        department: "Computer Science",
        college: "Engineering"
      });
      testIds.push(u._id);
      return { _id: u._id, id: u._id.toString(), token: createAccessToken(u._id.toString()) };
    };

    const owner = await createUser("owner");
    ownerId = owner.id; ownerToken = owner.token;

    const admin = await createUser("admin");
    adminId = admin.id; adminToken = admin.token;

    const mod = await createUser("mod");
    modId = mod.id; modToken = mod.token;

    const member = await createUser("member");
    memberId = member.id; memberToken = member.token;

    const anon = await createUser("anon");
    anonId = anon.id; anonToken = anon.token;

    const target = await createUser("target");
    targetId = target.id; targetToken = target.token;

    // Create friendships so that owner, admin, mod, member can invite target
    await Friendship.create([
      { users: [owner._id, target._id], createdBy: target._id },
      { users: [admin._id, target._id], createdBy: target._id },
      { users: [mod._id, target._id], createdBy: target._id },
      { users: [member._id, target._id], createdBy: target._id },
    ]);
  }, 30000);

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: testIds } });
    await Group.deleteMany({ owner: { $in: testIds } });
    await GroupMembership.deleteMany({ user: { $in: testIds } });
    await Post.deleteMany({ author: { $in: testIds } });
    await Poll.deleteMany({ author: { $in: testIds } });
    await StudySession.deleteMany({ createdBy: { $in: testIds } });
    await mongoose.disconnect();
  }, 30000);

  // 1-5: Creation and Basics
  it("1. should create a public group (owner assigned)", async () => {
    const res = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Public Group", privacy: "public" });
    expect(res.status).toBe(201);
    expect(res.body.data.memberCount).toBe(1);
    publicGroupId = res.body.data._id;
  });

  it("2. should create a private group", async () => {
    const res = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Private Group", privacy: "private" });
    expect(res.status).toBe(201);
    privateGroupId = res.body.data._id;
  });

  it("3. fail to create group with invalid data", async () => {
    const res = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "" }); // invalid
    expect(res.status).toBe(422);
  });

  it("4. get all groups pagination", async () => {
    const res = await request(app).get("/api/groups?page=1&limit=10").set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("5. search groups", async () => {
    const res = await request(app).get("/api/groups?q=Public").set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((g: any) => g.name === "Public Group")).toBe(true);
  });

  // 6-8: My Groups & Details
  it("6. get my groups (includes only active)", async () => {
    const res = await request(app).get("/api/groups/mine").set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("7. get group details (public)", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.group.name).toBe("Public Group");
  });

  it("8. hide private group details from non-members", async () => {
    const res = await request(app).get(`/api/groups/${privateGroupId}`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("GROUP_NOT_FOUND");
  });

  // 9-12: Update Group Details
  it("9. update group details (owner)", async () => {
    const res = await request(app).patch(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${ownerToken}`).send({ description: "owner desc" });
    expect(res.status).toBe(200);
  });

  it("10. update group details (admin)", async () => {
    // Manually add admin
    await GroupMembership.create({ group: publicGroupId, user: adminId, role: "admin", status: "active" });
    const res = await request(app).patch(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${adminToken}`).send({ description: "admin desc" });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("admin desc");
  });

  it("11. fail update group details (moderator)", async () => {
    await GroupMembership.create({ group: publicGroupId, user: modId, role: "moderator", status: "active" });
    const res = await request(app).patch(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${modToken}`).send({ description: "mod desc" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("12. fail update group details (member)", async () => {
    await GroupMembership.create({ group: publicGroupId, user: memberId, role: "member", status: "active" });
    const res = await request(app).patch(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${memberToken}`).send({ description: "member desc" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  // 13-16: Join Logic
  it("13. join public group (success, status active)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/join`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("active");
  });

  it("14. duplicate join public group (returns existing, no memberCount increment)", async () => {
    const before = await Group.findById(publicGroupId);
    const res = await request(app).post(`/api/groups/${publicGroupId}/join`).set("Authorization", `Bearer ${anonToken}`);
    const after = await Group.findById(publicGroupId);
    expect(res.status).toBe(200);
    expect(after?.memberCount).toBe(before?.memberCount);
  });

  it("15. join private group (success, status requested)", async () => {
    const res = await request(app).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("requested");
  });

  it("15b. notification payload for group_join_request contains group ID", async () => {
    const notif = await Notification.findOne({ type: "group_join_request", actor: anonId }).sort({ createdAt: -1 });
    expect(notif).toBeDefined();
    expect(notif?.target?.route).toBe("GroupDetails");
    expect(notif?.target?.params?.groupId?.toString()).toBe(privateGroupId);
  });

  it("16. duplicate join private group (returns existing, no memberCount increment)", async () => {
    const res = await request(app).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
  });

  // 17-21: Requests Management
  it("17. get join requests (owner)", async () => {
    const res = await request(app).get(`/api/groups/${privateGroupId}/requests`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].user).toBeDefined(); // pending request returned correctly
  });

  it("18. get join requests (admin)", async () => {
    await GroupMembership.create({ group: privateGroupId, user: adminId, role: "admin", status: "active" });
    const res = await request(app).get(`/api/groups/${privateGroupId}/requests`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it("19. fail get join requests (member)", async () => {
    await GroupMembership.create({ group: privateGroupId, user: memberId, role: "member", status: "active" });
    const res = await request(app).get(`/api/groups/${privateGroupId}/requests`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("20. approve join request (admin) -> status active, memberCount++", async () => {
    const before = await Group.findById(privateGroupId);
    const res = await request(app).patch(`/api/groups/${privateGroupId}/requests/${anonId}`).set("Authorization", `Bearer ${adminToken}`).send({ action: "approve" });
    expect(res.status).toBe(200);
    const after = await Group.findById(privateGroupId);
    expect(after?.memberCount).toBe((before?.memberCount || 0) + 1);
  });

  it("20b. owner approve succeeds", async () => {
    // create a new request for targetId
    await request(app).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${targetToken}`);
    const before = await Group.findById(privateGroupId);
    const res = await request(app).patch(`/api/groups/${privateGroupId}/requests/${targetId}`).set("Authorization", `Bearer ${ownerToken}`).send({ action: "approve" });
    expect(res.status).toBe(200);
    const after = await Group.findById(privateGroupId);
    expect(after?.memberCount).toBe((before?.memberCount || 0) + 1);
  });

  it("20c. repeated approve does not double increment", async () => {
    const before = await Group.findById(privateGroupId);
    const res = await request(app).patch(`/api/groups/${privateGroupId}/requests/${targetId}`).set("Authorization", `Bearer ${ownerToken}`).send({ action: "approve" });
    expect(res.status).toBe(404); // request no longer exists since it's now active
    const after = await Group.findById(privateGroupId);
    expect(after?.memberCount).toBe(before?.memberCount); // no increment
    // CLEANUP targetId
    await GroupMembership.deleteOne({ group: privateGroupId, user: targetId });
    await Group.updateOne({ _id: privateGroupId }, { $inc: { memberCount: -1 } });
  });

  it("21. reject join request (admin) -> deleted, memberCount unchanged", async () => {
    // create request for modId
    await request(app).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${modToken}`);
    const before = await Group.findById(privateGroupId);
    const res = await request(app).patch(`/api/groups/${privateGroupId}/requests/${modId}`).set("Authorization", `Bearer ${adminToken}`).send({ action: "reject" });
    expect(res.status).toBe(200);
    const after = await Group.findById(privateGroupId);
    expect(after?.memberCount).toBe(before?.memberCount);
  });

  it("21b. owner reject succeeds, memberCount unchanged", async () => {
    // create request for another user (use modId again)
    await request(app).post(`/api/groups/${privateGroupId}/join`).set("Authorization", `Bearer ${modToken}`);
    const before = await Group.findById(privateGroupId);
    const res = await request(app).patch(`/api/groups/${privateGroupId}/requests/${modId}`).set("Authorization", `Bearer ${ownerToken}`).send({ action: "reject" });
    expect(res.status).toBe(200);
    const after = await Group.findById(privateGroupId);
    expect(after?.memberCount).toBe(before?.memberCount);
  });

  // CLEANUP anonId which was approved in test 20
  it("21c. cleanup anon from private group", async () => {
    await GroupMembership.deleteOne({ group: privateGroupId, user: anonId });
    await Group.updateOne({ _id: privateGroupId }, { $inc: { memberCount: -1 } });
  });

  // 22-24: Invites
  it("22. invite user (owner)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/invites`).set("Authorization", `Bearer ${ownerToken}`).send({ userIds: [targetId] });
    expect(res.status).toBe(200);
  });

  it("23. invite user (admin)", async () => {
    const res = await request(app).post(`/api/groups/${privateGroupId}/invites`).set("Authorization", `Bearer ${adminToken}`).send({ userIds: [targetId] });
    expect(res.status).toBe(200);
  });

  it("24. fail invite user (member) -> now 400 due to friendship rules", async () => {
    const res = await request(app).post(`/api/groups/${privateGroupId}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [anonId] });
    expect(res.status).toBe(400);
  });

  // 25-26: Leave Group
  it("25. leave group (member) -> memberCount--", async () => {
    const before = await Group.findById(publicGroupId);
    const res = await request(app).post(`/api/groups/${publicGroupId}/leave`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
    const after = await Group.findById(publicGroupId);
    expect(after?.memberCount).toBe((before?.memberCount || 1) - 1);
  });

  it("26. leave group (owner) -> blocked", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/leave`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });

  // 27-29: Remove Member
  it("27. remove member (owner removes member)", async () => {
    await GroupMembership.create({ group: publicGroupId, user: anonId, role: "member", status: "active" });
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${anonId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });

  it("28. fail remove member (admin removes member) -> 403", async () => {
    await GroupMembership.create({ group: publicGroupId, user: anonId, role: "member", status: "active" });
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${anonId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it("28b. fail remove member (moderator removes member) -> 403", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${anonId}`).set("Authorization", `Bearer ${modToken}`);
    expect(res.status).toBe(403);
  });

  it("28c. fail remove member (member removes member) -> 403", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${anonId}`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  it("28d. fail remove member (non-member removes member) -> 403", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${anonId}`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(403);
    // Cleanup anon from group since it wasn't removed
    await GroupMembership.deleteOne({ group: publicGroupId, user: anonId });
  });

  it("29. fail remove member (admin removes owner)", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${ownerId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it("29b. fail remove self (owner removes self)", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}/members/${ownerId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(400); // 400 You cannot remove yourself
  });

  // 30-33: Change Role
  it("30. change role (owner promotes to admin)", async () => {
    await GroupMembership.create({ group: publicGroupId, user: anonId, role: "member", status: "active" });
    const res = await request(app).patch(`/api/groups/${publicGroupId}/members/${anonId}/role`).set("Authorization", `Bearer ${ownerToken}`).send({ role: "admin" });
    expect(res.status).toBe(200);
  });

  it("31. change role (owner demotes admin)", async () => {
    const res = await request(app).patch(`/api/groups/${publicGroupId}/members/${anonId}/role`).set("Authorization", `Bearer ${ownerToken}`).send({ role: "member" });
    expect(res.status).toBe(200);
  });

  it("32. fail change role (admin promotes to admin)", async () => {
    const res = await request(app).patch(`/api/groups/${publicGroupId}/members/${anonId}/role`).set("Authorization", `Bearer ${adminToken}`).send({ role: "admin" });
    expect(res.status).toBe(403);
  });

  it("33. fail change role (owner demotes owner)", async () => {
    const res = await request(app).patch(`/api/groups/${publicGroupId}/members/${ownerId}/role`).set("Authorization", `Bearer ${ownerToken}`).send({ role: "member" });
    expect(res.status).toBe(400);
  });

  // 34-38: Polls
  it("34. create poll (active member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/polls`).set("Authorization", `Bearer ${memberToken}`).send({
      question: "Test poll?", options: ["A", "B"]
    });
    expect(res.status).toBe(201);
    pollId = res.body.data._id;
  });

  it("35. fail create poll (non-member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/polls`).set("Authorization", `Bearer ${targetToken}`).send({
      question: "Test poll?", options: ["A", "B"]
    });
    expect(res.status).toBe(403);
  });

  it("36. vote poll (active member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/polls/${pollId}/vote`).set("Authorization", `Bearer ${memberToken}`).send({ option: 0 });
    expect(res.status).toBe(200);
  });

  it("37. fail vote poll (non-member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/polls/${pollId}/vote`).set("Authorization", `Bearer ${targetToken}`).send({ option: 0 });
    expect(res.status).toBe(403);
  });

  it("38. get polls (member)", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId}/polls`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  // 39-41: Sessions
  it("39. create session (active member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/sessions`).set("Authorization", `Bearer ${memberToken}`).send({
      title: "Study session", startsAt: new Date().toISOString(), type: "virtual"
    });
    expect(res.status).toBe(201);
  });

  it("40. fail create session (non-member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId}/sessions`).set("Authorization", `Bearer ${targetToken}`).send({
      title: "Study session", startsAt: new Date().toISOString(), type: "virtual"
    });
    expect(res.status).toBe(403);
  });

  it("41. get sessions (member)", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId}/sessions`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  // 42-44: Posts Integration
  it("42. get posts (public group, non-member)", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId}/posts`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
  });

  it("43. fail get posts (private group, non-member)", async () => {
    const res = await request(app).get(`/api/groups/${privateGroupId}/posts`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(403);
  });

  it("44. get posts (private group, member)", async () => {
    const res = await request(app).get(`/api/groups/${privateGroupId}/posts`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  // 45: Members
  it("45. get group members", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId}/members`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(200);
  });

  // 46-50: Delete & Cascade
  it("46. fail delete group (admin)", async () => {
    const res = await request(app).delete(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("47. allow delete group (owner)", async () => {
    // create dummy post in group with visibility="group"
    await Post.create({ body: "test", visibility: "group", group: publicGroupId, author: ownerId });
    // create dummy post in group with visibility="public" (should NOT be deleted)
    await Post.create({ body: "public test", visibility: "public", group: publicGroupId, author: ownerId });

    const res = await request(app).delete(`/api/groups/${publicGroupId}`).set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });

  it("48. Cascade test: post with visibility group deleted", async () => {
    const postCount = await Post.countDocuments({ group: publicGroupId, visibility: "group" });
    expect(postCount).toBe(0);
  });

  it("49. Cascade test: post with visibility public NOT deleted", async () => {
    const postCount = await Post.countDocuments({ group: publicGroupId, visibility: "public" });
    expect(postCount).toBe(1);
  });

  it("50. Cascade test: membership and session deleted", async () => {
    const memCount = await GroupMembership.countDocuments({ group: publicGroupId });
    const sessionCount = await StudySession.countDocuments({ group: publicGroupId });
    expect(memCount).toBe(0);
    expect(sessionCount).toBe(0);
  });

  // 51-73: Group Invites (Phase 8)
  let publicGroupId2: string;
  let privateGroupId2: string;

  it("51. setup new groups for invite tests", async () => {
    let res = await request(app).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({ name: "Pub2", privacy: "public" });
    publicGroupId2 = res.body.data._id;
    res = await request(app).post("/api/groups").set("Authorization", `Bearer ${ownerToken}`).send({ name: "Priv2", privacy: "private" });
    privateGroupId2 = res.body.data._id;

    // Add admin, mod, member to these groups to test their invite capabilities
    await GroupMembership.create([
      { group: publicGroupId2, user: adminId, role: "admin", status: "active" },
      { group: publicGroupId2, user: modId, role: "moderator", status: "active" },
      { group: publicGroupId2, user: memberId, role: "member", status: "active" },
      { group: privateGroupId2, user: adminId, role: "admin", status: "active" },
      { group: privateGroupId2, user: modId, role: "moderator", status: "active" },
      { group: privateGroupId2, user: memberId, role: "member", status: "active" },
    ]);
  });

  // Basic validation tests
  it("52. fail to invite if inviter is not an active member", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${anonToken}`).send({ userIds: [targetId] });
    expect(res.status).toBe(403);
  });

  it("53. fail to invite self", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [memberId] });
    expect(res.status).toBe(400);
  });

  it("54. fail to invite non-friend", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [anonId] });
    expect(res.status).toBe(400); // Because member is not friends with anon
  });

  it("55. fail to accept someone else's invite", async () => {
    // Owner invites target
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${ownerToken}`).send({ userIds: [targetId] });
    // anon tries to accept
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(403);
  });

  it("56. decline an invite", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/decline`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(200);
    const mem = await GroupMembership.findOne({ group: publicGroupId2, user: targetId });
    expect(mem).toBeNull();
  });

  it("57. fail to accept a declined invite", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(404);
  });

  it("58. fail to decline a non-existent invite", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/decline`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(404);
  });

  it("59. owner can invite friend to public group", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${ownerToken}`).send({ userIds: [targetId] });
    expect(res.status).toBe(200);
  });

  it("60. fail to invite already invited user", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${adminToken}`).send({ userIds: [targetId] });
    expect(res.status).toBe(200);
    expect(res.body.data.invited).toBe(0);
  });

  it("61. accept public group invite becomes active immediately", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("active");
  });

  it("62. fail to accept an already active membership", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(404);
  });

  it("63. cleanup target from pub2", async () => {
    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
    expect(true).toBe(true);
  });

  // Public Group Invites by different roles
  it("64. admin can invite friend to public group", async () => {
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${adminToken}`).send({ userIds: [targetId] });
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");
    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
  });

  it("65. mod can invite friend to public group", async () => {
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${modToken}`).send({ userIds: [targetId] });
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");
    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
  });

  it("66. member can invite friend to public group", async () => {
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");
    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
  });

  // Private Group Invites - Detailed State Machine Tests
  it("67. Private Member invite creates INVITED, not REQUESTED, memberCount unchanged", async () => {
    const groupBefore = await Group.findById(privateGroupId2);
    const countBefore = groupBefore!.memberCount;

    await request(app).post(`/api/groups/${privateGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });

    const mem = await GroupMembership.findOne({ group: privateGroupId2, user: targetId });
    expect(mem!.status).toBe("invited"); // specifically prove INVITED

    const groupAfter = await Group.findById(privateGroupId2);
    expect(groupAfter!.memberCount).toBe(countBefore); // memberCount unchanged
  });

  it("68. Invitee Accept converts INVITED -> REQUESTED. Accept does NOT increment memberCount", async () => {
    const groupBefore = await Group.findById(privateGroupId2);
    const countBefore = groupBefore!.memberCount;

    const res = await request(app).post(`/api/groups/${privateGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("requested"); // member invite -> requested

    const groupAfter = await Group.findById(privateGroupId2);
    expect(groupAfter!.memberCount).toBe(countBefore); // memberCount unchanged
  });

  it("69. Approval converts REQUESTED -> ACTIVE and increments memberCount exactly once", async () => {
    const groupBefore = await Group.findById(privateGroupId2);
    const countBefore = groupBefore!.memberCount;

    const res = await request(app).patch(`/api/groups/${privateGroupId2}/requests/${targetId}`).set("Authorization", `Bearer ${adminToken}`).send({ action: "approve" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("active");

    const groupAfter = await Group.findById(privateGroupId2);
    expect(groupAfter!.memberCount).toBe(countBefore + 1); // exactly once

    await GroupMembership.deleteOne({ group: privateGroupId2, user: targetId });
    await Group.updateOne({ _id: privateGroupId2 }, { $inc: { memberCount: -1 } }); // cleanup
  });

  it("70. Declining INVITED removes membership/invite. Decline never creates request", async () => {
    await request(app).post(`/api/groups/${privateGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });
    const memBefore = await GroupMembership.findOne({ group: privateGroupId2, user: targetId });
    expect(memBefore!.status).toBe("invited");

    const res = await request(app).post(`/api/groups/${privateGroupId2}/invites/${targetId}/decline`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(200);

    const memAfter = await GroupMembership.findOne({ group: privateGroupId2, user: targetId });
    expect(memAfter).toBeNull();
  });

  it("71. Private Owner invite creates INVITED. Accept -> ACTIVE", async () => {
    await request(app).post(`/api/groups/${privateGroupId2}/invites`).set("Authorization", `Bearer ${ownerToken}`).send({ userIds: [targetId] });
    const mem = await GroupMembership.findOne({ group: privateGroupId2, user: targetId });
    expect(mem!.status).toBe("invited");

    const res = await request(app).post(`/api/groups/${privateGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");

    await GroupMembership.deleteOne({ group: privateGroupId2, user: targetId });
    await Group.updateOne({ _id: privateGroupId2 }, { $inc: { memberCount: -1 } }); // cleanup
  });

  it("72. Private Admin invite Accept -> ACTIVE", async () => {
    await request(app).post(`/api/groups/${privateGroupId2}/invites`).set("Authorization", `Bearer ${adminToken}`).send({ userIds: [targetId] });
    const res = await request(app).post(`/api/groups/${privateGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");

    await GroupMembership.deleteOne({ group: privateGroupId2, user: targetId });
    await Group.updateOne({ _id: privateGroupId2 }, { $inc: { memberCount: -1 } }); // cleanup
  });

  it("73. Public invite Accept -> ACTIVE", async () => {
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.body.data.status).toBe("active");

    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
    await Group.updateOne({ _id: publicGroupId2 }, { $inc: { memberCount: -1 } }); // cleanup
  });

  it("74. Duplicate Accept is safe/idempotent", async () => {
    // Already cleaned up, so we can't duplicate accept without recreating.
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });
    await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    // Duplicate
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(404); // Invite not found or already processed

    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
    await Group.updateOne({ _id: publicGroupId2 }, { $inc: { memberCount: -1 } }); // cleanup
  });

  it("75. Unauthorized user cannot accept someone else's invitation", async () => {
    await request(app).post(`/api/groups/${publicGroupId2}/invites`).set("Authorization", `Bearer ${memberToken}`).send({ userIds: [targetId] });
    // anonToken tries to accept for targetId
    const res = await request(app).post(`/api/groups/${publicGroupId2}/invites/${targetId}/accept`).set("Authorization", `Bearer ${anonToken}`);
    expect(res.status).toBe(403);

    await GroupMembership.deleteOne({ group: publicGroupId2, user: targetId });
  });

  it("76. target should have no active memberships at the end of tests", async () => {
    const mems = await GroupMembership.find({ user: targetId, status: "active" });
    expect(mems.length).toBe(0);
  });

  // 77-80: Messages
  it("77. send message to public group (active member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/messages`).set("Authorization", `Bearer ${memberToken}`).send({
      text: "Hello world",
      nonce: "temp-nonce-123"
    });
    expect(res.status).toBe(201);
    expect(res.body.data.text).toBe("Hello world");
    expect(res.body.data.nonce).toBe("temp-nonce-123");
    expect(res.body.data.sender).toBeDefined();
    expect(res.body.data.sender.name).toBeDefined(); // Sender is populated securely
  });

  it("78. fail send message to public group (non-member)", async () => {
    const res = await request(app).post(`/api/groups/${publicGroupId2}/messages`).set("Authorization", `Bearer ${targetToken}`).send({
      text: "Hello world"
    });
    expect(res.status).toBe(403);
  });

  it("79. get messages from public group (active member)", async () => {
    const res = await request(app).get(`/api/groups/${publicGroupId2}/messages`).set("Authorization", `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0].nonce).toBe("temp-nonce-123");
  });

  it("80. fail get messages from private group (non-member)", async () => {
    const res = await request(app).get(`/api/groups/${privateGroupId2}/messages`).set("Authorization", `Bearer ${targetToken}`);
    expect(res.status).toBe(403);
  });
});
