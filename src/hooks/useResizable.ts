import { useCallback, useRef, useState } from "react";

export type ModalSize = { width: number; height: number };

export function useResizable(minWidth = 480, minHeight = 320) {
  const [size, setSize] = useState<ModalSize | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragOrigin.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };

      const onMove = (mv: MouseEvent) => {
        if (!dragOrigin.current) return;
        setSize({
          width: Math.max(minWidth, dragOrigin.current.w + (mv.clientX - dragOrigin.current.x)),
          height: Math.max(minHeight, dragOrigin.current.h + (mv.clientY - dragOrigin.current.y)),
        });
      };

      const onUp = () => {
        dragOrigin.current = null;
        // Suppress the post-drag click that would otherwise fire on the overlay
        window.addEventListener("click", (ev) => ev.stopPropagation(), {
          capture: true,
          once: true,
        });
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [minWidth, minHeight],
  );

  return { ref, size, onResizeMouseDown };
}
