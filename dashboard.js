// ==========================================================================
// CLAY GOOGLE-ANALYTICS STYLE VISUALIZATION DASHBOARD
// ==========================================================================

import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { 
  BarChart3, 
  Clock, 
  Users, 
  Eye, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Zap, 
  Play, 
  Pause, 
  Trash2,
  HelpCircle
} from 'https://esm.sh/lucide-react@0.263.0';
import { 
  getSummaryStats, 
  getFunnelData, 
  getPagePerformance, 
  getRealtimeLogs, 
  simulateUserTraffic, 
  resetDatabase 
} from './tracker.js';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState(getSummaryStats());
  const [funnel, setFunnel] = useState(getFunnelData());
  const [pages, setPages] = useState(getPagePerformance());
  const [logs, setLogs] = useState(getRealtimeLogs());
  const [isSimulating, setIsSimulating] = useState(false);
  const [simTrafficCount, setSimTrafficCount] = useState(0);

  // Sync dashboard state with database updates
  const refreshDashboard = () => {
    setStats(getSummaryStats());
    setFunnel(getFunnelData());
    setPages(getPagePerformance());
    setLogs(getRealtimeLogs());
  };

  useEffect(() => {
    // Listen for custom events dispatched by the tracker when logs write
    window.addEventListener('clay_analytics_update', refreshDashboard);
    return () => {
      window.removeEventListener('clay_analytics_update', refreshDashboard);
    };
  }, []);

  // Background Simulator Timer
  useEffect(() => {
    let intervalId = null;
    if (isSimulating) {
      intervalId = setInterval(() => {
        simulateUserTraffic();
        setSimTrafficCount(c => c + 1);
      }, 1500); // Generate 1 user action every 1.5 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSimulating]);

  const handleClear = () => {
    if (confirm('Are you sure you want to reset all analytical database logs? This will re-seed original values.')) {
      resetDatabase();
      setIsSimulating(false);
      setSimTrafficCount(0);
    }
  };

  const handleSimSingle = () => {
    simulateUserTraffic();
    setSimTrafficCount(c => c + 1);
  };

  // Helper to format timestamps nicely
  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toTimeString().split(' ')[0]; // Returns hh:mm:ss
  };

  // Helper for page type badges
  const getPageTypeClass = (type) => {
    return `page-type-pill ${type.toLowerCase()}`;
  };

  return (
    <div className="dashboard-pane">
      
      {/* 1. Dashboard Header */}
      <div className="dashboard-header-group">
        <div>
          <span className="caption-uppercase" style={{color: 'var(--colors-muted)', display: 'flex', alignItems: 'center', gap: '6px'}}>
            <BarChart3 size={14} /> CLAYGENT WEB METRICS
          </span>
          <h2 className="display-sm" style={{marginTop: '4px', fontWeight: 500}}>Page Performance Analyzer</h2>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          {isSimulating && (
            <div className="realtime-indicator-pulse">
              <span className="pulse-dot"></span>
              <span>LIVE TRAFFIC SIMULATING ({simTrafficCount})</span>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={refreshDashboard}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. Top Scorecards (Clay styled cards with colorful tops) */}
      <div className="dashboard-stats-grid">
        <div className="stat-card colored-pink">
          <div className="stat-header">
            <span className="caption-uppercase">Page Views</span>
            <Eye size={16} color="var(--colors-brand-pink)" />
          </div>
          <span className="stat-value">{stats.totalPV}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Total hits recorded</span>
        </div>

        <div className="stat-card colored-teal">
          <div className="stat-header">
            <span className="caption-uppercase">Unique Visitors</span>
            <Users size={16} color="var(--colors-brand-teal)" />
          </div>
          <span className="stat-value">{stats.uniqueUV}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Unique session UUIDs</span>
        </div>

        <div className="stat-card colored-lavender">
          <div className="stat-header">
            <span className="caption-uppercase">Avg. Time on Page</span>
            <Clock size={16} color="var(--colors-brand-lavender)" />
          </div>
          <span className="stat-value">{stats.avgDuration}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Continuous session heartbeats</span>
        </div>

        <div className="stat-card colored-peach">
          <div className="stat-header">
            <span className="caption-uppercase">Bounce Rate</span>
            <TrendingUp size={16} color="var(--colors-brand-peach)" />
          </div>
          <span className="stat-value">{stats.bounceRate}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Single-action sessions</span>
        </div>

        <div className="stat-card colored-ochre">
          <div className="stat-header">
            <span className="caption-uppercase">Simulated Revenue</span>
            <Sparkles size={16} color="var(--colors-brand-ochre)" />
          </div>
          <span className="stat-value">{stats.revenue}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Purchase conversions sum</span>
        </div>
      </div>

      {/* 3. Charts & Conversions Visualizer Grid */}
      <div className="dashboard-charts-grid">
        
        {/* A. CUSTOM SVG CONVERSION FUNNEL */}
        <div className="chart-card">
          <div>
            <h3 className="title-md">E-Commerce Funnel Conversion</h3>
            <p className="body-sm" style={{color: 'var(--colors-muted)'}}>Session dropoffs across the shopping funnel journey.</p>
          </div>

          <div className="svg-funnel-container">
            <svg viewBox="0 0 500 220" width="100%" height="100%">
              {funnel.map((step, idx) => {
                // Calculate properties for the funnel bars
                // The bars get progressively shorter
                const maxBarWidth = 320;
                const barWidth = Math.max((step.rate / 100) * maxBarWidth, 20);
                const barHeight = 24;
                const xStart = 140; // Offset for labels
                const yStart = idx * 42 + 10;
                
                // Color palette mappings based on index
                const barColor = step.color;
                
                return (
                  <g key={step.name}>
                    {/* Step Label (Left side) */}
                    <text 
                      x="10" 
                      y={yStart + 16} 
                      fill="var(--colors-ink)" 
                      fontSize="12" 
                      fontWeight="600"
                    >
                      {step.name.split(' ').slice(1).join(' ')}
                    </text>
                    
                    {/* Background Bar */}
                    <rect 
                      x={xStart} 
                      y={yStart} 
                      width={maxBarWidth} 
                      height={barHeight} 
                      fill="var(--colors-surface-soft)" 
                      rx="6"
                    />
                    
                    {/* Filled Funnel Bar with brand colors */}
                    <rect 
                      x={xStart} 
                      y={yStart} 
                      width={barWidth} 
                      height={barHeight} 
                      fill={barColor} 
                      rx="6"
                      style={{ transition: 'width 0.5s ease-out' }}
                    />
                    
                    {/* Rate text (Inside / Outside bar) */}
                    <text 
                      x={xStart + Math.max(barWidth - 40, 10)} 
                      y={yStart + 16} 
                      fill={idx === 1 || idx === 4 ? '#ffffff' : 'var(--colors-ink)'} 
                      fontSize="11" 
                      fontWeight="700"
                    >
                      {step.rate}%
                    </text>
                    
                    {/* Raw volume count (Right side) */}
                    <text 
                      x={xStart + maxBarWidth + 10} 
                      y={yStart + 16} 
                      fill="var(--colors-muted)" 
                      fontSize="12" 
                      fontWeight="500"
                    >
                      {step.count.toLocaleString()}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* B. REAL-TIME ACTIVITY LOGGER */}
        <div className="chart-card">
          <div className="flex-row-between">
            <div>
              <h3 className="title-md" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Zap size={16} color="var(--colors-brand-pink)" /> Real-Time Traffic Stream
              </h3>
              <p className="body-sm" style={{color: 'var(--colors-muted)'}}>Live actions captured from your active sessions.</p>
            </div>
            <span className="caption-uppercase" style={{backgroundColor: '#e6f4ea', color: 'var(--colors-brand-mint)', padding: '2px 8px', borderRadius: '4px'}}>
              Active Streaming
            </span>
          </div>

          <div className="realtime-log-panel">
            {logs.slice(0, 12).map((log, index) => (
              <div key={index} className="log-entry-row">
                <span className="log-time">{formatTime(log.timestamp)}</span>
                
                <span className="log-desc">
                  {log.type === 'PAGE_VIEW' && (
                    <span>Visited <code style={{backgroundColor: 'var(--colors-surface-strong)', padding: '2px 4px', borderRadius: '4px'}}>{log.url}</code></span>
                  )}
                  {log.type === 'CLICK' && (
                    <span>Clicked <strong style={{color: 'var(--colors-primary)'}}>{log.elementId}</strong></span>
                  )}
                  {log.type === 'ADD_TO_CART' && (
                    <span>Added product <strong style={{color: 'var(--colors-brand-pink)'}}>{log.extra?.productId}</strong> to cart (${log.extra?.price})</span>
                  )}
                  {log.type === 'PURCHASE' && (
                    <span style={{color: '#0d5a4e', fontWeight: 600}}>Completed order {log.extra?.orderId} for <strong style={{fontSize: '14px'}}>${log.extra?.revenue}</strong> 🎉</span>
                  )}
                </span>
                
                <span className={`${getPageTypeClass(log.pageType)}`} style={{fontSize: '10px', textTransform: 'uppercase'}}>
                  {log.pageType}
                </span>
              </div>
            ))}
            
            {logs.length === 0 && (
              <div style={{textAlign: 'center', padding: '32px 0', color: 'var(--colors-muted)'}}>
                Waiting for actions...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Page Performance Table */}
      <div className="chart-card">
        <div>
          <h3 className="title-md">Page URL Performance Directory</h3>
          <p className="body-sm" style={{color: 'var(--colors-muted)'}}>Breakdown of hits, retention time, and bounce ratios per page path.</p>
        </div>
        
        <div className="table-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Page Path URL</th>
                <th>Page Type</th>
                <th>Page Views (PV)</th>
                <th>Unique Users (UV)</th>
                <th>Avg. Stay Time</th>
                <th>Bounce Ratio</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p, idx) => (
                <tr key={idx}>
                  <td style={{fontFamily: 'monospace', fontWeight: 600, color: 'var(--colors-primary)'}}>{p.url}</td>
                  <td>
                    <span className={`${getPageTypeClass(p.pageType)}`}>
                      {p.pageType}
                    </span>
                  </td>
                  <td style={{fontWeight: 700}}>{p.pv.toLocaleString()}</td>
                  <td>{p.uv.toLocaleString()}</td>
                  <td>{p.avgStay}</td>
                  <td style={{color: parseFloat(p.bounceRate) > 50 ? 'var(--colors-warning)' : 'var(--colors-success)', fontWeight: 600}}>
                    {p.bounceRate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Telemetry Management Board */}
      <div className="simulation-drawer">
        <div className="simulation-info-text">
          <h4 className="title-sm" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
            <span>⚙️</span> Interactive Telemetry Control Board
          </h4>
          <p className="body-sm" style={{color: 'var(--colors-muted)'}}>
            Wipe and reset the live telemetry database logs to start over on a clean slate.
          </p>
        </div>
        
        <div style={{display: 'flex', gap: '12px'}}>
          <button className="btn btn-secondary" style={{color: 'var(--colors-error)'}} onClick={handleClear}>
            <Trash2 size={14} /> Clear Telemetry Database Logs
          </button>
        </div>
      </div>
      
    </div>
  );
}
