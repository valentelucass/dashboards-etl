import { createContext } from 'react';

// Undefined keeps a standalone editor inline. Null means its header panel is closed.
export const HeaderPanelOutletContext = createContext<HTMLDivElement | null | undefined>(undefined);
