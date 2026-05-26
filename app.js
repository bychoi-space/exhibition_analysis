// ==========================================================================
// CLAY MOCK PLATFORM - MAIN COORDINATOR ENTRY POINT
// ==========================================================================

import React, { useState } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
import { Columns, ShoppingBag, BarChart3, HelpCircle } from 'https://esm.sh/lucide-react@0.263.0';
import Storefront from './store.js';
import AnalyticsDashboard from './dashboard.js';

function App() {
  // Navigation states: 'SPLIT' (both side by side), 'STORE' (storefront only), 'DASHBOARD' (dashboard only)
  const [viewMode, setViewMode] = useState('SPLIT');
  
  // Shared storefront states so cart counts sync and persist correctly
  const [cart, setCart] = useState([]);
  const [currentStoreView, setCurrentStoreView] = useState('HOME');
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <div className="app-container">
      
      {/* 1. Master Control Bar */}
      <div className="prototype-controller">
        <div className="prototype-title-group">
          <div className="logo-badge">
            <span>Clay.</span>
          </div>
          <span className="logo-text">Growth Telemetry Engine</span>
        </div>

        {/* Layout Swaps */}
        <div className="layout-switches">
          <button 
            className={`layout-switch-btn ${viewMode === 'SPLIT' ? 'active' : ''}`}
            onClick={() => setViewMode('SPLIT')}
            title="Show both Shopping Store and Analytics Live side-by-side"
          >
            <Columns size={14} /> Split View
          </button>
          
          <button 
            className={`layout-switch-btn ${viewMode === 'STORE' ? 'active' : ''}`}
            onClick={() => setViewMode('STORE')}
            title="Show Mock Storefront full width"
          >
            <ShoppingBag size={14} /> E-Commerce Shop
          </button>
          
          <button 
            className={`layout-switch-btn ${viewMode === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setViewMode('DASHBOARD')}
            title="Show Analytics Dashboard full width"
          >
            <BarChart3 size={14} /> Dashboard
          </button>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--colors-muted)', fontSize: '13px', fontWeight: 500}}>
          <HelpCircle size={15} /> Zero-Dependency ESM App
        </div>
      </div>

      {/* 2. Workspace Viewport Grid */}
      <main className={`workspace-frame ${viewMode === 'SPLIT' ? 'split' : ''}`}>
        
        {/* Left Side: Mock Shop */}
        {(viewMode === 'SPLIT' || viewMode === 'STORE') && (
          <div className="pane store-pane-container">
            <Storefront 
              cart={cart}
              setCart={setCart}
              currentView={currentStoreView}
              setCurrentView={setCurrentStoreView}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
            />
          </div>
        )}

        {/* Right Side: Analytics Dashboard */}
        {(viewMode === 'SPLIT' || viewMode === 'DASHBOARD') && (
          <div className="pane dashboard-pane-container" style={{borderLeft: viewMode === 'SPLIT' ? '1px solid var(--colors-hairline)' : 'none'}}>
            <AnalyticsDashboard />
          </div>
        )}

      </main>

    </div>
  );
}

// React Mounting Execution
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
