// ==========================================================================
// Dashboard.js: Cores Stats and Custom Analytics Rendering
// ==========================================================================

const { useState, useEffect, useMemo } = React;

const AnalyticsDashboard = () => {
  const getFormattedDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  const [datePreset, setDatePreset] = useState('7d'); // '3d', '7d', '15d', '30d', 'custom'
  const [startDate, setStartDate] = useState(getFormattedDate(7));
  const [endDate, setEndDate] = useState(getFormattedDate(0));

  const [stats, setStats] = useState({ totalPV: "0", uniqueUV: "0", totalClicks: "0", avgDuration: "0s", bounceRate: "0%", revenue: "₩0" });
  const [funnel, setFunnel] = useState([]);
  const [pages, setPages] = useState([]);
  const [dailyPerformance, setDailyPerformance] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simCount, setSimCount] = useState(0);

  // Lazy Loading State for Campaign Performance Grid [NEW]
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Toggle between Cumulative and Daily Average [NEW]
  const [viewMode, setViewMode] = useState('cumulative'); // 'cumulative', 'average'

  useEffect(() => {
    setVisibleCount(20);
  }, [startDate, endDate]);

  const isLiveServer = window.location.protocol.startsWith('http') && !window.location.hostname.endsWith('github.io');
  const apiBaseUrl = isLiveServer ? '' : 'https://exhibition-analysis-bychoi-s-projects.vercel.app';

  const refresh = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/stats?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setStats(data.stats);
      setFunnel(data.funnel);
      setPages(data.pages);
      setDailyPerformance(data.dailyPerformance || []);
      setLogs(data.logs);
    } catch (e) {
      console.error("Failed to fetch live stats from server.", e);
    }
  };

  useEffect(() => {
    refresh();
  }, [startDate, endDate]);

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = getFormattedDate(0);
    setEndDate(today);
    if (preset === '3d') {
      setStartDate(getFormattedDate(3));
    } else if (preset === '7d') {
      setStartDate(getFormattedDate(7));
    } else if (preset === '15d') {
      setStartDate(getFormattedDate(15));
    } else if (preset === '30d') {
      setStartDate(getFormattedDate(30));
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toTimeString().split(' ')[0];
  };

  const getPageTypeClass = (type) => `page-type-pill ${type.toLowerCase()}`;

  // Daily chart calculations
  const [selectedMetric, setSelectedMetric] = useState('all'); // 'all', 'pv', 'uv', 'clicks', 'revenue'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = 1000 - paddingLeft - paddingRight; // 920 for expanded width
  const chartHeight = 220 - paddingTop - paddingBottom;

  const chartData = useMemo(() => {
    if (!dailyPerformance || dailyPerformance.length === 0) {
      return {};
    }

    const result = {};
    const metricKeys = ['pv', 'uv', 'clicks', 'revenue'];

    metricKeys.forEach(m => {
      const values = dailyPerformance.map(d => d[m] || 0);
      let maxValue = Math.max(...values, 0);
      let maxVal = maxValue > 0 ? maxValue : 10;
      maxVal = Math.ceil(maxVal * 1.15);

      const N = dailyPerformance.length;
      const points = dailyPerformance.map((item, idx) => {
        const x = paddingLeft + (idx / Math.max(N - 1, 1)) * chartWidth;
        const y = (220 - paddingBottom) - ((item[m] || 0) / maxVal) * chartHeight;
        return { x, y };
      });

      // Make smooth cubic bezier curve
      let linePath = '';
      let areaPath = '';
      if (points.length > 0) {
        linePath = `M ${points[0].x} ${points[0].y}`;
        areaPath = `M ${points[0].x} ${220 - paddingBottom} L ${points[0].x} ${points[0].y}`;
        
        for (let i = 0; i < points.length - 1; i++) {
          const cpX1 = points[i].x + (points[i+1].x - points[i].x) / 3;
          const cpY1 = points[i].y;
          const cpX2 = points[i].x + 2 * (points[i+1].x - points[i].x) / 3;
          const cpY2 = points[i+1].y;
          
          linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i+1].x} ${points[i+1].y}`;
          areaPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i+1].x} ${points[i+1].y}`;
        }
        
        areaPath += ` L ${points[points.length - 1].x} ${220 - paddingBottom} Z`;
      }

      const gridLines = [0, Math.floor(maxVal * 0.33), Math.floor(maxVal * 0.66), maxVal];

      result[m] = { points, maxVal, gridLines, linePath, areaPath };
    });

    return result;
  }, [dailyPerformance, chartWidth, chartHeight]);

  const activePoints = useMemo(() => {
    const refMetric = selectedMetric === 'all' ? 'pv' : selectedMetric;
    return chartData[refMetric]?.points || [];
  }, [selectedMetric, chartData]);

  const gridLinesToRender = useMemo(() => {
    if (selectedMetric === 'all') {
      return [
        { yVal: 100, label: '100%', isPercent: true },
        { yVal: 66, label: '66%', isPercent: true },
        { yVal: 33, label: '33%', isPercent: true },
        { yVal: 0, label: '0%', isPercent: true }
      ];
    }
    if (chartData[selectedMetric]) {
      const { gridLines, maxVal } = chartData[selectedMetric];
      return gridLines.map(v => ({
        yVal: v,
        label: formatAxisValue(v, selectedMetric),
        rawMax: maxVal,
        isPercent: false
      }));
    }
    return [];
  }, [selectedMetric, chartData]);

  const daysCount = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include today
    return Math.max(diffDays, 1);
  }, [startDate, endDate]);

  const displayStats = useMemo(() => {
    if (viewMode === 'cumulative') return stats;
    const rawPV = parseInt(stats.totalPV.replace(/,/g, '')) || 0;
    const rawUV = parseInt(stats.uniqueUV.replace(/,/g, '')) || 0;
    const rawClicks = parseInt(stats.totalClicks.replace(/,/g, '')) || 0;
    const rawRev = parseInt(stats.revenue.replace(/[^0-9]/g, '')) || 0;
    
    return {
      ...stats,
      totalPV: Math.round(rawPV / daysCount).toLocaleString(),
      uniqueUV: Math.round(rawUV / daysCount).toLocaleString(),
      totalClicks: Math.round(rawClicks / daysCount).toLocaleString(),
      revenue: `₩${Math.round(rawRev / daysCount).toLocaleString()}`
    };
  }, [stats, viewMode, daysCount]);

  const displayFunnel = useMemo(() => {
    if (viewMode === 'cumulative') return funnel;
    return funnel.map(step => ({
      ...step,
      count: Math.round(step.count / daysCount)
    }));
  }, [funnel, viewMode, daysCount]);

  const displayPages = useMemo(() => {
    if (viewMode === 'cumulative') return pages;
    return pages.map(p => ({
      ...p,
      pv: Math.round(p.pv / daysCount),
      uv: Math.round(p.uv / daysCount),
      clicks: Math.round(p.clicks / daysCount),
      revenue: Math.round(p.revenue / daysCount)
    }));
  }, [pages, viewMode, daysCount]);

  const formatAxisValue = (val, metric) => {
    if (metric === 'revenue') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val;
    }
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val;
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : dateStr;
  };

  const shouldShowLabel = (idx, total) => {
    if (total <= 7) return true;
    if (total <= 14) return idx % 2 === 0;
    return idx % 4 === 0 || idx === total - 1;
  };

  return (
    <div className="dashboard-pane" style={{ maxWidth: '1500px', padding: 'var(--spacing-xl) var(--spacing-lg)' }}>
      
      {/* Dashboard Title Header */}
      <div className="dashboard-header-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="./exhibition_analytics_icon.png" alt="LFmall 기획전 성과 분석" style={{ width: '48px', height: '48px', borderRadius: 'var(--rounded-md)', border: '1px solid var(--colors-hairline)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }} />
          <div>
            <span className="caption-uppercase" style={{color: 'var(--colors-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em'}}>
              REAL-TIME GROWTH TELEMETRY
            </span>
            <h2 className="display-sm" style={{marginTop: '2px', fontWeight: 600, color: 'var(--colors-ink)', fontSize: '24px', letterSpacing: '-0.02em'}}>LFmall 기획전 성과 분석</h2>
          </div>
        </div>
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
          {isSimulating && (
            <div className="realtime-indicator-pulse">
              <span className="pulse-dot"></span>
              <span>실시간 트래픽 수집 중 ({simCount} hits)</span>
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={refresh}><window.IconRefresh /> 수동 새로고침</button>
        </div>
      </div>

      {/* Date Range Selector Panel */}
      <div className="simulation-drawer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--colors-surface-soft)', padding: '12px 20px', borderRadius: 'var(--rounded-lg)', marginBottom: 'var(--spacing-md)', border: '1px solid var(--colors-hairline)', marginTop: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--colors-muted)', marginRight: '8px' }}>조회 기간:</span>
          {['3d', '7d', '15d', '30d', 'custom'].map(preset => {
            const labels = { '3d': '최근 3일', '7d': '최근 7일', '15d': '최근 15일', '30d': '최근 30일', 'custom': '직접 지정' };
            const isActive = datePreset === preset;
            return (
              <button
                key={preset}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handlePresetChange(preset)}
                style={{
                  height: '28px',
                  fontSize: '12px',
                  padding: '4px 12px',
                  backgroundColor: isActive ? 'var(--colors-brand-teal)' : 'var(--colors-canvas)',
                  color: isActive ? '#ffffff' : 'var(--colors-ink)',
                  borderRadius: 'var(--rounded-pill)',
                  border: isActive ? 'none' : '1px solid var(--colors-hairline)'
                }}
              >
                {labels[preset]}
              </button>
            );
          })}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="date"
            className="text-input"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatePreset('custom');
            }}
            disabled={datePreset !== 'custom'}
            style={{
              height: '32px',
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: 'var(--rounded-sm)',
              backgroundColor: datePreset === 'custom' ? 'var(--colors-canvas)' : 'var(--colors-surface-strong)',
              border: '1px solid var(--colors-hairline)',
              fontFamily: 'monospace'
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--colors-muted)', fontWeight: 600 }}>~</span>
          <input
            type="date"
            className="text-input"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatePreset('custom');
            }}
            disabled={datePreset !== 'custom'}
            style={{
              height: '32px',
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: 'var(--rounded-sm)',
              backgroundColor: datePreset === 'custom' ? 'var(--colors-canvas)' : 'var(--colors-surface-strong)',
              border: '1px solid var(--colors-hairline)',
              fontFamily: 'monospace'
            }}
          />
        </div>
      </div>

      {/* Interactive Daily Performance Trend SVG Chart */}
      <div className="chart-card daily-trend-chart-card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div className="trend-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📈</span> 기획전 일별 통합 성과 추이 (Daily Performance Trend)
            </h3>
            <p className="body-sm" style={{ color: 'var(--colors-muted)', marginTop: '2px' }}>조회 기간 동안의 일자별 성과 변화 추세 및 비즈니스 트렌드를 모니터링합니다.</p>
          </div>
          
          <div className="metric-tabs" style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--colors-surface-strong)', padding: '3px', borderRadius: 'var(--rounded-pill)' }}>
            {[
              { id: 'all', label: '전체', color: 'var(--colors-ink)' },
              { id: 'pv', label: '페이지뷰 (PV)', color: 'var(--colors-brand-pink)' },
              { id: 'uv', label: '순 방문자 (UV)', color: 'var(--colors-brand-teal)' },
              { id: 'clicks', label: '클릭활동량 (Clicks)', color: 'var(--colors-brand-mint)' },
              { id: 'revenue', label: '기여 매출액 (Revenue)', color: 'var(--colors-brand-ochre)' }
            ].map(tab => {
              const isActive = selectedMetric === tab.id;
              const dotColor = tab.color;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMetric(tab.id)}
                  style={{
                    border: 'none',
                    background: isActive ? 'var(--colors-canvas)' : 'none',
                    color: isActive ? 'var(--colors-ink)' : 'var(--colors-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: 'var(--rounded-pill)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor }}></span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="trend-chart-body" style={{ marginTop: 'var(--spacing-md)', position: 'relative', height: '220px' }}>
          {dailyPerformance.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--colors-muted-soft)', fontSize: '13px' }}>
              선택된 기간에 분석 데이터가 존재하지 않습니다.
            </div>
          ) : (
            <svg viewBox="0 0 1000 220" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="grad-pv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--colors-brand-pink)" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="var(--colors-brand-pink)" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="grad-uv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--colors-brand-teal)" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="var(--colors-brand-teal)" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="grad-clicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--colors-brand-mint)" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="var(--colors-brand-mint)" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--colors-brand-ochre)" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="var(--colors-brand-ochre)" stopOpacity="0.0"/>
                </linearGradient>
              </defs>

              {gridLinesToRender.map((item, i) => {
                const yCoord = item.isPercent
                  ? (220 - paddingBottom) - (item.yVal / 100) * chartHeight
                  : (220 - paddingBottom) - (item.yVal / item.rawMax) * chartHeight;
                return (
                  <g key={i}>
                    <line 
                      x1={paddingLeft} 
                      y1={yCoord} 
                      x2={1000 - paddingRight} 
                      y2={yCoord} 
                      stroke="var(--colors-hairline)" 
                      strokeWidth="1"
                    />
                    <text 
                      x={paddingLeft - 10} 
                      y={yCoord + 4} 
                      fill="var(--colors-muted)" 
                      fontSize="10" 
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}

              {selectedMetric !== 'all' ? (
                chartData[selectedMetric] && (
                  <path 
                    d={chartData[selectedMetric].areaPath} 
                    fill={`url(#grad-${selectedMetric})`}
                    style={{ transition: 'd 0.3s ease-out' }}
                  />
                )
              ) : null}

              {selectedMetric === 'all' ? (
                ['pv', 'uv', 'clicks', 'revenue'].map(m => {
                  const mColor = m === 'pv' ? 'var(--colors-brand-pink)' : m === 'uv' ? 'var(--colors-brand-teal)' : m === 'clicks' ? 'var(--colors-brand-mint)' : 'var(--colors-brand-ochre)';
                  return chartData[m] && (
                    <path 
                      key={m}
                      d={chartData[m].linePath} 
                      fill="none" 
                      stroke={mColor} 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transition: 'd 0.3s ease-out' }}
                    />
                  );
                })
              ) : (
                chartData[selectedMetric] && (
                  <path 
                    d={chartData[selectedMetric].linePath} 
                    fill="none" 
                    stroke={selectedMetric === 'pv' ? 'var(--colors-brand-pink)' : selectedMetric === 'uv' ? 'var(--colors-brand-teal)' : selectedMetric === 'clicks' ? 'var(--colors-brand-mint)' : 'var(--colors-brand-ochre)'} 
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'd 0.3s ease-out' }}
                  />
                )
              )}

              <line 
                x1={paddingLeft} 
                y1={220 - paddingBottom} 
                x2={1000 - paddingRight} 
                y2={220 - paddingBottom} 
                stroke="var(--colors-muted-soft)" 
                strokeWidth="1"
              />

              {activePoints.map((p, i) => {
                if (!shouldShowLabel(i, activePoints.length)) return null;
                return (
                  <text 
                    key={i}
                    x={p.x} 
                    y={220 - paddingBottom + 16} 
                    fill="var(--colors-muted)" 
                    fontSize="10" 
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {formatDateLabel(dailyPerformance[i].date)}
                  </text>
                );
              })}

              {activePoints.map((p, i) => {
                const colWidth = chartWidth / Math.max(activePoints.length, 1);
                return (
                  <rect
                    key={i}
                    x={p.x - colWidth / 2}
                    y={paddingTop}
                    width={colWidth}
                    height={chartHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })}

              {hoveredIndex !== null && activePoints[hoveredIndex] && (
                <line 
                  x1={activePoints[hoveredIndex].x} 
                  y1={paddingTop} 
                  x2={activePoints[hoveredIndex].x} 
                  y2={220 - paddingBottom} 
                  stroke="var(--colors-muted-soft)" 
                  strokeDasharray="3 3" 
                  strokeWidth="1.5" 
                />
              )}

              {selectedMetric === 'all' ? (
                ['pv', 'uv', 'clicks', 'revenue'].map(m => {
                  const mColor = m === 'pv' ? 'var(--colors-brand-pink)' : m === 'uv' ? 'var(--colors-brand-teal)' : m === 'clicks' ? 'var(--colors-brand-mint)' : 'var(--colors-brand-ochre)';
                  const pts = chartData[m]?.points || [];
                  const p = pts[hoveredIndex];
                  if (!p) return null;
                  return (
                    <circle 
                      key={m}
                      cx={p.x}
                      cy={p.y}
                      r={5}
                      fill="var(--colors-canvas)"
                      stroke={mColor}
                      strokeWidth={3}
                      pointerEvents="none"
                    />
                  );
                })
              ) : (
                activePoints.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const metricColor = selectedMetric === 'pv' ? 'var(--colors-brand-pink)' : selectedMetric === 'uv' ? 'var(--colors-brand-teal)' : selectedMetric === 'clicks' ? 'var(--colors-brand-mint)' : 'var(--colors-brand-ochre)';
                  return (
                    <circle 
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 3.5}
                      fill="var(--colors-canvas)"
                      stroke={metricColor}
                      strokeWidth={isHovered ? 3 : 2}
                      style={{ transition: 'r 0.15s ease-out, stroke-width 0.15s ease-out' }}
                      pointerEvents="none"
                    />
                  );
                })
              )}

              {hoveredIndex !== null && dailyPerformance[hoveredIndex] && activePoints[hoveredIndex] && (
                <g style={{ pointerEvents: 'none' }}>
                  {selectedMetric === 'all' ? (
                    <g>
                      <rect 
                        x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 : activePoints[hoveredIndex].x + 15} 
                        y={20} 
                        width="160" 
                        height="130" 
                        rx="8" 
                        fill="var(--colors-surface-dark)" 
                        opacity="0.96" 
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                      />
                      <text 
                        x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 80 : activePoints[hoveredIndex].x + 15 + 80} 
                        y={38} 
                        fill="var(--colors-on-dark)" 
                        fontSize="11" 
                        fontWeight="700" 
                        textAnchor="middle"
                      >
                        {dailyPerformance[hoveredIndex].date}
                      </text>
                      
                      {/* PV row */}
                      <circle cx={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 20 : activePoints[hoveredIndex].x + 15 + 20} cy={58} r="4" fill="var(--colors-brand-pink)" />
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 32 : activePoints[hoveredIndex].x + 15 + 32} y={62} fill="var(--colors-muted-soft)" fontSize="10" fontWeight="500">페이지뷰 (PV):</text>
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 145 : activePoints[hoveredIndex].x + 15 + 145} y={62} fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="end">{(dailyPerformance[hoveredIndex].pv || 0).toLocaleString()}</text>
                      
                      {/* UV row */}
                      <circle cx={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 20 : activePoints[hoveredIndex].x + 15 + 20} cy={78} r="4" fill="var(--colors-brand-teal)" />
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 32 : activePoints[hoveredIndex].x + 15 + 32} y={82} fill="var(--colors-muted-soft)" fontSize="10" fontWeight="500">순방문자 (UV):</text>
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 145 : activePoints[hoveredIndex].x + 15 + 145} y={82} fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="end">{(dailyPerformance[hoveredIndex].uv || 0).toLocaleString()}</text>

                      {/* Clicks row */}
                      <circle cx={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 20 : activePoints[hoveredIndex].x + 15 + 20} cy={98} r="4" fill="var(--colors-brand-mint)" />
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 32 : activePoints[hoveredIndex].x + 15 + 32} y={102} fill="var(--colors-muted-soft)" fontSize="10" fontWeight="500">클릭활동량:</text>
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 145 : activePoints[hoveredIndex].x + 15 + 145} y={102} fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="end">{(dailyPerformance[hoveredIndex].clicks || 0).toLocaleString()}</text>

                      {/* Revenue row */}
                      <circle cx={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 20 : activePoints[hoveredIndex].x + 15 + 20} cy={118} r="4" fill="var(--colors-brand-ochre)" />
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 32 : activePoints[hoveredIndex].x + 15 + 32} y={122} fill="var(--colors-muted-soft)" fontSize="10" fontWeight="500">기여매출액:</text>
                      <text x={activePoints[hoveredIndex].x + 15 + 160 > 1000 ? activePoints[hoveredIndex].x - 175 + 145 : activePoints[hoveredIndex].x + 15 + 145} y={122} fill="var(--colors-brand-ochre)" fontSize="10" fontWeight="700" textAnchor="end">₩{(dailyPerformance[hoveredIndex].revenue || 0).toLocaleString()}</text>
                    </g>
                  ) : (
                    <g>
                      <rect 
                        x={activePoints[hoveredIndex].x - 65} 
                        y={Math.max(activePoints[hoveredIndex].y - 52, 5)} 
                        width="130" 
                        height="40" 
                        rx="6" 
                        fill="var(--colors-surface-dark)" 
                        opacity="0.95" 
                      />
                      <text 
                        x={activePoints[hoveredIndex].x} 
                        y={Math.max(activePoints[hoveredIndex].y - 38, 19)} 
                        fill="var(--colors-on-dark)" 
                        fontSize="9" 
                        fontWeight="600" 
                        textAnchor="middle"
                      >
                        {dailyPerformance[hoveredIndex].date}
                      </text>
                      <text 
                        x={activePoints[hoveredIndex].x} 
                        y={Math.max(activePoints[hoveredIndex].y - 22, 35)} 
                        fill={selectedMetric === 'pv' ? 'var(--colors-brand-pink)' : selectedMetric === 'uv' ? 'var(--colors-brand-teal)' : selectedMetric === 'clicks' ? 'var(--colors-brand-mint)' : 'var(--colors-brand-ochre)'} 
                        fontSize="11" 
                        fontWeight="700" 
                        textAnchor="middle"
                      >
                        {selectedMetric === 'revenue' 
                          ? `₩${dailyPerformance[hoveredIndex].revenue.toLocaleString()}` 
                          : `${(dailyPerformance[hoveredIndex][selectedMetric] || 0).toLocaleString()} ${selectedMetric === 'pv' ? 'PV' : selectedMetric === 'clicks' ? '회' : '명'}`
                        }
                      </text>
                    </g>
                  )}
                </g>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* Cumulative vs Daily Average Toggle Selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
        <div className="view-mode-toggle" style={{ display: 'flex', backgroundColor: 'var(--colors-surface-strong)', padding: '3px', borderRadius: 'var(--rounded-pill)', border: '1px solid var(--colors-hairline)', position: 'relative', zIndex: 10 }}>
          {[
            { id: 'cumulative', label: '📊 누적 데이터 (Cumulative)' },
            { id: 'average', label: '⏱️ 일 평균 데이터 (Daily Avg)' }
          ].map(mode => {
            const isActive = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode(mode.id)}
                style={{
                  height: '28px',
                  fontSize: '12px',
                  padding: '4px 14px',
                  backgroundColor: isActive ? 'var(--colors-brand-teal)' : 'var(--colors-canvas)',
                  color: isActive ? '#ffffff' : 'var(--colors-ink)',
                  borderRadius: 'var(--rounded-pill)',
                  border: isActive ? 'none' : '1px solid var(--colors-hairline)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 600
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Scorecard Metrics */}
      <div className="dashboard-stats-grid">
        <div className="stat-card colored-pink">
          <div className="stat-header">
            <span className="caption-uppercase">
              {viewMode === 'average' ? '기획전 일 평균 페이지 뷰 (PV)' : '기획전 누적 페이지 뷰 (PV)'}
            </span>
            <window.IconEye color="var(--colors-brand-pink)" />
          </div>
          <span className="stat-value">{displayStats.totalPV}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>
            {viewMode === 'average' ? 'Daily Avg Hits' : 'Total Web Hits'}
          </span>
        </div>

        <div className="stat-card colored-teal">
          <div className="stat-header">
            <span className="caption-uppercase">
              {viewMode === 'average' ? '기획전 일 평균 방문자 (UV)' : '기획전 순 방문자 수 (UV)'}
            </span>
            <window.IconUsers color="var(--colors-brand-teal)" />
          </div>
          <span className="stat-value">{displayStats.uniqueUV}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>
            {viewMode === 'average' ? 'Daily Avg Users' : 'Unique Session UUIDs'}
          </span>
        </div>

        <div className="stat-card colored-mint">
          <div className="stat-header">
            <span className="caption-uppercase">
              {viewMode === 'average' ? '기획전 일 평균 클릭 활동량' : '기획전 내 클릭 활동량 (Clicks)'}
            </span>
            <window.IconCursor color="var(--colors-brand-mint)" />
          </div>
          <span className="stat-value">{displayStats.totalClicks}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>
            {viewMode === 'average' ? 'Daily Avg Clicks' : 'Attributed Interactions'}
          </span>
        </div>

        <div className="stat-card colored-lavender">
          <div className="stat-header">
            <span className="caption-uppercase">기획전 평균 체류시간</span>
            <window.IconClock color="var(--colors-brand-lavender)" />
          </div>
          <span className="stat-value">{displayStats.avgDuration}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Session Heartbeat Avg</span>
        </div>

        <div className="stat-card colored-peach">
          <div className="stat-header">
            <span className="caption-uppercase">기획전 이탈률 (Bounce Rate)</span>
            <window.IconTrendingUp color="var(--colors-brand-peach)" />
          </div>
          <span className="stat-value">{displayStats.bounceRate}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>Single Page Sessions</span>
        </div>

        <div className="stat-card colored-ochre">
          <div className="stat-header">
            <span className="caption-uppercase">
              {viewMode === 'average' ? '기획전 일 평균 기여 매출액' : '기획전 기여 매출액 (Last-Touch)'}
            </span>
            <window.IconSparkles color="var(--colors-brand-ochre)" />
          </div>
          <span className="stat-value" style={{ fontSize: '26px', lineHeight: '38px' }}>{displayStats.revenue}</span>
          <span className="caption" style={{color: 'var(--colors-muted)'}}>
            {viewMode === 'average' ? 'Daily Avg Sales Revenue' : 'Conversion Sales Revenue'}
          </span>
        </div>
      </div>



      {/* Campaign Cards Grid */}
      <window.CampaignGrid 
        displayPages={displayPages} 
        viewMode={viewMode} 
        visibleCount={visibleCount} 
        setVisibleCount={setVisibleCount}
        isLoadingMore={isLoadingMore}
        setIsLoadingMore={setIsLoadingMore}
      />
    </div>
  );
};

window.AnalyticsDashboard = AnalyticsDashboard;
