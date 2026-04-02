import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import styles from './App.module.css';
import TopLevelNav from './components/TopLevelNav/TopLevelNav.jsx';
import ProductCatalog from './components/ProductCatalog/ProductCatalog.jsx';
import VirtualCatalog from './components/VirtualCatalog/VirtualCatalog.jsx';
import CloudCatalog from './components/CloudCatalog/CloudCatalog.jsx';
import MdrNdrCatalog from './components/MdrNdrCatalog/MdrNdrCatalog.jsx';
import EndpointCatalog from './components/EndpointCatalog/EndpointCatalog.jsx';
import IdentityCatalog from './components/IdentityCatalog/IdentityCatalog.jsx';
import EmailCatalog from './components/EmailCatalog/EmailCatalog.jsx';
import RenewalsCatalog from './components/RenewalsCatalog/RenewalsCatalog.jsx';
import QuoteCartPanel from './components/QuoteCartPanel/QuoteCartPanel.jsx';
import ChatBubble from './components/ChatBubble/ChatBubble.jsx';

const SKIN_URL = 'https://watchguard.swoogo.com/impact-2026-apac/10814749';

function ComingSoon({ title }) {
  return (
    <div style={{ padding: 80, textAlign: 'center', color: '#888' }}>
      <h2 style={{ marginBottom: 12, color: '#333' }}>{title}</h2>
      <p>Coming soon.</p>
    </div>
  );
}

function App() {
  // Quote Cart modal
  const [isCartOpen, setIsCartOpen] = useState(false);
  // Sticky banner dismiss
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  const basePath = import.meta.env.BASE_URL || '/';

  return (
    <div className={styles.page}>
      {/* Website Skin — clickable background */}
      <a
        href={SKIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.skinLink}
        style={{ backgroundImage: `url(${basePath}banners/impact_skin.jpg)` }}
        aria-label="WatchGuard IMPACT 2026 — Register Now"
      />

      <div className={styles.pageContent}>
        <TopLevelNav onCartClick={() => setIsCartOpen(true)} />

        <div className={styles.container}>
          <Routes>
            <Route path="/" element={<ProductCatalog />} />
            <Route path="/virtual" element={<VirtualCatalog />} />
            <Route path="/renewals" element={<RenewalsCatalog />} />
            <Route path="/mdr-ndr" element={<MdrNdrCatalog />} />
            <Route path="/endpoint" element={<EndpointCatalog />} />
            <Route path="/cloud" element={<CloudCatalog />} />
            <Route path="/identity" element={<IdentityCatalog />} />
            <Route path="/email" element={<EmailCatalog />} />
          </Routes>
        </div>
      </div>

      {/* Quote Cart modal overlay */}
      <QuoteCartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* AI Chat Assistant */}
      <ChatBubble />

      {/* Sticky bottom banner — IMPACT 2026 promo */}
      {isBannerVisible && (
        <div className={styles.stickyBanner}>
          <a
            href={SKIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.stickyBannerLink}
          >
            Introducing <strong>IMPACT</strong> — The WatchGuard Partner Conference&nbsp;&nbsp;|&nbsp;&nbsp;Bali, 27–29 May 2026&nbsp;&nbsp;|&nbsp;&nbsp;<span className={styles.stickyBannerCta}>Register Now →</span>
          </a>
          <button
            type="button"
            className={styles.stickyBannerClose}
            onClick={(e) => { e.stopPropagation(); setIsBannerVisible(false); }}
            aria-label="Dismiss banner"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
