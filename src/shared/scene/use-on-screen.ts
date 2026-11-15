"use client";

import { useEffect, useState, type RefObject } from "react";

/** True while the element is in or near the viewport, so off-screen scenes can stop rendering. */
export function useOnScreen(ref: RefObject<Element | null>, rootMargin = "120px"): boolean {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return onScreen;
}
