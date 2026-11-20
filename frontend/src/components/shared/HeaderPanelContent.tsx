import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeaderPanelOutletContext } from '../../contexts/HeaderPanelOutletContext';

export default function HeaderPanelContent({ children }: { children: ReactNode }) {
  const outlet = useContext(HeaderPanelOutletContext);
  if (outlet === undefined) return children;
  return outlet && createPortal(children, outlet);
}
