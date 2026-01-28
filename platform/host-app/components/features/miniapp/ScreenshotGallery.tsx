import React, { useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Screenshot {
  url: string;
  caption?: string;
  thumbnail?: string;
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  appName?: string;
  className?: string;
}

export function ScreenshotGallery({ screenshots, appName, className }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : screenshots.length - 1));
  }, [screenshots.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : 0));
  }, [screenshots.length]);

  const openLightbox = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  if (!screenshots || screenshots.length === 0) {
    return null;
  }

  const visibleCount = Math.min(screenshots.length, 4);
  const showNavigation = screenshots.length > 4;

  return (
    <div className={cn("relative", className)}>
      {/* Gallery Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-erobo-ink dark:text-white">Screenshots</h3>
        <span className="text-xs text-erobo-ink-soft/60 dark:text-gray-500">
          {screenshots.length} images
        </span>
      </div>

      {/* Thumbnail Strip */}
      <div className="relative">
        {showNavigation && (
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-white/10 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-white/20 transition-all"
          >
            <ChevronLeft size={16} className="text-erobo-ink dark:text-white" />
          </button>
        )}

        <div className="overflow-hidden rounded-xl">
          <div
            className="flex gap-3 transition-transform duration-300 ease-out"
            style={{
              transform: showNavigation ? `translateX(-${currentIndex * (100 / visibleCount)}%)` : undefined,
            }}
          >
            {screenshots.map((screenshot, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 group cursor-pointer"
                style={{ width: `calc(${100 / visibleCount}% - ${(visibleCount - 1) * 12 / visibleCount}px)` }}
                onClick={() => openLightbox(index)}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-erobo-ink/5 dark:bg-white/5 border border-white/60 dark:border-white/10">
                  <Image
                    src={screenshot.thumbnail || screenshot.url}
                    alt={screenshot.caption || `${appName} screenshot ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Maximize2
                      size={24}
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
                {screenshot.caption && (
                  <p className="mt-2 text-xs text-erobo-ink-soft/70 dark:text-gray-400 truncate">
                    {screenshot.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-white/10 border border-white/60 dark:border-white/10 flex items-center justify-center shadow-lg hover:bg-white dark:hover:bg-white/20 transition-all"
          >
            <ChevronRight size={16} className="text-erobo-ink dark:text-white" />
          </button>
        )}
      </div>

      {/* Dots Indicator */}
      {showNavigation && (
        <div className="flex justify-center gap-1.5 mt-4">
          {screenshots.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-erobo-purple w-4"
                  : "bg-erobo-ink/20 dark:bg-white/20 hover:bg-erobo-ink/40 dark:hover:bg-white/40"
              )}
            />
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <X size={20} className="text-white" />
            </button>

            {/* Navigation */}
            {screenshots.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : screenshots.length - 1));
                  }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                >
                  <ChevronLeft size={24} className="text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex((prev) => (prev! < screenshots.length - 1 ? prev! + 1 : 0));
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                >
                  <ChevronRight size={24} className="text-white" />
                </button>
              </>
            )}

            {/* Image */}
            <motion.div
              key={selectedIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[90vw] max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={screenshots[selectedIndex].url}
                alt={screenshots[selectedIndex].caption || `${appName} screenshot`}
                width={1200}
                height={800}
                className="object-contain max-h-[85vh] rounded-lg"
              />
              {screenshots[selectedIndex].caption && (
                <p className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-sm text-center rounded-b-lg">
                  {screenshots[selectedIndex].caption}
                </p>
              )}
            </motion.div>

            {/* Counter */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm">
              {selectedIndex + 1} / {screenshots.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
