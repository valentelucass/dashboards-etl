import { useId, useState, type FocusEvent } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';

interface TableHeaderTooltipProps {
  label: string;
  content: string;
  trigger?: 'icon' | 'label';
}

export default function TableHeaderTooltip({ label, content, trigger = 'icon' }: TableHeaderTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const tooltipId = useId();
  const open = isHovered || isFocused || isPinned;

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setIsHovered(false);
          setIsFocused(false);
          setIsPinned(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-label={`Detalhes da coluna ${label}`}
          aria-describedby={open ? tooltipId : undefined}
          aria-expanded={open}
          className={`inline-flex h-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-card)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] ${
            trigger === 'label' ? 'max-w-full cursor-help px-0.5 underline decoration-dotted underline-offset-4' : 'w-6'
          }`}
          style={{ color: 'var(--color-text-muted)' }}
          onBlur={handleBlur}
          onClick={(event) => {
            event.stopPropagation();
            setIsPinned((current) => !current);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              setIsHovered(false);
              setIsFocused(false);
              setIsPinned(false);
            }
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {trigger === 'label' ? label : <Info size={13} aria-hidden="true" />}
        </button>
      </PopoverAnchor>
      <PopoverContent
        id={tooltipId}
        role="tooltip"
        side="top"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="pointer-events-none text-sm leading-relaxed"
        style={{
          width: 'min(20rem, calc(100vw - 1.5rem))',
          color: 'var(--color-text)',
        }}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
