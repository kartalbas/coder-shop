"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion, useAnimationControls } from "motion/react";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const controls = useAnimationControls();

  useEffect(() => {
    controls.set({ opacity: 0, y: 8 });
    controls.start({ opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } });
  }, [pathname, controls]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div animate={controls} className="flex flex-1 flex-col">
        {children}
      </motion.div>
    </MotionConfig>
  );
}
