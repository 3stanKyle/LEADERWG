import React, { useState, useEffect, useCallback } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import styles from './ChatBubble.module.css';
import ChatPanel from './ChatPanel.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOOLTIP_KEY = 'wg-chat-tooltip-dismissed';
const LOTTIE_SRC = 'https://lottie.host/e4798cd5-40da-40e7-9f18-7e62bda08ddb/RpxyXDRRVc.lottie';

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatAvailable, setChatAvailable] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if chat backend is available
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChatAvailable(data.chat === true);
    } catch {
      setChatAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Recheck on window focus (handles server restart)
    function onFocus() { checkHealth(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkHealth]);

  // Show tooltip for first-time visitors
  useEffect(() => {
    if (!chatAvailable || isOpen) return;
    const dismissed = localStorage.getItem(TOOLTIP_KEY);
    if (!dismissed) {
      setShowTooltip(true);
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem(TOOLTIP_KEY, '1');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [chatAvailable, isOpen]);

  function handleOpen() {
    setIsOpen(true);
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, '1');
  }

  if (!chatAvailable) return null;

  if (isOpen) {
    return <ChatPanel onClose={() => setIsOpen(false)} />;
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {showTooltip && (
        <div className={styles.tooltip}>Ask me anything about WatchGuard</div>
      )}
      <button className={styles.lottieButton} onClick={handleOpen} aria-label="Open chat assistant">
        <DotLottieReact
          src={LOTTIE_SRC}
          loop
          autoplay
          style={{ width: 72, height: 72 }}
        />
      </button>
    </div>
  );
}
