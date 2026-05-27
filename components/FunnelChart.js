// ==========================================================================
// FunnelChart.js: Custom SVG Funnel Visualization Component
// ==========================================================================

const FunnelChart = ({ displayFunnel, viewMode }) => {
  return (
    <div className="chart-card" style={{ marginBottom: 'var(--spacing-md)' }}>
      <div>
        <h3 className="title-md">
          {viewMode === 'average' ? 'LF Mall 일 평균 퍼널 전환율 분석' : 'LF Mall 퍼널 전환율 분석 (Conversion Funnel)'}
        </h3>
        <p className="body-sm" style={{color: 'var(--colors-muted)'}}>
          {viewMode === 'average' ? '고객 여정별 각 단계의 일 평균 인입 인원을 시각화합니다.' : '고객 여정의 메인 홈 진입부터 최종 주문 결제 완료까지의 퍼널 전환율을 시각화합니다.'}
        </p>
      </div>
      <div className="svg-funnel-container" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <svg viewBox="0 0 500 220" width="100%" height="100%">
          {displayFunnel.map((step, idx) => {
            const maxBarWidth = 310;
            const barWidth = Math.max((step.rate / 100) * maxBarWidth, 20);
            const barHeight = 24;
            const xStart = 150;
            const yStart = idx * 42 + 10;
            const barColor = step.color;
            return (
              <g key={step.name}>
                <text x="10" y={yStart + 16} fill="var(--colors-ink)" fontSize="11" fontWeight="600">
                  {step.name}
                </text>
                <rect x={xStart} y={yStart} width={maxBarWidth} height={barHeight} fill="var(--colors-surface-soft)" rx="6" />
                <rect x={xStart} y={yStart} width={barWidth} height={barHeight} fill={barColor} rx="6" style={{ transition: 'width 0.5s ease-out' }} />
                <text x={xStart + Math.max(barWidth - 40, 10)} y={yStart + 16} fill={idx === 1 || idx === 4 ? '#ffffff' : 'var(--colors-ink)'} fontSize="11" fontWeight="700">
                  {step.rate}%
                </text>
                <text x={xStart + maxBarWidth + 10} y={yStart + 16} fill="var(--colors-muted)" fontSize="12" fontWeight="500">
                  {step.count.toLocaleString()} 명{viewMode === 'average' ? ' / 일' : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

window.FunnelChart = FunnelChart;
