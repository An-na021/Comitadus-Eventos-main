import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const label = dark ? 'Ativar modo claro' : 'Ativar modo noturno';

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('comitadus-theme', next ? 'dark' : 'light');
    } catch {
      // The switch still works when the browser blocks preference storage.
    }
    setDark(next);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? 'Modo claro' : 'Modo noturno'}</span>
    </button>
  );
}
