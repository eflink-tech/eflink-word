import { useEffect } from 'react';

export function useHotkeys(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keys = key.split(',');
      for (const k of keys) {
        const [modifier, keyName] = k.includes('+') ? k.split('+') : ['', k];
        const isCtrl = modifier.toLowerCase() === 'ctrl' && e.ctrlKey;
        const isCmd = modifier.toLowerCase() === 'cmd' && e.metaKey;
        const isKey = e.key.toLowerCase() === keyName.toLowerCase();

        if ((isCtrl || isCmd) && isKey) {
          e.preventDefault();
          callback();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback]);
}
