/**
 * Campaign Attribution Resolver (Core Telemetry Domain Module)
 * Governs E-Commerce attribution using a robust 7-day Time-Window Lookup model.
 * 
 * ─── GTM 태그 스크립트 기반 매칭 전략 (2단계 어트리뷰션) ───
 * 
 * [전략 1] 상품 레벨 정밀 매칭 (Product-Level Precision Match)
 *   - PURCHASE 이벤트의 productId와 동일한 상품을 기획전 컨텍스트에서 조회한 이력 탐색
 *   - 조건: 동일 userId, 동일 productId, 7일 이내, exhibitionId 보유 PAGE_VIEW
 * 
 * [전략 2] 기획전 터치포인트 매칭 (Exhibition Touchpoint Fallback)
 *   - 상품 매칭 실패 시(productId 누락 등), 동일 유저가 최근 7일 이내에 방문한
 *     기획전 이력(exhibitionId 보유 PAGE_VIEW)을 역추적하여 Last-Touch 귀속
 *   - 유저가 기획전을 통해 상품을 탐색한 뒤 구매까지 전환된 것으로 간주
 * 
 * ─── GTM 태그 기준 pageType 매핑 참조 ───
 *   - HOME:           / (루트)
 *   - CATEGORY:       /exhibitions/*, /planning.do?datacls=*, /app/event/*  (기획전 페이지)
 *   - PRODUCT_DETAIL: /product/*  (상품 상세)
 *   - CART:           /cart
 *   - CHECKOUT:       /order/payment
 *   - PURCHASE:       /order/complete  (주문완료)
 *   - COMMON:         기타 모든 페이지
 * 
 * ─── 핵심 참고 사항 ───
 *   - GTM은 exhibitionId를 CATEGORY(기획전) 페이지에서만 추출하여 전송
 *   - PRODUCT_DETAIL, CART, CHECKOUT, PURCHASE 페이지에서는 exhibitionId가 빈 값
 *   - 따라서 기획전 → 상품 → 구매 흐름에서 exhibitionId를 이어받으려면
 *     반드시 이벤트 로그 이력 역추적(Retroactive Lookup)이 필요
 */

// Helper: 다양한 LFmall URL 패턴에서 productId 추출
const extractProductId = (urlPath) => {
  if (!urlPath || typeof urlPath !== 'string') return null;
  
  // Pattern 1: /product/<id> (LFmall 표준 상품 상세 경로)
  const matchA = urlPath.match(/\/product\/([a-zA-Z0-9_-]+)/);
  if (matchA) return matchA[1];

  // Pattern 2: /product/detail/<id> (LFmall 대안 상품 상세 경로)
  const matchB = urlPath.match(/\/product\/detail\/([a-zA-Z0-9_-]+)/);
  if (matchB) return matchB[1];
  
  // Pattern 3: Query string 기반 productId, item_id, goodsNo
  const matchC = urlPath.match(/[?&](?:productId|item_id|goodsNo)=([a-zA-Z0-9_-]+)/);
  if (matchC) return matchC[1];
  
  return null;
};

const findAttributedExhibition = (recentLogs, userId, incomingProductId, incomingUrl, purchaseTimestamp) => {
  if (!userId) return null;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const targetProductId = incomingProductId || extractProductId(incomingUrl);

  // 로그를 시간순 내림차순 정렬 (최신 이벤트부터 역추적)
  const sortedLogs = [...recentLogs].sort((a, b) => b.timestamp - a.timestamp);

  // ─── 전략 1: 상품 레벨 정밀 매칭 (Product-Level Precision Match) ───
  // PURCHASE의 productId와 동일한 상품을 기획전 컨텍스트 하에서 조회한 이력 탐색
  if (targetProductId) {
    for (const log of sortedLogs) {
      const timeDiff = purchaseTimestamp - log.timestamp;
      if (timeDiff > SEVEN_DAYS_MS) break;   // 7일 초과 → 탐색 중단
      if (timeDiff < 0) continue;             // 미래 이벤트 → 스킵
      if (log.userId !== userId) continue;    // 다른 유저 → 스킵
      if (log.type !== 'PAGE_VIEW') continue; // 페이지뷰만 대상

      // 상품 ID 매칭 (extra.productId 우선, URL 폴백)
      const logProductId = log.extra?.productId || extractProductId(log.url);
      // 이 로그에 기획전 컨텍스트(exhibitionId)가 있는지 확인
      const logExhibitionId = log.extra?.exhibitionId;

      if (logProductId === targetProductId && logExhibitionId) {
        console.log(`[ATTRIBUTION-MATCH-L1] User ${userId} purchased ${targetProductId}. ` +
          `Product-level match found in Exhibition ${logExhibitionId} ` +
          `(${Math.round(timeDiff / (1000 * 60))} mins ago)`);
        return logExhibitionId;
      }
    }
  }

  // ─── 전략 2: 기획전 터치포인트 매칭 (Exhibition Touchpoint Fallback) ───
  // 상품 매칭 실패 시, 동일 유저의 최근 기획전 방문 이력에서 Last-Touch Exhibition 귀속
  // GTM 기준: 기획전 페이지(CATEGORY)에서만 exhibitionId가 전송되므로,
  // 이 전략은 "유저가 기획전 페이지를 방문한 적이 있는가?"를 역추적
  for (const log of sortedLogs) {
    const timeDiff = purchaseTimestamp - log.timestamp;
    if (timeDiff > SEVEN_DAYS_MS) break;
    if (timeDiff < 0) continue;
    if (log.userId !== userId) continue;
    if (log.type !== 'PAGE_VIEW') continue;

    const logExhibitionId = log.extra?.exhibitionId;
    if (logExhibitionId) {
      console.log(`[ATTRIBUTION-MATCH-L2] User ${userId} purchased. ` +
        `Last-Touch Exhibition Touchpoint: ${logExhibitionId} ` +
        `(${Math.round(timeDiff / (1000 * 60))} mins ago)`);
      return logExhibitionId;
    }
  }

  return null;
};

module.exports = {
  extractProductId,
  findAttributedExhibition
};
