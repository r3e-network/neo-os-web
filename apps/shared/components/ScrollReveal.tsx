import { useRef, useState, useEffect, type ReactNode } from "react";
import { useI18n } from "@shared/react";
import "./ScrollReveal.scss";

export interface ScrollRevealProps {
  animation?: "fade-up" | "fade-down" | "scale-in" | "slide-left" | "slide-right";
  delay?: number;
  duration?: number;
  threshold?: number;
  offset?: number;
  reversible?: boolean;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function ScrollReveal({
  animation = "fade-up",
  delay = 0,
  duration = 800,
  threshold = 0.1,
  offset = -50,
  reversible = false,
  ariaLabel,
  className,
  children,
}: ScrollRevealProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Failsafe: ensure content shows up eventually
    const failsafe = setTimeout(() => {
      if (!isVisible) setIsVisible(true);
    }, 600);

    // Use standard IntersectionObserver
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (!reversible) observer.disconnect();
        } else if (reversible) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: `0px 0px ${offset}px 0px`,
      },
    );

    observer.observe(el);

    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [threshold, offset, reversible, isVisible]);

  const classes = [
    "scroll-reveal",
    animation,
    isVisible && "is-visible",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={classes}
      style={{ transitionDelay: `${delay}ms`, transitionDuration: `${duration}ms` }}
      role="region"
      aria-label={ariaLabel || t("scrollRevealAriaLabel")}
    >
      {children}
    </div>
  );
}

export default ScrollReveal;
