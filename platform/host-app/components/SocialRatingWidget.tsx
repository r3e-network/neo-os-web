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

const StarIcon: React.FC<{ filled: boolean; onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void }> = ({ filled, onClick, onMouseEnter, onMouseLeave }) => (
  <svg
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    className={`w-7 h-7 cursor-pointer transition-transform hover:scale-110 active:scale-90 ${filled ? "text-brutal-yellow" : "text-gray-300"} drop-shadow-[2px_2px_0_rgba(0,0,0,1)]`}
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
    <div className="brutal-card p-6">
      {/* Error Display */}
      {displayError && (
        <div className="mb-4 p-4 bg-brutal-red border-2 border-black shadow-brutal-sm flex items-center justify-between">
          <span className="text-white text-xs font-black uppercase">{displayError}</span>
          <button
            onClick={() => {
              setLocalError(null);
              onClearError?.();
            }}
            className="text-white font-black hover:scale-110 active:scale-95 transition-transform px-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Rating Summary */}
      <div className="flex items-center gap-6 mb-6">
        <div className="text-6xl font-black bg-black text-white px-4 py-2 border-2 border-black rotate-[-2deg] shadow-brutal-sm">
          {rating.avg_rating.toFixed(1)}
        </div>
        <div>
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} filled={i <= Math.round(rating.avg_rating)} />
            ))}
          </div>
          <div className="text-xs font-black uppercase tracking-widest text-black/40 dark:text-white/40">
            {rating.total_ratings} VERIFIED RATINGS
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div className="space-y-2 mb-6 bg-gray-50 dark:bg-gray-900 p-4 border-2 border-black dark:border-white">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.distribution[star.toString()] || 0;
          const pct = rating.total_ratings > 0 ? (count / rating.total_ratings) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-xs font-black uppercase">
              <span className="w-4">{star}★</span>
              <div className="flex-1 bg-white dark:bg-black border-2 border-black dark:border-white h-3 p-[1px]">
                <div className="bg-neo h-full border-r border-black" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 text-right opacity-50">{count}</span>
            </div>
          );
        })}
      </div>

      {/* User Rating */}
      <div className="border-t-4 border-black dark:border-white pt-6">
        {canRate ? (
          isEditing ? (
            <div className="space-y-4">
              <div className="flex gap-2 p-2 bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-white w-fit">
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon
                    key={i}
                    filled={i <= (hoverValue || selectedValue)}
                    onClick={() => setSelectedValue(i)}
                    onMouseEnter={() => setHoverValue(i)}
                    onMouseLeave={() => setHoverValue(0)}
                  />
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="BRUTALLY HONEST REVIEW..."
                className="brutal-input w-full p-4 text-sm font-bold min-h-[120px]"
                maxLength={1000}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading || selectedValue === 0}
                  className="brutal-btn px-6 py-2 flex-1 disabled:opacity-50"
                >
                  {loading ? "SUBMITTING..." : "POST REVIEW"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-black uppercase text-xs px-4"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="brutal-btn w-full py-3"
            >
              {rating.user_rating ? "REVISE YOUR REVIEW" : "WRITE A REVIEW"}
            </button>
          )
        ) : (
          <div className="bg-brutal-yellow p-4 border-2 border-black shadow-brutal-sm text-center text-xs font-black uppercase">
            CONNECT WALLET TO RATE
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialRatingWidget;
