import { useEffect, useState } from "react";

export function ReadingProgress() {
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setRatio(total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="reading-progress"
      style={{ transform: `scaleX(${ratio})` }}
    />
  );
}
