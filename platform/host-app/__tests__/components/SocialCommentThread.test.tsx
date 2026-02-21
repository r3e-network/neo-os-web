/**
 * Unit tests for SocialCommentThread component
 * Target: ≥90% coverage
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SocialCommentThread } from "../../components/SocialCommentThread";
import type { SocialComment } from "../../components/types";

const mockComments: SocialComment[] = [
  {
    id: "c1",
    app_id: "test-app",
    author_user_id: "user-1",
    parent_id: null,
    content: "First comment",
    is_developer_reply: false,
    upvotes: 5,
    downvotes: 1,
    reply_count: 2,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  },
  {
    id: "c2",
    app_id: "test-app",
    author_user_id: "user-2",
    parent_id: null,
    content: "Second comment",
    is_developer_reply: true,
    upvotes: 10,
    downvotes: 0,
    reply_count: 0,
    created_at: "2025-01-15T11:00:00Z",
    updated_at: "2025-01-15T11:00:00Z",
  },
];

describe("SocialCommentThread", () => {
  const mockOnCreateComment = jest.fn().mockResolvedValue(true);
  const mockOnVote = jest.fn().mockResolvedValue(true);
  const mockOnReply = jest.fn().mockResolvedValue(true);
  const mockOnLoadReplies = jest.fn().mockResolvedValue([]);
  const mockOnLoadMore = jest.fn().mockResolvedValue(undefined);

  const defaultProps = {
    appId: "test-app",
    comments: mockComments,
    canComment: true,
    onCreateComment: mockOnCreateComment,
    onVote: mockOnVote,
    onReply: mockOnReply,
    onLoadReplies: mockOnLoadReplies,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders comment count in header", () => {
      render(<SocialCommentThread {...defaultProps} />);
      expect(screen.getByText("Comments (2)")).toBeInTheDocument();
    });

    it("renders all comments", () => {
      render(<SocialCommentThread {...defaultProps} />);
      expect(screen.getByText("First comment")).toBeInTheDocument();
      expect(screen.getByText("Second comment")).toBeInTheDocument();
    });

    it("shows empty state when no comments", () => {
      render(<SocialCommentThread {...defaultProps} comments={[]} />);
      expect(screen.getByText("No comments yet")).toBeInTheDocument();
    });
  });

  describe("Comment Form", () => {
    it("shows comment form when canComment is true", () => {
      render(<SocialCommentThread {...defaultProps} />);
      expect(screen.getByPlaceholderText("Write a comment...")).toBeInTheDocument();
    });

    it("hides comment form when canComment is false", () => {
      render(<SocialCommentThread {...defaultProps} canComment={false} />);
      expect(screen.queryByPlaceholderText("Write a comment...")).not.toBeInTheDocument();
      expect(screen.getByText("Use this app to leave comments")).toBeInTheDocument();
    });

    it("submits comment when clicking Post Comment", async () => {
      render(<SocialCommentThread {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Write a comment...");
      fireEvent.change(textarea, { target: { value: "New comment" } });
      fireEvent.click(screen.getByText("Post Comment"));

      await waitFor(() => {
        expect(mockOnCreateComment).toHaveBeenCalledWith("New comment");
      });
    });

    it("clears textarea after successful submit", async () => {
      render(<SocialCommentThread {...defaultProps} />);

      const textarea = screen.getByPlaceholderText("Write a comment...") as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: "New comment" } });
      fireEvent.click(screen.getByText("Post Comment"));

      await waitFor(() => {
        expect(textarea.value).toBe("");
      });
    });

    it("disables submit button when textarea is empty", () => {
      render(<SocialCommentThread {...defaultProps} />);
      const submitBtn = screen.getByText("Post Comment");
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("Load More", () => {
    it("shows Load More button when hasMore is true", () => {
      render(<SocialCommentThread {...defaultProps} hasMore={true} onLoadMore={mockOnLoadMore} />);
      expect(screen.getByText("Load more comments")).toBeInTheDocument();
    });

    it("hides Load More button when hasMore is false", () => {
      render(<SocialCommentThread {...defaultProps} hasMore={false} />);
      expect(screen.queryByText("Load more comments")).not.toBeInTheDocument();
    });

    it("calls onLoadMore when clicking Load More", async () => {
      render(<SocialCommentThread {...defaultProps} hasMore={true} onLoadMore={mockOnLoadMore} />);

      fireEvent.click(screen.getByText("Load more comments"));

      await waitFor(() => {
        expect(mockOnLoadMore).toHaveBeenCalled();
      });
    });

    it("shows Loading... when loading is true", () => {
      render(<SocialCommentThread {...defaultProps} hasMore={true} loading={true} onLoadMore={mockOnLoadMore} />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });
});
