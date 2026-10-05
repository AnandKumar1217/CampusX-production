export type Id = string;
export type ImageSource = string | number;

export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  end?: string;
  break?: boolean;
};

export type User = {
  id: Id;
  name: string;
  username: string;
  avatar?: ImageSource;
  avatarUrl?: string;
  college?: string;
  department?: string;
  year?: string;
  academicYear?: string;
  verified?: boolean;
  online?: boolean;
  lastSeenAt?: string;
  qrToken?: string | null;
  bio?: string;
  interests?: string[];
  lat?: number;
  lon?: number;
  isFriend?: boolean;
};

export type FriendRequestItem = {
  _id: Id;
  requester: User;
  recipient: User;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type Notification = {
  _id: string;
  user: string;
  actor?: User;
  type: string;
  title: string;
  body?: string;
  readAt?: string;
  target?: { route: string; params?: any };
  createdAt: string;
};

export type Post = {
  id: Id;
  author: User;
  body: string;
  image?: ImageSource;
  createdAt: string;
  reactions: number;
  comments: number;
  liked?: boolean;
  saved?: boolean;
};

export type Conversation = {
  id: Id;
  person: User;
  lastMessage: string;
  updatedAt: string;
  unread: number;
};

export type Message = {
  id: Id;
  conversationId: Id;
  senderId: Id;
  text: string;
  createdAt: string;
  status: "sending" | "sent" | "read" | "failed";
  attachmentName?: string;
};

export type TimetableEntry = {
  id: Id;
  subject: string;
  subjectCode?: string;
  room?: string;
  lecturer?: string;
  days: number[];
  startTime: string;
  endTime: string;
  color?: string;
  repeat?: string;
};

export type ScheduleClass = {
  id: Id;
  baseClassId?: Id;
  source: "base" | "special";
  date: string;
  day: number;
  subject: string;
  subjectCode?: string;
  room?: string;
  lecturer?: string;
  startTime: string;
  endTime: string;
  color?: string;
  changed: boolean;
  special?: boolean;
  overrideId?: Id;
  changedFrom?: string;
  original?: { day: number; startTime: string; endTime: string };
};

export type AcademicHoliday = {
  id: Id;
  name: string;
  date: string;
  type: "national" | "festival" | "college" | "optional" | "custom" | "no_class";
  description?: string;
  custom: boolean;
};

export type ActualSchedule = {
  date: string;
  dayOfWeek: number;
  holiday: AcademicHoliday | null;
  classes: ScheduleClass[];
};

export type EventItem = {
  id: Id;
  title: string;
  date: string; // Used for UI display, backend gives startsAt/endsAt
  startsAt?: string; // from backend Date
  endsAt?: string;   // from backend Date
  time: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  distance?: number;
  category: string;
  image?: ImageSource;
  interested: number;
  organizer?: User;
  description?: string;
  public?: boolean;
  attendance?: "none" | "maybe" | "going";
  capacity?: number;
  registrationDeadline?: string;
  status?: "draft" | "active" | "cancelled";
  draft?: boolean;
};

export type Listing = {
  id: Id;
  title: string;
  price: number;
  category: string;
  images: string[];
  seller: User;
  status: "active" | "sold" | "draft";
  description?: string;
  condition?: string;
  location?: string;
  negotiable?: boolean;
  createdAt: string;
  views: number;
};

export type Trip = {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  destination: string;
  destinationName?: string;
  destinationAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  placeId?: string;
  startDate: string;
  endDate?: string;
  meetingPoint?: string;
  departureTime?: string;
  tripType?: "Day Trip" | "Overnight" | "Multi-day";
  budgetPerPerson?: number;
  transport?: string;
  stay?: string;
  status: "draft" | "upcoming" | "active" | "completed" | "cancelled";
  createdBy: any;
  imageUrl?: string;
  
  // Legacy / UI mapping fields
  image?: ImageSource;
  members?: User[];
  myStatus?: "invited" | "accepted" | "declined" | "organizer";
};

export type TripMember = {
  _id: string;
  trip: string;
  user: User;
  role: "organizer" | "member";
  status: "invited" | "accepted" | "declined";
};

export type StudyGroup = {
  id: Id;
  name: string;
  subtitle: string;
  description?: string;
  members: number;
  icon: string;
  color: string;
  joined: boolean; // Just a placeholder, actual join state will be tracked per user
  creatorId?: Id;
};

export type CalendarItem = {
  id: Id;
  title: string;
  type: "exam" | "assignment" | "reminder" | "personal";
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  notes?: string;
  location?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarAgendaItem = {
  source: "class" | "event" | "personal";
  sourceId: Id;
  title: string;
  date: string; // YYYY-MM-DD local
  allDay: boolean;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  subtitle?: string;
  color?: string;
  location?: string;
  itemType?: "exam" | "assignment" | "reminder" | "personal"; // only for personal
};
