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
    className={`w-6 h-6 cursor-pointer transition-transform hover:scale-110 active:scale-90 ${filled ? "text-yellow-400" : "text-erobo-ink-soft/40 dark:text-slate-600"} ${onClick ? "hover:text-yellow-500" : ""}`}
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
    <div className="bg-white dark:bg-white/5 backdrop-blur-sm border border-erobo-purple/10 dark:border-white/10 p-6 rounded-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-neo/5 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />

      {displayError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center justify-between">
          <span className="text-red-700 dark:text-red-400 text-xs font-bold uppercase">{displayError}</span>
          <button
            onClick={() => {
              setLocalError(null);
              onClearError?.();
            }}
            className="text-red-500 hover:text-red-700 px-2 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center gap-6 mb-6">
        <div className="text-5xl font-bold text-erobo-ink dark:text-white">
          {rating.avg_rating.toFixed(1)}
        </div>
        <div>
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <StarIcon key={i} filled={i <= Math.round(rating.avg_rating)} />
            ))}
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-erobo-ink-soft dark:text-slate-400">
            {rating.total_ratings} VERIFIED RATINGS
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = rating.distribution[star.toString()] || 0;
          const pct = rating.total_ratings > 0 ? (count / rating.total_ratings) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-3 text-xs font-medium text-erobo-ink-soft dark:text-slate-400">
              <span className="w-3">{star}★</span>
              <div className="flex-1 bg-erobo-purple/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-neo h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right opacity-60">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-erobo-purple/5 dark:border-white/10 pt-6">
        {canRate ? (
          isEditing ? (
            <div className="space-y-4">
              <div className="flex gap-1">
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
                placeholder="Share your experience..."
                className="w-full p-3 text-sm bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-neo/20 focus:border-neo transition-all outline-none min-h-[100px] text-erobo-ink dark:text-white placeholder-erobo-ink-soft/50"
                maxLength={1000}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading || selectedValue === 0}
                  className="px-6 py-2.5 bg-neo text-black font-bold rounded-lg hover:bg-neo-dark transition-colors flex-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,229,153,0.3)] hover:shadow-[0_0_20px_rgba(0,229,153,0.4)]"
                >
                  {loading ? "Submitting..." : "Post Review"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 text-xs font-bold text-erobo-ink-soft hover:bg-erobo-purple/10 dark:hover:bg-white/10 rounded-lg transition-colors uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-3 bg-erobo-purple/5 dark:bg-white/5 text-erobo-ink dark:text-white font-bold rounded-xl hover:bg-erobo-purple/10 dark:hover:bg-white/10 transition-colors border border-erobo-purple/10 dark:border-white/10"
            >
              {rating.user_rating ? "Edit Review" : "Write a Review"}
            </button>
          )
        ) : (
          <div className="p-4 bg-erobo-purple/5 dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 rounded-xl text-center text-xs font-bold text-erobo-ink-soft uppercase">
            Connect wallet to rate
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialRatingWidget;
