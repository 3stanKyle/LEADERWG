import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
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

  return (
    <div className={styles.page}>
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

      {/* Quote Cart modal overlay */}
      <QuoteCartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}

export default App;
