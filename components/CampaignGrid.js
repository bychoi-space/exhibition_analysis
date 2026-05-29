// ==========================================================================
// CampaignGrid.js: Premium Brand Grid Card with Lazy Loading & Dynamic Sorting
// ==========================================================================

const CampaignGrid = ({ displayPages, viewMode, visibleCount, setVisibleCount, isLoadingMore, setIsLoadingMore }) => {
  const [layoutMode, setLayoutMode] = React.useState('list'); // Default to 'list'!
  const [sortField, setSortField] = React.useState('pv'); // Default sort field: accumulated PV
  const [sortDirection, setSortDirection] = React.useState('desc'); // Default sort direction: descending

  // Dynamic Multi-type Sorting logic
  const sortedPages = React.useMemo(() => {
    if (!displayPages || displayPages.length === 0) return [];
    
    const pagesCopy = [...displayPages];
    pagesCopy.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Special parsing for strings/percentages/times
      if (sortField === 'title') {
        aVal = a.title.replace(/\([^)]+\)/, '').trim();
        bVal = b.title.replace(/\([^)]+\)/, '').trim();
      }
      if (sortField === 'brand') {
        const matchA = a.title.match(/\(([^)]+)\)/);
        const matchB = b.title.match(/\(([^)]+)\)/);
        aVal = matchA ? matchA[1] : 'LF MALL';
        bVal = matchB ? matchB[1] : 'LF MALL';
      }
      if (sortField === 'avgStay') {
        aVal = parseInt(a.avgStay) || 0;
        bVal = parseInt(b.avgStay) || 0;
      }
      if (sortField === 'bounceRate') {
        aVal = parseFloat(a.bounceRate) || 0;
        bVal = parseFloat(b.bounceRate) || 0;
      }
      if (sortField === 'cvr') {
        aVal = parseFloat(a.cvr) || 0;
        bVal = parseFloat(b.cvr) || 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal, 'ko') 
          : bVal.localeCompare(aVal, 'ko');
      } else {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    return pagesCopy;
  }, [displayPages, sortField, sortDirection]);

  // Click handler for column sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending on new field selection
    }
  };

  // Render sorting visual indicator arrow
  const renderSortArrow = (field) => {
    if (sortField !== field) return <span style={{ color: 'var(--colors-muted-soft)', marginLeft: '4px', fontSize: '10px', transition: 'all 0.2s' }}>⇅</span>;
    return sortDirection === 'asc' 
      ? <span style={{ color: 'var(--colors-brand-teal)', marginLeft: '4px', fontSize: '10px', fontWeight: 'bold' }}>▲</span> 
      : <span style={{ color: 'var(--colors-brand-teal)', marginLeft: '4px', fontSize: '10px', fontWeight: 'bold' }}>▼</span>;
  };

  return (
    <div className="chart-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: 'var(--spacing-md)' }}>
        <div>
          <h3 className="title-md">
            {viewMode === 'average' ? '🔥 현재 운영 중인 실시간 기획전 성과 순위 (일 평균)' : '🔥 현재 운영 중인 실시간 기획전 성과 순위'}
          </h3>
          <p className="body-sm" style={{color: 'var(--colors-muted)', marginTop: '2px'}}>
            {viewMode === 'average' ? '현재 활성화되어 있는 각 기획전별 일 평균 성과 지표 랭킹입니다.' : '현재 활성화되어 있는 각 기획전별 순 유저(UV), 체류시간, 전환율 및 Last-Touch 기여 매출액 랭킹입니다.'}
          </p>
        </div>

        {/* View Layout Mode Toggle Button */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="caption-uppercase" style={{ backgroundColor: 'var(--colors-surface-soft)', color: 'var(--colors-brand-teal)', padding: '4px 10px', borderRadius: 'var(--rounded-pill)', fontSize: '11px', fontWeight: 700, border: '1px solid var(--colors-hairline)' }}>
            총 {displayPages.length}개 운영 중
          </span>
          <div style={{ display: 'flex', backgroundColor: 'var(--colors-surface-strong)', padding: '3px', borderRadius: 'var(--rounded-pill)', border: '1px solid var(--colors-hairline)' }}>
            <button
              onClick={() => setLayoutMode('card')}
              style={{
                border: 'none',
                background: layoutMode === 'card' ? 'var(--colors-canvas)' : 'none',
                color: layoutMode === 'card' ? 'var(--colors-ink)' : 'var(--colors-muted)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 'var(--rounded-pill)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🎴 카드형
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              style={{
                border: 'none',
                background: layoutMode === 'list' ? 'var(--colors-canvas)' : 'none',
                color: layoutMode === 'list' ? 'var(--colors-ink)' : 'var(--colors-muted)',
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 'var(--rounded-pill)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              📝 리스트형
            </button>
          </div>
        </div>
      </div>

      {layoutMode === 'list' ? (
        /* PREMIUM LEDGER LIST VIEW WITH COLUMNS SORTING */
        <div className="table-container" style={{ marginTop: 'var(--spacing-md)' }}>
          <table className="analytics-table">
            <thead>
              <tr style={{ userSelect: 'none' }}>
                <th style={{ width: '60px', textAlign: 'center' }}>순위</th>
                <th onClick={() => handleSort('brand')} style={{ width: '110px', cursor: 'pointer' }}>
                  브랜드 {renderSortArrow('brand')}
                </th>
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
                  기획전 명칭 {renderSortArrow('title')}
                </th>
                <th onClick={() => handleSort('id')} style={{ width: '90px', textAlign: 'center', cursor: 'pointer' }}>
                  기획전 번호 {renderSortArrow('id')}
                </th>
                <th onClick={() => handleSort('pv')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  {viewMode === 'average' ? '일 평균 PV' : '누적 PV'} {renderSortArrow('pv')}
                </th>
                <th onClick={() => handleSort('uv')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  {viewMode === 'average' ? '일 평균 UV' : '순 방문자'} {renderSortArrow('uv')}
                </th>
                <th onClick={() => handleSort('clicks')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  {viewMode === 'average' ? '일 평균 클릭' : '클릭 활동'} {renderSortArrow('clicks')}
                </th>
                <th onClick={() => handleSort('avgStay')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  체류시간 {renderSortArrow('avgStay')}
                </th>
                <th onClick={() => handleSort('bounceRate')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  이탈률 {renderSortArrow('bounceRate')}
                </th>
                <th onClick={() => handleSort('cvr')} style={{ textAlign: 'center', cursor: 'pointer' }}>
                  CVR {renderSortArrow('cvr')}
                </th>
                <th onClick={() => handleSort('revenue')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  기여 매출액 {renderSortArrow('revenue')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPages.slice(0, visibleCount).map((p, idx) => {
                const brandMatch = p.title.match(/\(([^)]+)\)/);
                const brandName = brandMatch ? brandMatch[1] : 'LF MALL';
                const cleanTitle = p.title.replace(/\([^)]+\)/, '').trim();

                const getBrandColor = (brand) => {
                  const b = brand.toUpperCase();
                  if (b.includes('DAKS') || b.includes('닥스')) return 'var(--colors-brand-pink)';
                  if (b.includes('HAZZYS') || b.includes('헤지스')) return 'var(--colors-brand-teal)';
                  if (b.includes('JILL') || b.includes('질스튜어트') || b.includes('질바이')) return 'var(--colors-brand-lavender)';
                  if (b.includes('ATHE') || b.includes('아떼') || b.includes('바네사') || b.includes('앳코너')) return 'var(--colors-brand-ochre)';
                  if (b.includes('LUXURY') || b.includes('명품') || b.includes('이자벨') || b.includes('바버') || b.includes('레오나드')) return 'var(--colors-brand-coral)';
                  if (b.includes('더캐리') || b.includes('CARRY') || b.includes('CARREY')) return 'var(--colors-brand-ochre)';
                  return 'var(--colors-brand-mint)';
                };

                const brandColor = getBrandColor(brandName);
                const isTop3 = idx < 3;
                const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

                return (
                  <tr key={p.id || idx} style={{ transition: 'all 0.2s' }}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: isTop3 ? '16px' : '13px' }}>
                      {rankEmoji}
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        fontSize: '11px', 
                        fontWeight: '700', 
                        padding: '2px 8px', 
                        borderRadius: 'var(--rounded-pill)', 
                        backgroundColor: `${brandColor}15`, 
                        color: brandColor,
                        border: `1px solid ${brandColor}30`,
                        textAlign: 'center',
                        width: '90px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {brandName}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--colors-ink)', fontSize: '14px' }}>{cleanTitle}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--colors-muted-soft)', fontFamily: 'monospace' }}>
                      #{p.id}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '500', fontFamily: 'monospace' }}>{p.pv.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: '500', fontFamily: 'monospace' }}>{p.uv.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--colors-brand-pink)', fontFamily: 'monospace' }}>{p.clicks.toLocaleString()}회</td>
                    <td style={{ textAlign: 'center', fontWeight: '500' }}>{p.avgStay}</td>
                    <td style={{ textAlign: 'center', color: parseFloat(p.bounceRate) > 50 ? 'var(--colors-warning)' : 'var(--colors-success)', fontWeight: '600' }}>🚪 {p.bounceRate}</td>
                    <td style={{ textAlign: 'center', color: 'var(--colors-brand-teal)', fontWeight: '600' }}>🎯 {p.cvr}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--colors-ink)' }}>₩{p.revenue.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ORIGINAL PREMIUM CARDS GRID VIEW WITH ACTIVE SORTING */
        <div className="campaign-grid">
          {sortedPages.slice(0, visibleCount).map((p, idx) => {
            const brandMatch = p.title.match(/\(([^)]+)\)/);
            const brandName = brandMatch ? brandMatch[1] : 'LF MALL';
            const cleanTitle = p.title.replace(/\([^)]+\)/, '').trim();

            const getBrandColor = (brand) => {
              const b = brand.toUpperCase();
              if (b.includes('DAKS') || b.includes('닥스')) return 'var(--colors-brand-pink)';
              if (b.includes('HAZZYS') || b.includes('헤지스')) return 'var(--colors-brand-teal)';
              if (b.includes('JILL') || b.includes('질스튜어트') || b.includes('질바이')) return 'var(--colors-brand-lavender)';
              if (b.includes('ATHE') || b.includes('아떼') || b.includes('바네사') || b.includes('앳코너')) return 'var(--colors-brand-ochre)';
              if (b.includes('LUXURY') || b.includes('명품') || b.includes('이자벨') || b.includes('바버') || b.includes('레오나드')) return 'var(--colors-brand-coral)';
              if (b.includes('더캐리') || b.includes('CARRY') || b.includes('CARREY')) return 'var(--colors-brand-ochre)';
              return 'var(--colors-brand-mint)';
            };

            const brandColor = getBrandColor(brandName);

            return (
              <div key={p.id || idx} className="campaign-card" style={{ '--card-brand-color': brandColor }}>
                <div className="campaign-card-brand-stripe" style={{ backgroundColor: brandColor }} />
                
                <div className="campaign-card-header">
                  <span className="campaign-card-brand" style={{ backgroundColor: `${brandColor}15`, color: brandColor }}>
                    {brandName}
                  </span>
                  <span className="campaign-card-id">#{p.id}</span>
                </div>

                <h4 className="campaign-card-title" title={p.title}>{cleanTitle}</h4>

                <div className="campaign-card-metrics">
                  <div className="campaign-metric-item">
                    <span className="campaign-metric-label">
                      {viewMode === 'average' ? '일 평균 PV' : '누적 PV'}
                    </span>
                    <span className="campaign-metric-value">{p.pv.toLocaleString()}</span>
                  </div>
                  <div className="campaign-metric-item">
                    <span className="campaign-metric-label">
                      {viewMode === 'average' ? '일 평균 UV' : '순 방문자'}
                    </span>
                    <span className="campaign-metric-value">{p.uv.toLocaleString()}</span>
                  </div>
                  <div className="campaign-metric-item">
                    <span className="campaign-metric-label">
                      {viewMode === 'average' ? '일 평균 클릭' : '클릭 활동'}
                    </span>
                    <span className="campaign-metric-value" style={{ color: 'var(--colors-brand-pink)', fontWeight: 700 }}>
                      {p.clicks.toLocaleString()}회
                    </span>
                  </div>
                  <div className="campaign-metric-item">
                    <span className="campaign-metric-label">체류 시간</span>
                    <span className="campaign-metric-value">{p.avgStay}</span>
                  </div>
                </div>

                <div className="campaign-card-footer">
                  <div className="campaign-ratio-group">
                    <span className="campaign-ratio-badge" title="이탈률">
                      🚪 {p.bounceRate}
                    </span>
                    <span className="campaign-ratio-badge" title="구매 전환율 (CVR)" style={{ color: 'var(--colors-brand-teal)' }}>
                      🎯 {p.cvr}
                    </span>
                  </div>
                  <span className="campaign-revenue-badge">
                    ₩{p.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lazy Load Button */}
      {visibleCount < displayPages.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setIsLoadingMore(true);
              setTimeout(() => {
                setVisibleCount(prev => prev + 10);
                setIsLoadingMore(false);
              }, 800);
            }}
            disabled={isLoadingMore}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: 'var(--rounded-pill)',
              fontWeight: 600,
              border: '1px solid var(--colors-hairline)',
              backgroundColor: 'var(--colors-canvas)',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              transition: 'all 0.2s',
              color: 'var(--colors-ink)'
            }}
          >
            {isLoadingMore ? (
              <>
                <span className="spinner"></span>
                <span>데이터 집계 분석 중...</span>
              </>
            ) : (
              <>
                <span>➕ 더 많은 기획전 성과 로드 ({displayPages.length - visibleCount}개 대기)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

window.CampaignGrid = CampaignGrid;
