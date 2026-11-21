import { useState } from 'react';
import { BottomSheet, type BottomSheetHeight } from '@astryxdesign/core/BottomSheet';
import { Dialog, type DialogProps } from '@astryxdesign/core/Dialog';
import { DEFAULT_COMPACT_DEFINITION } from '@astryxdesign/core/theme';
import { useMediaQuery } from '@astryxdesign/core/hooks';

type DashboardAdaptiveDialogProps = Pick<DialogProps,
  'isOpen' | 'onOpenChange' | 'width' | 'maxHeight' | 'padding' | 'purpose' |
  'aria-labelledby' | 'className' | 'children'> & {
    label: string;
    sheetHeight?: BottomSheetHeight;
  };

export default function DashboardAdaptiveDialog({
  label, sheetHeight = 'tall', width, maxHeight, isOpen, ...props
}: DashboardAdaptiveDialogProps) {
  const compact = useMediaQuery(DEFAULT_COMPACT_DEFINITION.coarsePointerQuery);
  // Keep the active surface mounted while rotating or editing with the keyboard.
  const [session, setSession] = useState({ open: isOpen, sheet: compact });
  if (session.open !== isOpen) {
    setSession({ open: isOpen, sheet: isOpen ? compact : session.sheet });
  }

  return session.sheet
    ? <BottomSheet label={label} isOpen={isOpen} height={sheetHeight} {...props} />
    : <Dialog aria-label={label} isOpen={isOpen} width={width} maxHeight={maxHeight} {...props}
        className={['dashboard-centered-dialog', props.className].filter(Boolean).join(' ')} />;
}
