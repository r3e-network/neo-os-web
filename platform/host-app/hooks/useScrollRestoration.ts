import { useEffect } from "react";
import type { Router } from "next/router";

export function useScrollRestoration(router: Router) {
    useEffect(() => {
        if ("scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }

        const isShallowRef = { current: false };

        const handleRouteChangeStart = (url: string, { shallow }: { shallow: boolean }) => {
            isShallowRef.current = shallow;
            // Don't save scroll position on shallow routing (e.g. filter changes)
            if (shallow) return;

            sessionStorage.setItem(`scrollPos:${router.asPath}`, window.scrollY.toString());
        };

        const handleRouteChangeComplete = (url: string) => {
            if (isShallowRef.current) {
                isShallowRef.current = false;
                return;
            }

            const scrollPos = sessionStorage.getItem(`scrollPos:${url}`);
            if (scrollPos) {
                const targetY = Number(scrollPos);

                // Attempt restoration with retries for dynamic content
                const attemptScroll = () => {
                    const currentMaxScroll = document.documentElement.scrollHeight - window.innerHeight;

                    // If we can reach the target (or close enough), scroll there and stop
                    if (currentMaxScroll >= targetY) {
                        window.scrollTo(0, targetY);
                        return true; // Done
                    }
                    return false; // Not ready yet
                };

                // Try immediately
                if (attemptScroll()) return;

                // Poll for content loading (max 2 seconds)
                const interval = setInterval(() => {
                    if (attemptScroll()) {
                        clearInterval(interval);
                    }
                }, 100);

                // Safety timeout
                setTimeout(() => clearInterval(interval), 2000);
            } else {
                window.scrollTo(0, 0);
            }
        };

        router.events.on("routeChangeStart", handleRouteChangeStart);
        router.events.on("routeChangeComplete", handleRouteChangeComplete);

        return () => {
            router.events.off("routeChangeStart", handleRouteChangeStart);
            router.events.off("routeChangeComplete", handleRouteChangeComplete);
        };
    }, [router]);
}
