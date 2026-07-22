import { ArrowUp } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setIsVisible(window.scrollY > 480);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function scrollToTop() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ behavior: reducedMotion ? "auto" : "smooth", top: 0 });
  }

  if (!isVisible) return null;

  return (
    <button aria-label="回到顶部" className="back-to-top" onClick={scrollToTop} type="button">
      <ArrowUp size={20} weight="bold" />
    </button>
  );
}
