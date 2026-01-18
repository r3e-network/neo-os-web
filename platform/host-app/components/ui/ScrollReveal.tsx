
import React from "react";
import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

type AnimationType = "fade-up" | "fade-down" | "slide-left" | "slide-right" | "scale-in" | "blur-in";

interface ScrollRevealProps {
    children: React.ReactNode;
    className?: string;
    animation?: AnimationType;
    delay?: number;
    duration?: number;
    threshold?: number; // 0 to 1
    offset?: number; // pixels
    reversible?: boolean;
}

const VARIANTS: Record<AnimationType, Variants> = {
    "fade-up": {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0 },
    },
    "fade-down": {
        hidden: { opacity: 0, y: -40 },
        visible: { opacity: 1, y: 0 },
    },
    "slide-left": {
        hidden: { opacity: 0, x: 40 },
        visible: { opacity: 1, x: 0 },
    },
    "slide-right": {
        hidden: { opacity: 0, x: -40 },
        visible: { opacity: 1, x: 0 },
    },
    "scale-in": {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 },
    },
    "blur-in": {
        hidden: { opacity: 0, filter: "blur(10px)" },
        visible: { opacity: 1, filter: "blur(0px)" },
    },
};

export function ScrollReveal({
    children,
    className,
    animation = "fade-up",
    delay = 0,
    duration = 0.5,
    threshold = 0.1,
    offset = 0,
    reversible = true,
}: ScrollRevealProps) {
    return (
        <motion.div
            className={cn(className)}
            initial="hidden"
            whileInView="visible"
            viewport={{
                once: !reversible,
                margin: `${offset}px`,
                amount: threshold,
            }}
            variants={VARIANTS[animation]}
            transition={{
                duration,
                delay,
                ease: [0.16, 1, 0.3, 1], // Smooth easeOutExpo-ish
            }}
        >
            {children}
        </motion.div>
    );
}
