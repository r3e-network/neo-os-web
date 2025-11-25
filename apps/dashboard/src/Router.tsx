import { useEffect, useState } from "react";

export type Route = "user" | "admin" | "settings";

export function useRouter(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "admin") return "admin";
    if (hash === "settings") return "settings";
    return "user";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "admin") setRoute("admin");
      else if (hash === "settings") setRoute("settings");
      else setRoute("user");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (newRoute: Route) => {
    window.location.hash = newRoute === "user" ? "" : newRoute;
    setRoute(newRoute);
  };

  return [route, navigate];
}
