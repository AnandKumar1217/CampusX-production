import fs from 'fs';

const path = 'apps/backend/src/routes/commerceRoutes.ts';
let code = fs.readFileSync(path, 'utf8');

const startIdx = code.indexOf('export const marketplaceRouter = Router();');
const endIdx = code.indexOf('export const timetableRouter = Router();');

const newRouterCode = `export const marketplaceRouter = Router();

marketplaceRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const query = String(request.query.q ?? "").trim();
    const category = request.query.category ? String(request.query.category) : null;
    const sort = String(request.query.sort || "newest");
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;

    let filter: any = { status: "available" };
    if (category && category !== "All") filter.category = category;
    if (query) filter.$text = { $search: query };

    // Cursor Pagination
    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        if (sort === "price_asc") {
          filter.$or = [
            { price: { $gt: cursorData.price } },
            { price: cursorData.price, _id: { $gt: cursorData._id } }
          ];
        } else if (sort === "price_desc") {
          filter.$or = [
            { price: { $lt: cursorData.price } },
            { price: cursorData.price, _id: { $lt: cursorData._id } }
          ];
        } else {
          // newest
          if (query) {
             filter.score = { $lt: cursorData.score };
          } else {
             filter.$or = [
               { createdAt: { $lt: cursorData.createdAt } },
               { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
             ];
          }
        }
      } catch (e) {
        console.error("Invalid cursor");
      }
    }

    let sortObj: any = { createdAt: -1, _id: -1 };
    if (sort === "price_asc") sortObj = { price: 1, _id: 1 };
    if (sort === "price_desc") sortObj = { price: -1, _id: -1 };
    if (query) {
      sortObj = { score: { $meta: "textScore" } };
    }

    let dbQuery = MarketplaceListing.find(filter)
      .populate("seller", "name username avatarUrl")
      .select("-description -images")
      .sort(sortObj)
      .limit(limit + 1)
      .lean();
      
    if (query) {
      dbQuery = dbQuery.select({ score: { $meta: "textScore" }, description: 0, images: 0 });
    }

    const items = await dbQuery;

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      let cursorData: any = {};
      if (sort === "price_asc" || sort === "price_desc") {
        cursorData = { price: lastItem.price, _id: lastItem._id };
      } else {
        if (query) {
           cursorData = { score: (lastItem as any).score };
        } else {
           cursorData = { createdAt: lastItem.createdAt, _id: lastItem._id };
        }
      }
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    // Apply Cloudinary transformations to coverImage
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? \`https://res.cloudinary.com/dzs0qjuzm/image/upload/w_500,c_fill,f_auto,q_auto/\${item.imagePublicIds[0]}\`
        : null;
      
      const formatted = {
        ...item,
        coverImage,
      };
      delete formatted.imagePublicIds;
      return formatted;
    });

    return sendSuccess(response, { items: formattedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(180),
      description: z.string().max(4000).optional(),
      category: z.string().min(1).max(80),
      price: z.number().min(0),
      negotiable: z.boolean().default(true),
      images: z.array(z.url()).max(5).default([]),
      imagePublicIds: z.array(z.string()).max(5).default([]),
      condition: z.string().max(80).optional(),
      location: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        coordinates: z.array(z.number()).optional()
      }).optional(),
      draft: z.boolean().default(false),
    }).parse(request.body);

    const item = await MarketplaceListing.create({
      ...input,
      seller: request.user!._id,
      status: input.draft ? "draft" : "available",
    });

    if (!input.draft) {
      request.app.get("io")?.emit("marketplace:listing_updated", { listingId: item._id.toString() });
    }

    return sendSuccess(response, item, "Listing created", 201);
  })
);

marketplaceRouter.get(
  "/mine",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const statusFilter = String(request.query.status || "available");
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;
    
    let filter: any = { seller: request.user!._id };
    if (statusFilter === "available") {
      filter.status = { $in: ["available", "reserved"] };
    } else if (statusFilter === "draft") {
      filter.status = "draft";
    } else if (statusFilter === "sold") {
      filter.status = "sold";
    }

    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        filter.$or = [
          { createdAt: { $lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
        ];
      } catch (e) {
        console.error("Invalid cursor");
      }
    }

    const items = await MarketplaceListing.find(filter)
      .select("-description -images")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, _id: lastItem._id })).toString('base64');
    }
    
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? \`https://res.cloudinary.com/dzs0qjuzm/image/upload/w_500,c_fill,f_auto,q_auto/\${item.imagePublicIds[0]}\`
        : null;
      return { ...item, coverImage, imagePublicIds: undefined };
    });

    return sendSuccess(response, { items: formattedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.get(
  "/saved",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 16, 1), 40);
    const cursorStr = request.query.cursor ? String(request.query.cursor) : null;
    
    let savedFilter: any = { user: request.user!._id, itemType: "listing" };
    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        savedFilter.$or = [
          { createdAt: { $lt: cursorData.createdAt } },
          { createdAt: cursorData.createdAt, _id: { $lt: cursorData._id } }
        ];
      } catch (e) {}
    }

    const savedItems = await SavedItem.find(savedFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
      
    const hasMore = savedItems.length > limit;
    if (hasMore) savedItems.pop();
    
    let nextCursor = null;
    if (hasMore && savedItems.length > 0) {
      const lastItem = savedItems[savedItems.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, _id: lastItem._id })).toString('base64');
    }

    const listingIds = savedItems.map(s => s.item);
    
    const items = await MarketplaceListing.find({ _id: { $in: listingIds }, status: { $ne: "draft" } })
      .populate("seller", "name username avatarUrl verified")
      .select("-description -images")
      .lean();
      
    const formattedItems = items.map(item => {
      let coverImage = item.imagePublicIds?.[0] 
        ? \`https://res.cloudinary.com/dzs0qjuzm/image/upload/w_500,c_fill,f_auto,q_auto/\${item.imagePublicIds[0]}\`
        : null;
      return { ...item, coverImage, imagePublicIds: undefined };
    });
      
    // Sort items to match savedItems order
    const orderedItems = savedItems
      .map(s => formattedItems.find(i => i._id.toString() === s.item.toString()))
      .filter(Boolean);

    return sendSuccess(response, { items: orderedItems, hasMore, nextCursor });
  })
);

marketplaceRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id)
      .populate("seller", "name username avatarUrl verified")
      .lean();
      
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.status === "draft" && item.seller._id.toString() !== request.user!._id.toString())
      throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");

    if (item.seller._id.toString() !== request.user!._id.toString()) {
      await MarketplaceListing.updateOne(
        { _id: item._id },
        { $addToSet: { viewedBy: request.user!._id } }
      );
    }

    return sendSuccess(response, item);
  })
);

marketplaceRouter.patch(
  "/:id",
  asyncHandler(async (request, response) => {
    const input = z.object({
      title: z.string().min(3).max(180).optional(),
      description: z.string().max(4000).optional(),
      category: z.string().min(1).max(80).optional(),
      price: z.number().min(0).optional(),
      status: z.enum(["available", "sold", "draft", "reserved", "deleted"]).optional(),
      location: z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        coordinates: z.array(z.number()).optional()
      }).optional(),
      images: z.array(z.url()).max(5).optional(),
      imagePublicIds: z.array(z.string()).max(5).optional(),
    }).parse(request.body);

    const oldListing = await MarketplaceListing.findById(request.params.id);
    if (!oldListing) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (oldListing.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized", "FORBIDDEN");
    }
    
    const oldIds = oldListing.imagePublicIds || [];
    const newIds = input.imagePublicIds || [];
    const newlyAddedIds = newIds.filter((id) => !oldIds.includes(id));
    const removedIds = oldIds.filter((id) => !newIds.includes(id));

    try {
      const item = await MarketplaceListing.findOneAndUpdate(
        { _id: request.params.id, seller: request.user!._id },
        { $set: input },
        { new: true, runValidators: true }
      ).populate("seller", "name username avatarUrl verified");

      if (item) {
        request.app.get("io")?.emit("marketplace:listing_updated", { listingId: item._id.toString() });
      }
      
      // Cleanup OLD images after success
      if (input.imagePublicIds) {
        for (const removedId of removedIds) {
          cloudinaryService.deleteImage(removedId).catch(console.error);
        }
      }
      
      return sendSuccess(response, item, "Listing updated");
    } catch (error) {
      // Cleanup NEW images if DB update failed
      if (input.imagePublicIds) {
        for (const addedId of newlyAddedIds) {
           cloudinaryService.deleteImage(addedId).catch(console.error);
        }
      }
      throw error;
    }
  })
);

marketplaceRouter.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findById(request.params.id);
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.seller.toString() !== request.user!._id.toString()) {
      throw new AppError(403, "Not authorized", "FORBIDDEN");
    }

    const publicIdsToDelete = item.imagePublicIds || [];

    // Delete DB first
    await item.deleteOne();
    await SavedItem.deleteMany({ itemType: "listing", item: item._id });

    // Emit event
    request.app.get("io")?.emit("marketplace:listing_deleted", { listingId: request.params.id });
    
    // Cloudinary cleanup AFTER DB success
    if (publicIdsToDelete.length > 0) {
      for (const publicId of publicIdsToDelete) {
        cloudinaryService.deleteImage(publicId).catch(e => {
          console.error(\`Failed to clean up cloudinary image \${publicId} for deleted listing \${item._id}\`, e);
        });
      }
    }

    return sendSuccess(response, null, "Listing deleted");
  })
);

marketplaceRouter.post(
  "/:id/save",
  asyncHandler(async (request, response) => {
    const item = await MarketplaceListing.findOne({ _id: request.params.id, status: "available" });
    if (!item) throw new AppError(404, "Listing not found", "LISTING_NOT_FOUND");
    if (item.seller.toString() === request.user!._id.toString()) {
      throw new AppError(400, "Cannot save your own listing", "BAD_REQUEST");
    }
    
    await SavedItem.findOneAndUpdate(
      { user: request.user!._id, itemType: "listing", item: item._id },
      { user: request.user!._id, itemType: "listing", item: item._id },
      { upsert: true, new: true }
    );
    return sendSuccess(response, null, "Listing saved");
  })
);

marketplaceRouter.delete(
  "/:id/save",
  asyncHandler(async (request, response) => {
    await SavedItem.findOneAndDelete({
      user: request.user!._id,
      itemType: "listing",
      item: request.params.id
    });
    return sendSuccess(response, null, "Listing unsaved");
  })
);

`;

if (startIdx !== -1 && endIdx !== -1) {
  let finalCode = code.substring(0, startIdx) + newRouterCode + code.substring(endIdx);
  fs.writeFileSync(path, finalCode, 'utf8');
  console.log("Updated commerceRoutes.ts successfully");
} else {
  console.log("Could not find insertion points");
}
