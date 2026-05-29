const { useState, useEffect, useRef } = React;

function CampaignDetail({ campaignId, campaignData, onBack }) {
  const [clickStats, setClickStats] = useState([]);
  const [isLoadingHtml, setIsLoadingHtml] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const iframeRef = useRef(null);

  // 기획전 상세 지표 추출
  const stats = campaignData || {
    title: '기획전 상세 분석',
    brand: 'LF MALL',
    pv: 0,
    uv: 0,
    clicks: 0,
    revenue: 0,
    avgStay: '0s',
    bounceRate: '0%',
    cvr: '0.0%'
  };

  // 브랜드 괄호 제거 타이틀 정제 및 브랜드 추출
  const cleanTitle = stats.title.replace(/\([^)]+\)\s*/g, '');
  const brandName = stats.brand || 'LF MALL';

  // 1. 요소별 실시간 클릭 로그 통계 Fetch
  useEffect(() => {
    if (!campaignId) return;

    fetch(`/api/campaign-clicks?id=${campaignId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setClickStats(data.clicks || []);
        }
      })
      .catch(err => {
        console.error('[DETAIL-CLICKS-ERROR]', err);
      });
  }, [campaignId]);

  // 2. Iframe 로드 완료 시 Same-Origin DOM 클릭 오버레이 주입
  const handleIframeLoad = () => {
    setIsLoadingHtml(false);
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const iframeWin = iframe.contentWindow;

      if (!iframeDoc) {
        console.warn('[IFRAME-WARN] Cannot access iframe document');
        return;
      }

      console.log('[IFRAME-SUCCESS] SAME-ORIGIN Access Granted. Injecting dynamic overlay masks...');

      // 클릭수별 컬러 맵핑 함수 (Clay.com Saturated Palette 응용)
      const getHeatmapColor = (count) => {
        if (count >= 50) return 'rgba(255, 77, 139, 0.35)';   // Brand Pink (다량 클릭)
        if (count >= 20) return 'rgba(232, 185, 74, 0.35)';   // Brand Ochre (중량 클릭)
        if (count >= 5)  return 'rgba(184, 164, 237, 0.3)';   // Brand Lavender (보통 클릭)
        return 'rgba(164, 212, 197, 0.25)';                  // Brand Mint (소량 클릭)
      };

      // 요소별 클래스 매핑 및 인젝션 시작
      clickStats.forEach(({ elementClass, clickCount }) => {
        if (!elementClass) return;

        // 클래스 다중 매핑 (클래스명이 공백으로 이루어진 경우 여러 개 요소를 전부 잡도록 콤마로 결합)
        const selector = '.' + elementClass.trim().replace(/\s+/g, '.');
        let elements = [];
        try {
          elements = Array.from(iframeDoc.querySelectorAll(selector));
        } catch (e) {
          // 셀렉터 파싱 오류 시 기본적인 ClassName 탐색 폴백
          elements = Array.from(iframeDoc.getElementsByClassName(elementClass));
        }

        elements.forEach(el => {
          // void element (자식을 가질 수 없는 img, br 등) 제외 가드
          const isVoid = /^(img|input|br|hr)$/i.test(el.tagName);
          const targetEl = isVoid ? el.parentElement : el;
          if (!targetEl) return;

          // 1. 타겟 요소의 position 속성을 relative로 강제 지정하여 
          // 오버레이가 요소를 완벽히 기준으로 잡고 함께 스크롤되도록 고착화
          const originalPos = iframeWin.getComputedStyle(targetEl).position;
          if (originalPos === 'static') {
            targetEl.style.setProperty('position', 'relative', 'important');
          }

          // 2. 이미 해당 요소에 오버레이가 주입되어 있는지 중복 삽입 방지 체크
          if (targetEl.querySelector('.lfmall-click-overlay')) return;

          // 3. 반투명 오버레이 레이어 생성 (inset: 0 으로 요소 크기에 딱 맞춤)
          const overlay = iframeDoc.createElement('div');
          overlay.className = 'lfmall-click-overlay';
          overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: ${getHeatmapColor(clickCount)};
            border: 2px solid #ff4d8b;
            border-radius: 4px;
            pointer-events: none;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: overlayPulse 2s infinite ease-in-out;
          `;

          // 4. 숫자를 알려주는 핫(Hot) 클릭 뱃지
          const badge = iframeDoc.createElement('span');
          badge.className = 'lfmall-click-badge';
          badge.innerText = `🔥 ${clickCount} clicks`;
          badge.style.cssText = `
            background: #ff4d8b;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 9999px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
            pointer-events: none;
            white-space: nowrap;
          `;

          overlay.appendChild(badge);
          targetEl.appendChild(overlay);
        });
      });

      // iframe 내부 스타일에 펄스 애니메이션 키프레임 삽입
      if (!iframeDoc.getElementById('lfmall-heatmap-styles')) {
        const styleSheet = iframeDoc.createElement('style');
        styleSheet.id = 'lfmall-heatmap-styles';
        styleSheet.innerText = `
          @keyframes overlayPulse {
            0% { box-shadow: 0 0 0 0px rgba(255, 77, 139, 0.4); }
            70% { box-shadow: 0 0 0 8px rgba(255, 77, 139, 0); }
            100% { box-shadow: 0 0 0 0px rgba(255, 77, 139, 0); }
          }
        `;
        iframeDoc.head.appendChild(styleSheet);
      }

    } catch (err) {
      console.error('[IFRAME-OVERLAY-INJECTION-FAILED]', err);
      setErrorMessage('Same-Origin 정책 우회 완료 후 오버레이 주입 중 접근 에러가 발생했습니다.');
    }
  };

  return (
    <div className="campaign-detail-view" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* 뒤로가기 액션 바 - 컴팩트화 */}
      <div className="detail-action-bar" style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
        <button className="btn-back" onClick={onBack} style={{
          background: '#f5f0e0',
          border: '1px solid #e5e5e5',
          color: '#0a0a0a',
          padding: '6px 12px',
          borderRadius: 'var(--rounded-md)',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s ease-in-out'
        }}>
          ← 대시보드로 돌아가기
        </button>
        <span style={{ color: 'var(--colors-muted)', fontSize: '13px' }}>기획전 분석 상세 뷰 (아이디: #{campaignId})</span>
      </div>

      {/* 상단 메타데이터 & 성과 요약 그리드 수평 한 줄 결합 통합 배치 */}
      <div className="detail-top-bar-layout" style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '16px',
        alignItems: 'stretch',
        marginBottom: '16px'
      }}>
        {/* 좌측: 상단 메타데이터 패널 */}
        <div className="detail-metadata-card" style={{
          background: 'var(--colors-surface-card)',
          padding: '12px 16px',
          borderRadius: 'var(--rounded-md)',
          border: '1px solid var(--colors-hairline)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="brand-badge" style={{
              background: 'var(--colors-brand-teal)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 'var(--rounded-xs)',
              fontSize: '11px',
              fontWeight: '600'
            }}>{brandName}</span>
            <span style={{ fontSize: '11px', color: 'var(--colors-muted)', fontWeight: '500' }}>ID: #{campaignId}</span>
          </div>
          <h1 style={{
            fontSize: '17px',
            fontWeight: '600',
            color: 'var(--colors-ink)',
            letterSpacing: '-0.5px',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={cleanTitle}>{cleanTitle}</h1>
        </div>

        {/* 우측: 성과 요약 스코어카드 그리드 (5열 수평 배치) */}
        <div className="detail-stats-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px'
        }}>
          {/* 누적 PV 카드 */}
          <div className="detail-stat-card card-pink" style={{
            background: 'var(--colors-surface-soft)',
            borderLeft: '4px solid var(--colors-brand-pink)',
            padding: '10px 12px',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--colors-muted)', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>페이지뷰 (PV)</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)' }}>{stats.pv.toLocaleString()}</div>
          </div>

          {/* 순방문자 UV 카드 */}
          <div className="detail-stat-card card-peach" style={{
            background: 'var(--colors-surface-soft)',
            borderLeft: '4px solid var(--colors-brand-peach)',
            padding: '10px 12px',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--colors-muted)', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>순방문자 (UV)</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)' }}>{stats.uv.toLocaleString()}</div>
          </div>

          {/* 총 클릭 수 카드 */}
          <div className="detail-stat-card card-ochre" style={{
            background: 'var(--colors-surface-soft)',
            borderLeft: '4px solid var(--colors-brand-ochre)',
            padding: '10px 12px',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--colors-muted)', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>클릭활동량</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)' }}>{stats.clicks.toLocaleString()}</div>
          </div>

          {/* CVR 전환율 카드 */}
          <div className="detail-stat-card card-lavender" style={{
            background: 'var(--colors-surface-soft)',
            borderLeft: '4px solid var(--colors-brand-lavender)',
            padding: '10px 12px',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'var(--colors-muted)', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>전환율 (CVR)</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--colors-ink)' }}>{stats.cvr}</div>
          </div>

          {/* 기여 매출액 카드 */}
          <div className="detail-stat-card card-teal" style={{
            background: 'var(--colors-brand-teal)',
            borderLeft: '4px solid var(--colors-brand-mint)',
            padding: '10px 12px',
            borderRadius: 'var(--rounded-sm)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: '2px', textTransform: 'uppercase' }}>기여 매출액</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>₩{stats.revenue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역: 모바일 뷰어 및 클릭 히트맵 - 컴팩트화 및 높이 축소 */}
      <div className="detail-content-layout" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '20px',
        alignItems: 'start'
      }}>
        
        {/* 모바일 목업 실루엣 액자 안에 임베디드된 iframe */}
        <div className="heatmap-viewer-pane" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--colors-surface-soft)',
          padding: '16px',
          borderRadius: 'var(--rounded-lg)',
          border: '1px solid var(--colors-hairline)'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            alignSelf: 'flex-start',
            marginBottom: '10px',
            color: 'var(--colors-ink)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>📱</span> 실시간 모바일 클릭 히트맵 & 영역별 오버레이
          </h3>

          {/* 모바일 폰 3D 액자 프레임 - 세로 높이를 500px 수준으로 컴팩트하게 조정 */}
          <div className="phone-device-mockup" style={{
            width: '320px',
            height: '490px',
            background: '#0a0a0a',
            borderRadius: '32px',
            padding: '8px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
            border: '3px solid #3a3a3a',
            position: 'relative'
          }}>
            {/* 노치 및 스피커 */}
            <div className="phone-notch" style={{
              width: '110px',
              height: '18px',
              background: '#0a0a0a',
              borderRadius: '0 0 12px 12px',
              position: 'absolute',
              top: '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <div style={{ width: '30px', height: '3px', background: '#3a3a3a', borderRadius: '1.5px' }} />
            </div>

            {/* 실제 임베드된 iframe */}
            <div style={{
              width: '100%',
              height: '100%',
              background: '#ffffff',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {isLoadingHtml && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#faf5e8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                  gap: '8px'
                }}>
                  <div className="loading-spinner" style={{
                    width: '24px',
                    height: '24px',
                    border: '3px solid rgba(255, 77, 139, 0.2)',
                    borderTop: '3px solid var(--colors-brand-pink)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: '11px', color: 'var(--colors-muted)', fontWeight: '500' }}>LFmall 기획전 화면을 파싱하는 중...</span>
                </div>
              )}

              {errorMessage && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#faf5e8',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 6,
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '24px' }}>⚠️</div>
                  <span style={{ fontSize: '12px', color: '#ff6b5a', fontWeight: '500' }}>{errorMessage}</span>
                </div>
              )}

              <iframe
                ref={iframeRef}
                src={`/api/proxy-exhibition?id=${campaignId}`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block'
                }}
                onLoad={handleIframeLoad}
              />
            </div>
          </div>
        </div>

        {/* 우측 사이드바: 클릭 분석 통계 리스트 - 컴팩트화 및 폰 높이와 조화롭게 매칭 */}
        <div className="clicks-ranking-pane" style={{
          background: 'var(--colors-surface-card)',
          padding: '16px 20px',
          borderRadius: 'var(--rounded-lg)',
          border: '1px solid var(--colors-hairline)',
          maxHeight: '522px',
          overflowY: 'auto'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            marginBottom: '8px',
            color: 'var(--colors-ink)'
          }}>가장 활발한 클릭 영역 순위</h3>
          
          <p style={{ fontSize: '12px', color: 'var(--colors-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
            실제로 기획전 내에서 탭/클릭한 주요 배너 및 텍스트 요소들의 HTML 클래스명 순위입니다.
          </p>

          {clickStats.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 10px',
              border: '1px dashed var(--colors-muted-soft)',
              borderRadius: 'var(--rounded-md)',
              color: 'var(--colors-muted)',
              fontSize: '12px'
            }}>
              수집된 실시간 영역 클릭 이력이 아직 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clickStats.slice(0, 10).map((item, idx) => (
                <div key={idx} style={{
                  background: 'var(--colors-surface-soft)',
                  padding: '8px 12px',
                  borderRadius: 'var(--rounded-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--colors-hairline)',
                  transition: 'transform 0.2s ease'
                }}>
                  <div style={{ overflow: 'hidden', marginRight: '8px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--colors-brand-pink)', fontWeight: '700', marginBottom: '1px' }}>RANK #{idx + 1}</div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--colors-body-strong)',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }} title={item.elementClass}>
                      .{item.elementClass}
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--colors-brand-pink)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 'var(--rounded-pill)',
                    fontSize: '11px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    🔥 {item.clickCount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// 전역 스코프에 바인딩하여 index.html에서 읽어 쓸 수 있도록 노출
window.CampaignDetail = CampaignDetail;
