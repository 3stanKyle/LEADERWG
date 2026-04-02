import React, { useState, useRef, useEffect } from 'react';
import { X, PaperPlaneRight } from '@phosphor-icons/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import styles from './ChatBubble.module.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const LOTTIE_SRC = 'https://lottie.host/e4798cd5-40da-40e7-9f18-7e62bda08ddb/RpxyXDRRVc.lottie';
const basePath = import.meta.env.BASE_URL || '/';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I can help you find the right WatchGuard product, look up pricing, compare models, or answer technical questions. What are you looking for?",
};

// Lightweight markdown: bold, italic, bullets, numbered lists, inline code
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null; // 'ul' or 'ol'
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(<Tag key={key++}>{listItems}</Tag>);
      listItems = [];
      listType = null;
    }
  }

  function inlineFormat(str) {
    const parts = [];
    let remaining = str;
    let i = 0;

    // Process inline formatting: **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={i++}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={i++}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(<code key={i++}>{match[4]}</code>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [str];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(<li key={key++}>{inlineFormat(trimmed.replace(/^[-*]\s+/, ''))}</li>);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(<li key={key++}>{inlineFormat(trimmed.replace(/^\d+\.\s+/, ''))}</li>);
      continue;
    }

    flushList();

    if (trimmed === '') {
      continue;
    }

    elements.push(<p key={key++} style={{ margin: '4px 0' }}>{inlineFormat(trimmed)}</p>);
  }

  flushList();
  return elements;
}

// Load/save conversation from sessionStorage
const STORAGE_KEY = 'wg-chat-history';

function loadHistory() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [WELCOME_MESSAGE];
}

function saveHistory(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* ignore */ }
}

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Prepare API messages (exclude welcome message from context if it's the default)
    const apiMessages = updatedMessages
      .filter(m => m !== WELCOME_MESSAGE)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text_delta') {
              assistantText += event.text;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last._streaming) {
                  return [...prev.slice(0, -1), { role: 'assistant', content: assistantText, _streaming: true }];
                }
                return [...prev, { role: 'assistant', content: assistantText, _streaming: true }];
              });
            } else if (event.type === 'error') {
              assistantText = event.error;
              setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // Finalize the streaming message
      if (assistantText) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last._streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }];
          }
          return prev;
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't connect to the server. Please try again.",
      }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLionMask}>
          <DotLottieReact
            src={LOTTIE_SRC}
            loop
            autoplay
            style={{ width: 56, height: 56 }}
          />
        </div>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>LionBot</span>
          <span className={styles.headerSubtitle}>WatchGuard AI Assistant</span>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close chat">
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? styles.msgUser : styles.msgBot}>
            {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
          </div>
        ))}
        {isStreaming && !messages[messages.length - 1]?._streaming && (
          <div className={styles.typing}>
            <div className={styles.typingDot} />
            <div className={styles.typingDot} />
            <div className={styles.typingDot} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Ask about WatchGuard products..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          aria-label="Send message"
        >
          <PaperPlaneRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
