import { useTheme } from 'next-themes';

export function useEchartsTheme() {
  const { resolvedTheme, theme } = useTheme();
  return { isDark: (resolvedTheme ?? theme) === 'dark' };
}
