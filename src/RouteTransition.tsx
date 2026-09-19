import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Routes,
  useLocation,
  useNavigationType,
  type Location,
} from "react-router-dom";

type Direction = "forward" | "backward";
type Phase = "idle" | "exit" | "enter";

const EXIT_MS = 90;
const ENTER_MS = 180;

function historyIndex() {
  const value = window.history.state?.idx;
  return typeof value === "number" ? value : null;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export const pathnameTransitionKey = (location: Location) => location.pathname;

export const shellTransitionKey = (location: Location) => {
  const publicRoute = [
    "/",
    "/login",
    "/verify",
    "/forgot-password",
    "/reset-password",
  ].includes(location.pathname);
  return publicRoute ? location.pathname : "workspace-shell";
};

export function RouteTransition({
  children,
  className = "",
  routeKey = pathnameTransitionKey,
}: {
  children: ReactNode;
  className?: string;
  routeKey?: (location: Location) => string;
}) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const reducedMotion = useReducedMotion();
  const [displayLocation, setDisplayLocation] = useState(location);
  const displayLocationRef = useRef(displayLocation);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<Direction>("forward");
  const previousIndex = useRef(historyIndex());

  useEffect(() => {
    if (location.key === displayLocationRef.current.key) return;

    const nextIndex = historyIndex();
    const nextDirection: Direction =
      navigationType === "POP" &&
      nextIndex !== null &&
      previousIndex.current !== null &&
      nextIndex < previousIndex.current
        ? "backward"
        : "forward";
    previousIndex.current = nextIndex;

    if (
      reducedMotion ||
      routeKey(location) === routeKey(displayLocationRef.current)
    ) {
      setDirection(nextDirection);
      displayLocationRef.current = location;
      setDisplayLocation(location);
      setPhase("idle");
      return;
    }

    let enterTimer: number | undefined;
    setDirection(nextDirection);
    setPhase("exit");
    const swapTimer = window.setTimeout(() => {
      displayLocationRef.current = location;
      setDisplayLocation(location);
      setPhase("enter");
      enterTimer = window.setTimeout(() => setPhase("idle"), ENTER_MS);
    }, EXIT_MS);

    return () => {
      window.clearTimeout(swapTimer);
      if (enterTimer) window.clearTimeout(enterTimer);
    };
  }, [location, navigationType, reducedMotion, routeKey]);

  return (
    <div
      className={`route-transition ${className}`.trim()}
      data-direction={direction}
      data-phase={phase}
    >
      <Routes location={displayLocation}>{children}</Routes>
    </div>
  );
}
