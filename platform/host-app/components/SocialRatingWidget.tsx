import React, { useState } from "react";
import type { SocialRating } from "./types";

interface RatingWidgetProps {
  rating: SocialRating;
  onSubmit?: (value: number, review?: string) => Promise<boolean>;
  canRate: boolean;
  loading?: boolean;
  error?: { message: string; code?: string } | null;
  onClearError?: () => void;
}

const StarIcon: React.FC<{ filled: boolean; onClick?: () => void }> = ({ filled, onClick }) => (
  <svg
    onClick={onClick}
    className={`w-6 h-6 cursor-pointer ${filled ? "text-yellow-400" : "text-gray-300"}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export const SocialRatingWidget: React.FC<RatingWidgetProps> = ({
  rating,
  onSubmit,
  canRate,
  loading = false,
  error = null,
  onClearError,
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  const [selectedValue, setSelectedValue] = useState(rating.user_rating?.rating_value || 0);
  const [reviewText, setReviewText] = useState(rating.user_rating?.review_text || "");
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!onSubmit || selectedValue === 0) return;
    setLocalError(null);
    const success = await onSubmit(selectedValue, reviewText || undefined);
    if (success) {
      setIsEditing(false);
    } else {
      setLocalError("Failed to submit rating. Please try again.");
    }
  };

  const displayError = error?.message || localError;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Error Display */}
      {displayError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center justify-between">
            <span className="text-red-700 text-sm">{displayError}</span>
            <button
              onClick={() => {
                setLocalError(null);
                onClearError?.();
              }}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Rating Summary */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-4xl font-bold">{rating.avg_rating.toFixed(1)}</div>
        <div>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} filled={i <= Math.round(rating.avg_rating)} />
            ))}
          </div>
          <div className="text-sm text-gray-500">{rating.total_ratings} ratings</div>
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-1 mb-4">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.distribution[star.toString()] || 0;
          const pct = rating.total_ratings > 0 ? (count / rating.total_ratings) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3">{star}</span>
              <div className="flex-1 bg-gray-200 rounded h-2">
                <div className="bg-yellow-400 h-2 rounded" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-gray-500">{count}</span>
            </div>
          );
        })}
      </div>

      {/* User Rating */}
      {canRate && (
        <div className="border-t pt-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon key={i} filled={i <= (hoverValue || selectedValue)} onClick={() => setSelectedValue(i)} />
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write a review (optional)"
                className="w-full border rounded p-2 text-sm"
                rows={3}
                maxLength={1000}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading || selectedValue === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsEditing(true)} className="text-blue-600 text-sm">
              {rating.user_rating ? "Edit your rating" : "Rate this app"}
            </button>
          )}
        </div>
      )}

      {!canRate && <div className="border-t pt-4 text-sm text-gray-500">Use this app to leave a rating</div>}
    </div>
  );
};

export default SocialRatingWidget;
