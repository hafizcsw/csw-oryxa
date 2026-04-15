import { useState, useEffect, useCallback, useMemo } from 'react';

export type ChatSizeMode = 'compact' | 'standard' | 'wide' | 'full';

interface SizeConfig {
  width: number | string;
  height: number | string;
  minWidth: number;
  maxWidth: number | string;
}

const SIZE_CONFIGS: Record<ChatSizeMode, SizeConfig> = {
  compact: { width: 360, height: 480, minWidth: 320, maxWidth: 400 },
  standard: { width: 420, height: 540, minWidth: 380, maxWidth: 480 },
  wide: { width: 600, height: 620, minWidth: 500, maxWidth: 700 },
  full: { width: '100vw', height: '100vh', minWidth: 0, maxWidth: '100vw' },
};

const STORAGE_KEY = 'oryxa_chat_size';

export function useChatSize() {
  const [sizeMode, setSizeMode] = useState<ChatSizeMode>(() => {
    if (typeof window === 'undefined') return 'standard';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['compact', 'standard', 'wide', 'full'].includes(saved)) {
      return saved as ChatSizeMode;
    }
    return 'standard';
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, sizeMode);
  }, [sizeMode]);

  const config = useMemo(() => SIZE_CONFIGS[sizeMode], [sizeMode]);

  const cycleSize = useCallback(() => {
    setSizeMode(current => {
      const modes: ChatSizeMode[] = ['compact', 'standard', 'wide', 'full'];
      const currentIndex = modes.indexOf(current);
      return modes[(currentIndex + 1) % modes.length];
    });
  }, []);

  const setSize = useCallback((mode: ChatSizeMode) => {
    setSizeMode(mode);
  }, []);

  const isFullscreen = sizeMode === 'full';

  const getSizeStyle = useCallback(() => {
    if (sizeMode === 'full') {
      return {
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        borderRadius: 0,
      };
    }
    return {
      width: config.width,
      height: config.height,
      maxWidth: config.maxWidth,
    };
  }, [sizeMode, config]);

  return {
    sizeMode,
    config,
    cycleSize,
    setSize,
    isFullscreen,
    getSizeStyle,
    SIZE_CONFIGS,
  };
}
