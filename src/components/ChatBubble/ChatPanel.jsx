import React, { useState, useRef, useEffect } from 'react';
import { X, PaperPlaneRight, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useQuote } from '../../context/QuoteContext.jsx';
import styles from './ChatBubble.module.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
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

    // Process inline formatting: **bold**, *italic*, `code`, [link](/route)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((\/[^\)]*)\))/g;
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
      } else if (match[5] && match[6]) {
        // Internal route link [label](/route)
        parts.push(
          <a key={i++} href={match[6]} className={styles.navLink} onClick={(e) => {
            e.preventDefault();
            window.__chatNavigate?.(match[6]);
          }}>{match[5]}</a>
        );
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

// ── Suggested starter questions ─────────────────────────────
const SUGGESTED_QUESTIONS = [
  'What firebox is best for a 50-person office?',
  'Compare the T45 vs T85',
  'What endpoint security options are available?',
  'Show me Wi-Fi access point pricing',
];

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

export default function ChatPanel({ onClose, onOpenCart }) {
  const { addItem, removeItemBySku, state: quoteState } = useQuote();
  const navigate = useNavigate();

  // Expose navigate for markdown link clicks
  useEffect(() => {
    window.__chatNavigate = navigate;
    return () => { delete window.__chatNavigate; };
  }, [navigate]);
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

  async function handleSend(overrideText) {
    const text = (overrideText || input).trim();
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
      // Send current cart contents so the AI knows what's in the cart
      const cartItems = quoteState.items.map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, cartItems }),
      });

      if (!res.ok) {
        let errMsg = 'Something went wrong. Please try again.';
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch { /* not JSON */ }
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
        setIsStreaming(false);
        return;
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
            } else if (event.type === 'cart_action' && event.action === 'add') {
              addItem(event.item);
              setTimeout(() => onOpenCart?.(), 600);
            } else if (event.type === 'cart_action' && event.action === 'remove') {
              removeItemBySku(event.sku);
            } else if (event.type === 'cart_action' && event.action === 'replace') {
              removeItemBySku(event.old_sku);
              addItem(event.item);
              setTimeout(() => onOpenCart?.(), 600);
            } else if (event.type === 'cart_action' && event.action === 'show') {
              setTimeout(() => onOpenCart?.(), 300);
            } else if (event.type === 'navigate') {
              navigate(event.route);
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
      const errMsg = err.message?.includes('Failed to fetch')
        ? "Can't reach the server — it may be offline. Please check your connection and try again."
        : "Sorry, something went wrong. Please try again.";
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errMsg,
      }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleClear() {
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    saveHistory([WELCOME_MESSAGE]);
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
        <div className={styles.headerIcon}>
          <div className={styles.headerIconSphere} />
          <img src={`${basePath}lion_icon.svg`} alt="" className={styles.headerIconLion} />
        </div>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>LionBot</span>
          <span className={styles.headerSubtitle}>WatchGuard AI Assistant</span>
        </div>
        <button
          className={styles.closeBtn}
          onClick={handleClear}
          disabled={isStreaming || messages.length <= 1}
          aria-label="New chat"
          title="New chat"
        >
          <ArrowCounterClockwise size={16} weight="bold" />
        </button>
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

        {/* Suggested questions — show only when just the welcome message exists */}
        {messages.length === 1 && messages[0] === WELCOME_MESSAGE && !isStreaming && (
          <div className={styles.suggestions}>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} className={styles.suggestionChip} onClick={() => handleSend(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

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
          onClick={() => handleSend()}
          disabled={isStreaming || !input.trim()}
          aria-label="Send message"
        >
          <PaperPlaneRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
