import { model, Schema } from "mongoose";

const objectId = Schema.Types.ObjectId;
const eventSchema = new Schema(
  {
    title: { type: String, required: true, index: true },
    description: { type: String, maxlength: 5000 },
    imageUrl: String,
    imagePublicId: String,
    category: { type: String, index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: Date,
    location: {
      name: String,
      coordinates: { type: [Number], index: "2dsphere" },
    },
    creator: { type: objectId, ref: "User", required: true },
    attendees: [
      {
        user: { type: objectId, ref: "User" },
        status: { type: String, enum: ["going", "maybe"] },
        registeredAt: { type: Date, default: Date.now },
      },
    ],
    capacity: { type: Number, min: 1 },
    registrationDeadline: Date,
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    draft: { type: Boolean, default: false },
    cancelledAt: Date,
  },
  { timestamps: true, versionKey: false },
);

eventSchema.index({ cancelledAt: 1 }, { expireAfterSeconds: 86400 });

const listingSchema = new Schema(
  {
    seller: { type: objectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, maxlength: 4000 },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    negotiable: { type: Boolean, default: true },
    images: [String],
    imagePublicIds: [String],
    condition: String,
    location: {
      name: String,
      address: String,
      latitude: Number,
      longitude: Number,
    },
    viewedBy: [{ type: objectId, ref: "User" }],
    status: {
      type: String,
      enum: ["active", "sold", "draft"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true, versionKey: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);
listingSchema.virtual("views").get(function (this: any) {
  return this.viewedBy ? this.viewedBy.length : 0;
});
listingSchema.index({ title: "text", description: "text", category: "text" });

const timetableEntrySchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true },
    subjectCode: { type: String, trim: true, maxlength: 40 },
    room: String,
    lecturer: String,
    days: [{ type: Number, min: 0, max: 6 }],
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    color: String,
    repeat: {
      type: String,
      enum: ["none", "weekly", "custom"],
      default: "weekly",
    },
    importBatchId: { type: String, index: true },
  },
  { timestamps: true, versionKey: false },
);
timetableEntrySchema.index({ user: 1, days: 1, startTime: 1 });

export const Event = model("Event", eventSchema);
export const MarketplaceListing = model("MarketplaceListing", listingSchema);
export const TimetableEntry = model("TimetableEntry", timetableEntrySchema);

const timetableSettingsSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, unique: true, index: true },
    activeImportBatchId: { type: String },
    timetableRevision: { type: Number, default: 0 },
    gridTimeSlots: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        start: { type: String, required: true },
        end: { type: String },
        break: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true, versionKey: false },
);

export const TimetableSettings = model("TimetableSettings", timetableSettingsSchema);

const scheduleOverrideSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    timetableClass: { type: objectId, ref: "TimetableEntry", required: true, index: true },
    scope: { type: String, enum: ["one_date", "future"], required: true },
    date: { type: String },
    effectiveFrom: { type: String },
    newDay: { type: Number, min: 0, max: 6 },
    newStartTime: String,
    newEndTime: String,
    cancelled: { type: Boolean, default: false },
    reason: { type: String, trim: true, maxlength: 300 },
    operationId: { type: String, index: true },
  },
  { timestamps: true, versionKey: false },
);
scheduleOverrideSchema.index(
  { user: 1, timetableClass: 1, scope: 1, date: 1 },
  { unique: true, partialFilterExpression: { scope: "one_date" } },
);
scheduleOverrideSchema.index(
  { user: 1, timetableClass: 1, scope: 1, effectiveFrom: 1 },
  { unique: true, partialFilterExpression: { scope: "future" } },
);

const specialClassSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    subjectCode: { type: String, trim: true, maxlength: 40 },
    room: { type: String, trim: true, maxlength: 100 },
    lecturer: { type: String, trim: true, maxlength: 120 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    color: String,
  },
  { timestamps: true, versionKey: false },
);
specialClassSchema.index({ user: 1, date: 1, startTime: 1 });

const customHolidaySchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, enum: ["custom", "no_class"], default: "no_class" },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);
customHolidaySchema.index({ user: 1, date: 1 }, { unique: true });

export const ScheduleOverride = model("ScheduleOverride", scheduleOverrideSchema);
export const SpecialClass = model("SpecialClass", specialClassSchema);
export const CustomHoliday = model("CustomHoliday", customHolidaySchema);

const calendarItemSchema = new Schema(
  {
    user: { type: objectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, required: true, enum: ["exam", "assignment", "reminder", "personal"] },
    date: { type: String, required: true }, // YYYY-MM-DD local
    allDay: { type: Boolean, default: true },
    startTime: { type: String }, // HH:MM
    endTime: { type: String }, // HH:MM
    notes: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, trim: true, maxlength: 200 },
    color: String,
  },
  { timestamps: true, versionKey: false },
);
calendarItemSchema.index({ user: 1, date: 1 });

export const CalendarItem = model("CalendarItem", calendarItemSchema);
