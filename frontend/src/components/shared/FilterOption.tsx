import { CheckboxListItem } from '@astryxdesign/core/CheckboxList';
import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { useRef, useState } from 'react';

interface FilterOptionProps {
  value: string;
  label: string;
  description?: string | null;
}

export default function FilterOption({ value, label, description }: FilterOptionProps) {
  const row = useRef<HTMLLIElement>(null);
  const name = useRef<HTMLElement>(null);
  const detail = useRef<HTMLElement>(null);
  const [showFullText, setShowFullText] = useState(false);

  function revealClippedText() {
    setShowFullText([name.current, detail.current].some(el => el && el.scrollWidth > el.clientWidth));
  }

  return (
    <>
      <CheckboxListItem
        ref={row} value={value}
        label={<Text ref={name} maxLines={1} hasTruncateTooltip={false} color="inherit">{label}</Text>}
        description={description && <Text ref={detail} type="supporting" maxLines={1} hasTruncateTooltip={false}>{description}</Text>}
        onPointerEnter={event => { if (event.pointerType !== 'touch') revealClippedText(); }}
        onPointerUp={event => { if (event.pointerType === 'touch') revealClippedText(); }}
        onPointerLeave={event => {
          if (event.pointerType !== 'touch' && !row.current?.querySelector(':focus-visible')) setShowFullText(false);
        }}
        onFocus={event => { if (event.target.matches(':focus-visible')) revealClippedText(); }}
        onBlur={() => setShowFullText(false)}
      />
      {showFullText && (
        <Tooltip anchorRef={row} isOpen onOpenChange={setShowFullText}
          content={<span style={{ overflowWrap: 'anywhere' }}>{label}{description && <><br />{description}</>}</span>} />
      )}
    </>
  );
}
