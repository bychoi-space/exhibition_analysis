/**
 * Campaign Title Resolver (Core Telemetry Domain Module) — v2 (Server-Side Crawling Edition)
 * 
 * [아키텍처 변경] GTM이 전송하는 exhibitionTitle은 SPA 레이스 컨디션으로 인해
 * 상품명, 쇼핑백, 마이페이지, 다른 기획전명 등 다양한 형태의 오염이 발생합니다.
 * 
 * v2에서는 서버가 LFmall 원본 페이지를 직접 크롤링한 타이틀을 최상위 신뢰 소스로 사용하며,
 * GTM 타이틀은 크롤링이 아직 완료되지 않았거나 실패한 경우에만 임시 폴백으로 참조합니다.
 * 
 * 우선순위 모델:
 * 1. crawled=true인 타이틀 → 영구 락 (절대 덮어쓰지 않음)
 * 2. 크롤링 미완료 상태에서 GTM 유효 타이틀 → 임시 저장 (크롤링 완료 시 덮어쓸 수 있음)
 * 3. 플레이스홀더 ('기획전 캠페인') → 아직 어떤 소스에서도 유효한 타이틀을 수신하지 못한 상태
 */

const isGenericOrCorrupted = (title) => {
  if (!title || typeof title !== 'string') return true;
  const t = title.trim();
  return t === '' || 
         t === '기획전 캠페인' ||
         t.includes('나를 나답게') || 
         t.includes('LFmall.com') || 
         t === 'LFmall' || 
         t === '엘에프몰' || 
         /^(LFmall|엘에프몰|LF몰|LFMALL|home|홈|main|메인)$/i.test(t);
};

/**
 * [v2] 크롤링된 타이틀을 기존 메타데이터에 반영하는 전용 리졸버.
 * 크롤링된 타이틀은 최상위 신뢰 소스이므로, 기존 타이틀이 무엇이든 덮어씁니다.
 * 단, 이미 crawled=true인 타이틀이 존재하면 다시 덮어쓰지 않습니다(멱등성 보장).
 * 
 * @param {object|null} existingMeta - 기존 메타데이터 { title, brand, crawled }
 * @param {string} crawledTitle - 서버 크롤링으로 확보한 진짜 기획전명
 * @returns {{ title: string, brand: string, crawled: boolean, shouldUpdate: boolean }}
 */
const resolveCrawledTitle = (existingMeta, crawledTitle) => {
  // 이미 크롤링된 타이틀이 확정되어 있으면 멱등 처리
  if (existingMeta && existingMeta.crawled) {
    return {
      title: existingMeta.title,
      brand: existingMeta.brand || 'LF MALL',
      crawled: true,
      shouldUpdate: false
    };
  }

  // 크롤링 결과가 유효하지 않으면 기존 상태 유지
  if (!crawledTitle || isGenericOrCorrupted(crawledTitle)) {
    const fallbackTitle = existingMeta ? existingMeta.title : '기획전 캠페인';
    return {
      title: fallbackTitle,
      brand: existingMeta?.brand || 'LF MALL',
      crawled: false,
      shouldUpdate: false
    };
  }

  // 크롤링 타이틀로 확정 및 영구 락
  const brandMatch = crawledTitle.match(/\(([^)]+)\)/);
  const brand = brandMatch ? brandMatch[1] : 'LF MALL';

  return {
    title: crawledTitle.trim(),
    brand,
    crawled: true,
    shouldUpdate: true
  };
};

/**
 * [v2] GTM이 전송한 타이틀을 사용한 폴백 리졸버.
 * 크롤링이 아직 완료되지 않은 경우에만 사용됩니다.
 * crawled=true인 타이틀이 이미 있으면 어떤 GTM 데이터도 무시합니다.
 * 
 * @param {object|null} existingMeta - 기존 메타데이터 { title, brand, crawled }
 * @param {string} incomingTitle - GTM이 전송한 exhibitionTitle
 * @returns {{ title: string, brand: string, crawled: boolean, shouldUpdate: boolean }}
 */
const resolveExhibitionTitle = (existingMeta, incomingTitle) => {
  // 크롤링 확정 타이틀이 있으면 GTM 데이터를 완전 무시 (핵심 방어선)
  if (existingMeta && existingMeta.crawled) {
    return {
      title: existingMeta.title,
      brand: existingMeta.brand || 'LF MALL',
      crawled: true,
      shouldUpdate: false
    };
  }

  const existingTitle = existingMeta ? existingMeta.title : null;
  const isExistingValid = existingTitle && !isGenericOrCorrupted(existingTitle);

  // 기존 유효 타이틀이 있으면 유지 (크롤링 완료 전까지의 임시 락)
  if (isExistingValid) {
    return {
      title: existingTitle,
      brand: existingMeta?.brand || 'LF MALL',
      crawled: false,
      shouldUpdate: false
    };
  }

  // GTM 타이틀이 유효한지 확인
  const isIncomingValid = incomingTitle && !isGenericOrCorrupted(incomingTitle);

  if (isIncomingValid) {
    const brandMatch = incomingTitle.match(/\(([^)]+)\)/);
    const brand = brandMatch ? brandMatch[1] : 'LF MALL';
    return {
      title: incomingTitle.trim(),
      brand,
      crawled: false,  // GTM 소스이므로 crawled=false
      shouldUpdate: true
    };
  }

  // 모든 소스가 무효 → 플레이스홀더 유지
  const fallbackTitle = existingTitle || '기획전 캠페인';
  const shouldUpdate = !existingTitle;

  return {
    title: fallbackTitle,
    brand: existingMeta?.brand || 'LF MALL',
    crawled: false,
    shouldUpdate
  };
};

module.exports = {
  isGenericOrCorrupted,
  resolveExhibitionTitle,
  resolveCrawledTitle
};
