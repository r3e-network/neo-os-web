/**
 * Unit tests for SocialCommentItem component
 * Target: ≥90% coverage
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CommentItem from "../../components/SocialCommentItem";
import type { SocialComment } from "../../components/types";

const mockComment: SocialComment = {
  id: "comment-1",
  app_id: "test-app",
  author_user_id: "user-1",
  parent_id: null,
  content: "This is a test comment",
  is_developer_reply: false,
  upvotes: 10,
  downvotes: 2,
  reply_count: 3,
  created_at: "2025-01-15T10:00:00Z",
  updated_at: "2025-01-15T10:00:00Z",
};

const mockDeveloperComment: SocialComment = {
  ...mockComment,
  id: "comment-dev",
  is_developer_reply: true,
  content: "Developer response here",
};

describe("SocialCommentItem", () => {
  const mockOnVote = jest.fn().mockResolvedValue(undefined);
  const mockOnReply = jest.fn().mockResolvedValue(undefined);
  const mockOnLoadReplies = jest.fn().mockResolvedValue([]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders comment content", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);
      expect(screen.getByText("This is a test comment")).toBeInTheDocument();
    });

    it("renders vote counts", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);
      // Check upvote button contains count
      const upvoteBtn = screen.getByText(/▲/).closest("button");
      expect(upvoteBtn).toHaveTextContent("10");
      // Check downvote button contains count
      const downvoteBtn = screen.getByText(/▼/).closest("button");
      expect(downvoteBtn).toHaveTextContent("2");
    });

    it("renders formatted date", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);
      expect(screen.getByText(/1\/15\/2025/)).toBeInTheDocument();
    });

    it("shows Developer badge for developer replies", () => {
      render(<CommentItem comment={mockDeveloperComment} onVote={mockOnVote} onReply={mockOnReply} />);
      expect(screen.getByText("Developer")).toBeInTheDocument();
    });

    it("does not show Developer badge for regular comments", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);
      expect(screen.queryByText("Developer")).not.toBeInTheDocument();
    });
  });

  describe("Voting", () => {
    it("calls onVote with upvote when clicking upvote button", async () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);

      const upvoteBtn = screen.getByText(/▲/).closest("button");
      fireEvent.click(upvoteBtn!);

      await waitFor(() => {
        expect(mockOnVote).toHaveBeenCalledWith("comment-1", "upvote");
      });
    });

    it("calls onVote with downvote when clicking downvote button", async () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);

      const downvoteBtn = screen.getByText(/▼/).closest("button");
      fireEvent.click(downvoteBtn!);

      await waitFor(() => {
        expect(mockOnVote).toHaveBeenCalledWith("comment-1", "downvote");
      });
    });
  });

  describe("Reply Functionality", () => {
    it("shows Reply button at depth 0", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} depth={0} />);
      expect(screen.getByText("Reply")).toBeInTheDocument();
    });

    it("hides Reply button at max depth (3)", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} depth={3} />);
      expect(screen.queryByText("Reply")).not.toBeInTheDocument();
    });

    it("opens reply form when clicking Reply", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);

      fireEvent.click(screen.getByText("Reply"));

      expect(screen.getByPlaceholderText("Write a reply...")).toBeInTheDocument();
    });

    it("closes reply form when clicking Cancel", () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);

      fireEvent.click(screen.getByText("Reply"));
      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Write a reply...")).not.toBeInTheDocument();
    });

    it("submits reply and clears form", async () => {
      render(
        <CommentItem
          comment={mockComment}
          onVote={mockOnVote}
          onReply={mockOnReply}
          onLoadReplies={mockOnLoadReplies}
        />,
      );

      fireEvent.click(screen.getByText("Reply"));
      const textarea = screen.getByPlaceholderText("Write a reply...");
      fireEvent.change(textarea, { target: { value: "My reply" } });
      fireEvent.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(mockOnReply).toHaveBeenCalledWith("comment-1", "My reply");
      });
    });

    it("does not submit empty reply", async () => {
      render(<CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} />);

      fireEvent.click(screen.getByText("Reply"));
      fireEvent.click(screen.getByText("Submit"));

      expect(mockOnReply).not.toHaveBeenCalled();
    });
  });

  describe("Load Replies", () => {
    it("shows reply count button when replies exist", () => {
      render(
        <CommentItem
          comment={mockComment}
          onVote={mockOnVote}
          onReply={mockOnReply}
          onLoadReplies={mockOnLoadReplies}
        />,
      );

      expect(screen.getByText("3 replies")).toBeInTheDocument();
    });

    it("loads replies when clicking reply count", async () => {
      const mockReplies: SocialComment[] = [
        { ...mockComment, id: "reply-1", content: "Reply content", reply_count: 0 },
      ];
      const loadReplies = jest.fn().mockResolvedValue(mockReplies);

      render(
        <CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} onLoadReplies={loadReplies} />,
      );

      fireEvent.click(screen.getByText("3 replies"));

      await waitFor(() => {
        expect(loadReplies).toHaveBeenCalledWith("comment-1");
      });

      await waitFor(() => {
        expect(screen.getByText("Reply content")).toBeInTheDocument();
      });
    });

    it("does not load replies when already loading", async () => {
      let resolvePromise: (value: SocialComment[]) => void;
      const slowLoadReplies = jest.fn().mockImplementation(
        () =>
          new Promise<SocialComment[]>((resolve) => {
            resolvePromise = resolve;
          }),
      );

      render(
        <CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} onLoadReplies={slowLoadReplies} />,
      );

      fireEvent.click(screen.getByText("3 replies"));
      fireEvent.click(screen.getByText("Loading..."));

      expect(slowLoadReplies).toHaveBeenCalledTimes(1);

      await waitFor(() => resolvePromise!([]));
    });
  });

  describe("Nested Depth", () => {
    it("applies indentation class at depth > 0", () => {
      const { container } = render(
        <CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} depth={1} />,
      );

      expect(container.firstChild).toHaveClass("ml-6");
    });

    it("does not apply indentation at depth 0", () => {
      const { container } = render(
        <CommentItem comment={mockComment} onVote={mockOnVote} onReply={mockOnReply} depth={0} />,
      );

      expect(container.firstChild).not.toHaveClass("ml-6");
    });
  });
});
