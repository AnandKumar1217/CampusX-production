import request from "supertest";
import { describe, expect, it, beforeAll, afterAll, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { randomBytes } from "crypto";

import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { MarketplaceListing } from "../src/models/Commerce.js";
import { SavedItem } from "../src/models/Social.js";
import { createAccessToken } from "../src/services/tokenService.js";
import { cloudinaryService } from "../src/services/cloudinary.js";
import { connectToTestDatabase } from "./testDatabase.js";

vi.mock("../src/services/cloudinary.js", () => ({
  cloudinaryService: {
    deleteImage: vi.fn().mockResolvedValue(true)
  }
}));

describe("Marketplace API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let userAId: string;
  let userBId: string;
  let userAToken: string;
  let userBToken: string;
  const createdListingIds: string[] = [];

  beforeAll(async () => {
    app = createApp();
    await connectToTestDatabase();

    const uniqueSuffix = randomBytes(4).toString("hex");

    const userA = await User.create({
      email: `seller-${uniqueSuffix}@example.com`,
      username: `seller-${uniqueSuffix}`,
      name: "Test Seller",
      passwordHash: "dummy",
      college: "Test College",
      department: "CS",
      academicYear: "1"
    });
    userAId = userA._id.toString();
    userAToken = createAccessToken(userAId);

    const userB = await User.create({
      email: `buyer-${uniqueSuffix}@example.com`,
      username: `buyer-${uniqueSuffix}`,
      name: "Test Buyer",
      passwordHash: "dummy",
      college: "Test College",
      department: "IT",
      academicYear: "2"
    });
    userBId = userB._id.toString();
    userBToken = createAccessToken(userBId);
  }, 30000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await SavedItem.deleteMany({ item: { $in: createdListingIds }, itemType: "listing" });
    await MarketplaceListing.deleteMany({ _id: { $in: createdListingIds } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  });

  let listingId: string;

  it("1. authenticated user can create listing and 4. persists with real MongoDB ID", async () => {
    const res = await request(app)
      .post("/api/marketplace")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        title: "Test Listing",
        category: "Books",
        price: 500,
        description: "A test book",
        images: ["http://example.com/image.jpg"],
        imagePublicIds: ["pub-id-1"]
      });

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBeDefined();
    expect(res.body.data.title).toBe("Test Listing");
    expect(res.body.data.price).toBe(500);

    listingId = res.body.data._id;
    createdListingIds.push(listingId);
  });

  it("2. seller is derived from authenticated user and 3. client-supplied seller cannot override actual seller", async () => {
    const res = await request(app)
      .post("/api/marketplace")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        title: "Another Listing",
        category: "Tech",
        price: 1000,
        seller: userBId // Trying to override seller
      });

    expect(res.status).toBe(201);
    expect(res.body.data.seller.toString()).toBe(userAId); // Ignored override
    createdListingIds.push(res.body.data._id);
  });

  it("5. GET /api/marketplace returns listing", async () => {
    const res = await request(app)
      .get("/api/marketplace")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.items.find((item: any) => item._id === listingId);
    expect(found).toBeDefined();
  });

  it("6. GET /api/marketplace/:id returns listing", async () => {
    const res = await request(app)
      .get(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(listingId);
    expect(res.body.data.seller._id.toString()).toBe(userAId);
  });

  it("7. GET /api/marketplace/mine returns only authenticated seller listings", async () => {
    const res = await request(app)
      .get("/api/marketplace/mine")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].seller.toString()).toBe(userAId);
  });

  it("8. owner PATCH succeeds and IMAGE REPLACEMENT replaces cloudinary assets", async () => {
    const res = await request(app)
      .patch(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        price: 450,
        images: ["http://example.com/new.jpg"],
        imagePublicIds: ["pub-id-2"] // replacing pub-id-1
      });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(450);

    // Cloudinary mock should be called for the removed image
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith("pub-id-1");
  });

  it("9. non-owner PATCH returns 404/403", async () => {
    const res = await request(app)
      .patch(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ price: 10 });

    expect(res.status).toBe(403);
  });

  it("22. seller cannot be overwritten through PATCH", async () => {
    const res = await request(app)
      .patch(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ seller: userBId });

    expect(res.status).toBe(200);

    const verifyRes = await request(app)
      .get(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(verifyRes.body.data.seller._id.toString()).toBe(userAId);
  });

  it("13. save listing persists", async () => {
    const res = await request(app)
      .post(`/api/marketplace/${listingId}/save`)
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
  });

  it("14. duplicate save does not create duplicate saved relation", async () => {
    await request(app)
      .post(`/api/marketplace/${listingId}/save`)
      .set("Authorization", `Bearer ${userBToken}`);

    const savedItemsCount = await SavedItem.countDocuments({ user: userBId, item: listingId });
    expect(savedItemsCount).toBe(1);
  });

  it("15. GET saved listings returns saved listing", async () => {
    const res = await request(app)
      .get("/api/marketplace/saved")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((item: any) => item._id === listingId);
    expect(found).toBeDefined();
  });

  it("10. owner can mark listing sold, and 11. marking sold preserves images", async () => {
    const res = await request(app)
      .patch(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ status: "sold" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("sold");
    expect(res.body.data.images.length).toBeGreaterThan(0);
    expect(res.body.data.imagePublicIds).toContain("pub-id-2");

    // Ensure deleteImage was NOT called for this operation
    expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
  });

  it("12. non-owner cannot mark sold", async () => {
    const res = await request(app)
      .patch(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ status: "sold" });

    expect(res.status).toBe(403);
  });

  it("16. unsave removes saved relation", async () => {
    const res = await request(app)
      .delete(`/api/marketplace/${listingId}/save`)
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    const savedItemsCount = await SavedItem.countDocuments({ user: userBId, item: listingId });
    expect(savedItemsCount).toBe(0);
  });

  it("18. non-owner DELETE returns 404/403", async () => {
    const res = await request(app)
      .delete(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(403);
  });

  it("17. owner DELETE succeeds and 19. removes associated saved references and deletes Cloudinary assets", async () => {
    // Save it first so we can verify cleanup
    await request(app)
      .post(`/api/marketplace/${listingId}/save`)
      .set("Authorization", `Bearer ${userBToken}`);

    const res = await request(app)
      .delete(`/api/marketplace/${listingId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);

    // Verify Cloudinary was called to delete the remaining assets
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith("pub-id-2");

    // Verify saved reference is gone
    const savedItemsCount = await SavedItem.countDocuments({ item: listingId });
    expect(savedItemsCount).toBe(0);
  });

  it("20. missing listing returns expected 404", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/marketplace/${fakeId}`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
  });

  it("21. negative/invalid price rejected", async () => {
    const res = await request(app)
      .post("/api/marketplace")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        title: "Bad Price Listing",
        category: "Books",
        price: -10
      });

    expect(res.status).toBe(422); // Zod validation fails with 422
  });
});
