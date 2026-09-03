export type Id = string;
export type ImageSource = string | number;

export type User = {
  id: Id;
  name: string;
  username: string;
  avatar?: ImageSource;
  college?: string;
  department?: string;
  year?: string;
  verified?: boolean;
  online?: boolean;
  bio?: string;
  interests?: string[];
  lat?: number;
  lon?: number;
  isFriend?: boolean;
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
  room: string;
  lecturer?: string;
  day: number;
  startTime: string;
  endTime: string;
  color: string;
};

export type EventItem = {
  id: Id;
  title: string;
  date: string;
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
};

export type Listing = {
  id: Id;
  title: string;
  price: number;
  category: string;
  image?: ImageSource;
  images?: ImageSource[];
  seller: User;
  status: "active" | "sold" | "draft";
  description?: string;
  createdAt: string;
  views: number;
};

export type Trip = {
  id: Id;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  image?: ImageSource;
  members: User[];
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

