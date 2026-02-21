/**
 * Unit tests for SocialRatingWidget component
 * Target: ≥90% coverage
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SocialRatingWidget } from "../../components/SocialRatingWidget";
import type { SocialRating } from "../../components/types";

const mockRating: SocialRating = {
  app_id: "test-app",
  avg_rating: 4.2,
  weighted_score: 4.1,
  total_ratings: 150,
  distribution: { "1": 5, "2": 10, "3": 20, "4": 45, "5": 70 },
};

const mockRatingWithUserRating: SocialRating = {
  ...mockRating,
  user_rating: {
    rating_value: 4,
    review_text: "Great app!",
  },
};

describe("SocialRatingWidget", () => {
  describe("Rating Summary Display", () => {
    it("renders average rating correctly", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      expect(screen.getByText("4.2")).toBeInTheDocument();
    });

    it("renders total ratings count", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      expect(screen.getByText("150 ratings")).toBeInTheDocument();
    });

    it("renders star icons in summary", () => {
      const { container } = render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      // SVG stars are rendered - check for svg elements
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Rating Distribution", () => {
    it("renders distribution section with star levels", () => {
      const { container } = render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      // Check distribution section exists with 5 rows
      const distributionRows = container.querySelectorAll(".space-y-1 > div");
      expect(distributionRows.length).toBe(5);
    });

    it("displays correct count for each star level", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      // These counts are unique in the component
      expect(screen.getByText("70")).toBeInTheDocument(); // 5 stars
      expect(screen.getByText("45")).toBeInTheDocument(); // 4 stars
      expect(screen.getByText("20")).toBeInTheDocument(); // 3 stars
    });
  });

  describe("User Cannot Rate", () => {
    it("shows message when user cannot rate", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      expect(screen.getByText("Use this app to leave a rating")).toBeInTheDocument();
    });

    it("does not show rate button when canRate is false", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={false} />);

      expect(screen.queryByText("Rate this app")).not.toBeInTheDocument();
    });
  });

  describe("User Can Rate - New Rating", () => {
    it("shows 'Rate this app' button when canRate is true", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={true} />);

      expect(screen.getByText("Rate this app")).toBeInTheDocument();
    });

    it("opens rating form when clicking rate button", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={true} />);

      fireEvent.click(screen.getByText("Rate this app"));

      expect(screen.getByPlaceholderText("Write a review (optional)")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("closes rating form when clicking cancel", () => {
      render(<SocialRatingWidget rating={mockRating} canRate={true} />);

      fireEvent.click(screen.getByText("Rate this app"));
      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByPlaceholderText("Write a review (optional)")).not.toBeInTheDocument();
    });

    it("selects star rating when clicking star", () => {
      const { container } = render(<SocialRatingWidget rating={mockRating} canRate={true} />);

      fireEvent.click(screen.getByText("Rate this app"));

      // Click on the 4th star in the rating form
      const formStars = container.querySelectorAll(".border-t svg");
      fireEvent.click(formStars[3]);

      // Star should be filled (yellow)
      expect(formStars[3]).toHaveClass("text-yellow-400");
    });

    it("submits rating when clicking Submit", async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      const { container } = render(<SocialRatingWidget rating={mockRating} canRate={true} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByText("Rate this app"));

      // Select 4 stars
      const formStars = container.querySelectorAll(".border-t svg");
      fireEvent.click(formStars[3]);

      // Add review text
      const textarea = screen.getByPlaceholderText("Write a review (optional)");
      fireEvent.change(textarea, { target: { value: "Great app!" } });

      fireEvent.click(screen.getByText("Submit"));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(4, "Great app!");
      });
    });

    it("does not submit when no stars selected", async () => {
      const mockOnSubmit = jest.fn();
      render(<SocialRatingWidget rating={mockRating} canRate={true} onSubmit={mockOnSubmit} />);

      fireEvent.click(screen.getByText("Rate this app"));
      fireEvent.click(screen.getByText("Submit"));

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("User Can Rate - Edit Existing Rating", () => {
    it("shows 'Edit your rating' when user has existing rating", () => {
      render(<SocialRatingWidget rating={mockRatingWithUserRating} canRate={true} />);

      expect(screen.getByText("Edit your rating")).toBeInTheDocument();
    });

    it("pre-fills form with existing rating", () => {
      const { container } = render(<SocialRatingWidget rating={mockRatingWithUserRating} canRate={true} />);

      fireEvent.click(screen.getByText("Edit your rating"));

      // Check textarea has existing review
      const textarea = screen.getByPlaceholderText("Write a review (optional)") as HTMLTextAreaElement;
      expect(textarea.value).toBe("Great app!");
    });
  });
});
