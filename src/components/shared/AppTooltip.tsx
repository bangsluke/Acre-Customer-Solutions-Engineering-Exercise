import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { APP_TOOLTIP_PANEL_CLASSNAME } from './tooltipStyles';

type TooltipSide = 'top' | 'bottom';
type TooltipAlign = 'start' | 'center' | 'end';

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function AppTooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  wrapperClassName,
  panelClassName,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  wrapperClassName?: string;
  panelClassName?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; visibility: 'hidden' | 'visible' }>({
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    if (!content) {
      return;
    }
    if (!isOpen) {
      setPosition((current) => ({ ...current, visibility: 'hidden' }));
      return;
    }

    const wrapperElement = wrapperRef.current;
    const tooltipElement = tooltipRef.current;
    if (!wrapperElement || !tooltipElement) {
      return;
    }

    const viewportPadding = 8;
    const gap = 8;
    const wrapperRect = wrapperElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceAbove = wrapperRect.top - viewportPadding;
    const spaceBelow = viewportHeight - wrapperRect.bottom - viewportPadding;

    let nextSide = side;
    if (side === 'top' && spaceAbove < tooltipHeight && spaceBelow > spaceAbove) {
      nextSide = 'bottom';
    } else if (side === 'bottom' && spaceBelow < tooltipHeight && spaceAbove > spaceBelow) {
      nextSide = 'top';
    }

    let anchorLeft = wrapperRect.left;
    if (align === 'center') {
      anchorLeft = wrapperRect.left + wrapperRect.width / 2 - tooltipWidth / 2;
    } else if (align === 'end') {
      anchorLeft = wrapperRect.right - tooltipWidth;
    }
    const left = Math.min(
      Math.max(anchorLeft, viewportPadding),
      Math.max(viewportPadding, viewportWidth - tooltipWidth - viewportPadding),
    );

    const preferredTop = nextSide === 'top' ? wrapperRect.top - tooltipHeight - gap : wrapperRect.bottom + gap;
    const top = Math.min(
      Math.max(preferredTop, viewportPadding),
      Math.max(viewportPadding, viewportHeight - tooltipHeight - viewportPadding),
    );

    setPosition({ top, left, visibility: 'visible' });
  }, [content, isOpen, side, align, children]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      ref={wrapperRef}
      className={joinClasses('group/app-tooltip relative inline-block max-w-full', wrapperClassName)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      {children}
      {isOpen
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className={joinClasses(APP_TOOLTIP_PANEL_CLASSNAME, panelClassName)}
              style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, visibility: position.visibility }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
