const https = require('https');

/**
 * 5단계 깊이까지 자동으로 리다이렉션을 추적하는 고성능 Fetcher
 */
function fetchUrlWithRedirects(targetUrl, depth = 0) {
  if (depth > 5) {
    return Promise.reject(new Error('Too many redirects (max depth 5)'));
  }

  return new Promise((resolve, reject) => {
    // 모바일 뷰포트용 User-Agent 설정
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    };

    const req = https.get(targetUrl, options, (res) => {
      // 301, 302, 307, 308 리다이렉트 추적
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `https://www.lfmall.co.kr${redirectUrl}`;
        }
        console.log(`[PROXY-REDIRECT] Depth ${depth} -> Following 302 to: ${redirectUrl}`);
        resolve(fetchUrlWithRedirects(redirectUrl, depth + 1));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to load page. Status: ${res.statusCode} for URL: ${targetUrl}`));
        return;
      }

      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => resolve(rawData));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out (8s)'));
    });
  });
}

/**
 * LFmall 기획전 HTML 페이지를 Fetch하고 절대 경로 리소스로 변환하여 반환
 * @param {string} exhibitionId 
 * @returns {Promise<string>}
 */
function fetchAndCleanExhibition(exhibitionId) {
  // 원래 100% 정상 작동했던 /app/event/ 신규 기획전 URL 주소로 복원
  const startUrl = `https://www.lfmall.co.kr/app/event/${exhibitionId}`;
  
  return fetchUrlWithRedirects(startUrl)
    .then(rawHtml => {
      return cleanExhibitionHtml(rawHtml);
    });
}

// --- 기획전 타이틀 크롤링 중복 요청 방지용 인플라이트 맵 ---
const _titleCrawlInflight = {};

/**
 * [NEW] LFmall 기획전 페이지에서 진짜 기획전명을 직접 크롤링하여 반환하는 경량 함수.
 * GTM이 전송하는 exhibitionTitle은 SPA 레이스 컨디션으로 인해 신뢰할 수 없으므로,
 * 서버가 직접 원본 LFmall 페이지에 접속하여 <title> 및 <meta og:title>에서 정확한 명칭을 추출합니다.
 * 
 * 동일 exhibitionId에 대한 동시 다발 크롤링 요청은 인플라이트 디듀플리케이션으로 단일화됩니다.
 * 
 * @param {string} exhibitionId 
 * @returns {Promise<string|null>} 크롤링 성공 시 정제된 기획전명, 실패 시 null
 */
function fetchExhibitionTitle(exhibitionId) {
  // 이미 동일 ID에 대한 크롤링이 진행 중이면 기존 Promise를 재활용
  if (_titleCrawlInflight[exhibitionId]) {
    return _titleCrawlInflight[exhibitionId];
  }

  const crawlPromise = (async () => {
    try {
      const startUrl = `https://www.lfmall.co.kr/app/event/${exhibitionId}`;
      const rawHtml = await fetchUrlWithRedirects(startUrl);

      if (!rawHtml || typeof rawHtml !== 'string') return null;

      let extractedTitle = null;

      // 1순위: <meta property="og:title"> — SEO 전용이라 가장 안정적
      const ogMatch = rawHtml.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i)
                    || rawHtml.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:title["']/i);
      if (ogMatch && ogMatch[1]) {
        extractedTitle = ogMatch[1].trim();
      }

      // 2순위: <title> 태그
      if (!extractedTitle) {
        const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          extractedTitle = titleMatch[1].trim();
        }
      }

      if (!extractedTitle) return null;

      // LFmall 공통 접미사 정제 (예: " - LFmall", " | 엘에프몰", " : LF몰" 등)
      extractedTitle = extractedTitle
        .replace(/\s*[|:\-–—]\s*(LFmall|엘에프몰|LF몰|LFMALL|lf몰)\s*$/gi, '')
        .trim();

      // 크롤링 결과가 사이트 범용 타이틀이면 무효 처리
      const genericPatterns = [
        /^(LFmall|엘에프몰|LF몰|LFMALL)$/i,
        /나를 나답게/,
        /^홈$/i,
        /^home$/i,
        /^메인$/i,
        /^main$/i
      ];
      for (const pattern of genericPatterns) {
        if (pattern.test(extractedTitle)) return null;
      }

      // 비정상적으로 짧은 타이틀(2자 이하)은 무효 처리
      if (extractedTitle.length <= 2) return null;

      console.log(`[TITLE-CRAWL] ID ${exhibitionId} → 크롤링 성공: "${extractedTitle}"`);
      return extractedTitle;
    } catch (err) {
      console.warn(`[TITLE-CRAWL-ERROR] ID ${exhibitionId} 크롤링 실패: ${err.message}`);
      return null;
    } finally {
      // 크롤링 완료 후 인플라이트 맵에서 제거
      delete _titleCrawlInflight[exhibitionId];
    }
  })();

  _titleCrawlInflight[exhibitionId] = crawlPromise;
  return crawlPromise;
}

/**
 * 상대경로 리소스를 절대경로로 파싱하고 보안 요소를 제거하는 클리너 함수
 * @param {string} html 
 */
function cleanExhibitionHtml(html) {
  if (!html) return '';

  let cleaned = html;

  // [HYBRID-INJECTION] 글로벌 자바스크립트 오류 무력화 가드
  const securityScript = `
  <script>
    (function() {
      // 1. 글로벌 자바스크립트 에러 침묵 가드 (전체 앱 크래시 방지)
      window.onerror = function(message, source, lineno, colno, error) {
        console.warn('[SILENCED-JS-ERROR] Bypassed LFmall global script crash:', message);
        return true; // 에러 전파를 막아 빈 화면 정지 극복
      };
    })();
  </script>
  `;

  // <head> 태그 바로 뒤에 안전하게 글로벌 에러 실드 장착
  cleaned = cleaned.replace(/<head>/i, '<head>' + securityScript);

  // [CRITICAL-STEAL] nxapi.lfmall.co.kr 도메인 자체를 우리 백엔드 로컬 API 경로로 텍스트 치환하여
  // 자바스크립트가 브라우저 인증을 Same-Origin으로 태우고 CORS를 100% 무력화하도록 원천 탈취합니다.
  cleaned = cleaned.replace(/https:\/\/nxapi\.lfmall\.co\.kr/gi, '/api/mock-nxapi');

  // 1. 상대경로 src/href를 LFmall 절대경로로 치환
  cleaned = cleaned.replace(/(src|href)\s*=\s*"\s*\/([^"\/][^"]*)"/gi, '$1="https://www.lfmall.co.kr/$2"');
  cleaned = cleaned.replace(/(src|href)\s*=\s*'\s*\/([^'\/][^']*)'/gi, "$1='https://www.lfmall.co.kr/$2'");

  // 2. 스킴 없는 더블 슬래시 경로(//) 치환
  cleaned = cleaned.replace(/(src|href)\s*=\s*"\s*\/\/([^"]*)"/gi, '$1="https://$2"');
  cleaned = cleaned.replace(/(src|href)\s*=\s*'\s*\/\/([^']*)'/gi, "$1='https://$2'");

  // 3. CSS 내부의 url('/...') 또는 url(/...) 치환
  cleaned = cleaned.replace(/url\(\s*["']?\s*\/([^'"\/][^'")\s]*)\s*["']?\s*\)/gi, "url('https://www.lfmall.co.kr/$1')");

  // 4. 프록시 페이지 내에 CSP(Content-Security-Policy) 메타 태그가 있다면 제거하여 혼선 예방
  cleaned = cleaned.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  return cleaned;
}

module.exports = {
  fetchAndCleanExhibition,
  fetchExhibitionTitle
};

