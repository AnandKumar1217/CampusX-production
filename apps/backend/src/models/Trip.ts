import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const tripSchema = new Schema(
  {
    title: { type: String, required: true },
    destination: { type: String, required: true },
    imageUrl: String,
    startDate: Date,
    endDate: Date,
    budgetPerPerson: { type: Number, min: 0 },
    createdBy: { type: objectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "upcoming", "active", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },
    interests: [String],
    transport: String,
    stay: String,
  },
  { timestamps: true, versionKey: false },
);

const tripMemberSchema = new Schema(
  {
    trip: { type: objectId, ref: "Trip", required: true, index: true },
    user: { type: objectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["organizer", "member"], default: "member" },
    status: {
      type: String,
      enum: ["invited", "accepted", "declined"],
      default: "invited",
    },
  },
  { timestamps: true, versionKey: false },
);
tripMemberSchema.index({ trip: 1, user: 1 }, { unique: true });

const itinerarySchema = new Schema(
  {
    trip: { type: objectId, ref: "Trip", required: true, index: true },
    day: { type: Number, required: true },
    startsAt: String,
    title: { type: String, required: true },
    location: String,
    notes: String,
    position: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
itinerarySchema.index({ trip: 1, day: 1, position: 1 });

const tripVoteSchema = new Schema(
  {
    trip: { type: objectId, ref: "Trip", required: true, index: true },
    question: { type: String, required: true },
    options: [{ label: String, voters: [{ type: objectId, ref: "User" }] }],
    closesAt: Date,
  },
  { timestamps: true, versionKey: false },
);

const tripExpenseSchema = new Schema(
  {
    trip: { type: objectId, ref: "Trip", required: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidBy: { type: objectId, ref: "User", required: true },
    splitAmong: [{ type: objectId, ref: "User" }],
    shares: [{ user: { type: objectId, ref: "User" }, amount: Number }],
    settledBy: [{ user: { type: objectId, ref: "User" }, settledAt: Date }],
  },
  { timestamps: true, versionKey: false },
);
tripExpenseSchema.index({ trip: 1, createdAt: -1 });

export const Trip = model("Trip", tripSchema);
export const TripMember = model("TripMember", tripMemberSchema);
export const TripItinerary = model("TripItinerary", itinerarySchema);
export const TripVote = model("TripVote", tripVoteSchema);
export const TripExpense = model("TripExpense", tripExpenseSchema);
