export interface ForumThread {
  id: string;
  app_id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  category: "general" | "bug" | "feature" | "help";
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
}

export interface ForumReply {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  content: string;
  is_solution: boolean;
  upvotes: number;
  created_at: string;
}
