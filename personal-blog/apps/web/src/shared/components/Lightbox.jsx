import { useEffect } from "react";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import { useBodyScrollLock } from "../../app/hooks.js";

export function Lightbox({ images, index, onClose, onIndexChange }) {
  const open = index >= 0 && index < images.length;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;

    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") onIndexChange((index + 1) % images.length);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open) return null;

  const image = images[index];

  return (
    <div className="lightbox-layer" role="dialog" aria-modal="true" aria-label="图片浏览">
      <button aria-label="关闭" className="lightbox-scrim" onClick={onClose} type="button" />
      <div className="lightbox-stage">
        <figure onClick={(event) => event.stopPropagation()}>
          <img alt={image.alt} src={image.src} />
          {image.alt && <figcaption>{image.alt}</figcaption>}
        </figure>
        <span className="lightbox-counter">
          {index + 1} / {images.length}
        </span>
        <button aria-label="上一张" className="lightbox-nav lightbox-prev" onClick={() => onIndexChange((index - 1 + images.length) % images.length)} type="button">
          <CaretLeft size={22} />
        </button>
        <button aria-label="下一张" className="lightbox-nav lightbox-next" onClick={() => onIndexChange((index + 1) % images.length)} type="button">
          <CaretRight size={22} />
        </button>
        <button aria-label="关闭" className="lightbox-close" onClick={onClose} type="button">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
