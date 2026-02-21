export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
  type: "text" | "system" | "tip";
  tipAmount?: string;
}

export interface ChatRoom {
  id: string;
  appId: string;
  name: string;
  participantCount: number;
}

export interface ChatUser {
  id: string;
  address: string;
  name: string;
  avatar?: string;
}
