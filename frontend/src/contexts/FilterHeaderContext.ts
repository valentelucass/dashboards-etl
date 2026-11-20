import { createContext } from 'react';

export const FilterHeaderContext = createContext<{
  toolbar: HTMLDivElement | null;
  panel: HTMLDivElement | null;
  updatedAt?: string | null;
} | null>(null);
