import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { EllipsisIcon } from './icons';

export interface MenuItem {
  label: string;
  icon?: JSX.Element;
  onSelect: () => void;
  /** Renders in red — used for removal actions. */
  destructive?: boolean;
}

/**
 * Small context menu triggered by an ellipsis button.
 *
 * Hand-rolled rather than pulling in a popover library: the app needs one menu
 * shape. Closes on outside pointerdown, on Escape, and after a selection.
 *
 * `pointerdown` (not `click`) is used for outside dismissal so the menu closes
 * before a click lands on whatever is underneath, which otherwise triggers two
 * actions from one gesture.
 */
export function Menu({
  items,
  label = 'More options',
  align = 'right',
  className,
}: {
  items: MenuItem[];
  label?: string;
  align?: 'left' | 'right';
  className?: string;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={(event) => {
          // Stop the parent row from treating this as "play this track".
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="focus-ring rounded-full p-1.5 text-muted transition-colors hover:text-white"
      >
        <EllipsisIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[190px] overflow-hidden rounded-md border border-white/10 bg-[#282828] py-1 shadow-2xl shadow-black/70',
            // Flip alignment so a menu on a right-hand row does not overflow.
            align === 'right' ? 'right-0' : 'left-0',
            'bottom-auto',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/10',
                item.destructive ? 'text-red-400' : 'text-white',
              )}
            >
              {item.icon && <span className="shrink-0 text-muted">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
