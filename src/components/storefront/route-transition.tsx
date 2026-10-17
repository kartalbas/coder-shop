"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion, useAnimationControls } from "motion/react";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const controls = useAnimationControls();

  // Issue #59: the transition must never move the page — the old `y: 8` offset made
  // every navigation visibly shift the whole layout. A calm opacity fade only.
  useEffect(() => {
    controls.set({ opacity: 0 });
    controls.start({ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } });
  }, [pathname, controls]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div animate={controls} data-route-transition className="flex flex-1 flex-col">
        {children}
      </motion.div>
    </MotionConfig>
  );
}
