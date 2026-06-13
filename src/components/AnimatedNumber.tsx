import { animate } from "framer-motion";
import { useEffect, useState } from "react";

/** Tween a number when it changes - used by the serving scaler (D34). */
export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.4,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <>
      {Math.round(display)}
      {suffix}
    </>
  );
}
