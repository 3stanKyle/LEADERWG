import React, { useState, useEffect, useCallback } from 'react';
import styles from './ChatBubble.module.css';
import ChatPanel from './ChatPanel.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const basePath = import.meta.env.BASE_URL || '/';

export default function ChatBubble({ onOpenCart }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatAvailable, setChatAvailable] = useState(false);

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

  function handleOpen() {
    setIsOpen(true);
  }

  if (!chatAvailable) return null;

  if (isOpen) {
    return <ChatPanel onClose={() => setIsOpen(false)} onOpenCart={onOpenCart} />;
  }

  return (
    <div style={{ position: 'fixed', bottom: 40, right: 40, zIndex: 9999 }}>
      <div className={styles.tooltip}>Ask me anything about WatchGuard</div>
      <button className={styles.orbButton} onClick={handleOpen} aria-label="Open chat assistant">
        <div className={styles.orbSphere} />
        <img src={`${basePath}lion_icon.svg`} alt="" className={styles.orbLion} />
      </button>
    </div>
  );
}
