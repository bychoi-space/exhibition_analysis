const https = require('https');

/**
 * LFmall 기획전 HTML 페이지를 Fetch하고 절대 경로 리소스로 변환하여 반환
 * @param {string} exhibitionId 
 * @returns {Promise<string>}
 */
function fetchAndCleanExhibition(exhibitionId) {
  return new Promise((resolve, reject) => {
    // www.lfmall.co.kr 모바일/데스크톱 라우트
    const url = `https://www.lfmall.co.kr/app/event/${exhibitionId}`;
    
    // 모바일 뷰포트용 User-Agent 설정
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    };

    const req = https.get(url, options, (res) => {
      // 리다이렉트 처리 (301, 302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          redirectUrl = `https://www.lfmall.co.kr${redirectUrl}`;
        }
        // 리다이렉트된 URL에서 ID 파싱하여 다시 가져오거나 해당 주소 다이렉트 패치
        // 여기서는 동일 로직으로 재귀적 Fetch 가능
        resolve(fetchAndCleanExhibitionByUrl(redirectUrl));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to load LFmall page. Status: ${res.statusCode}`));
        return;
      }

      // 응답을 utf8 문자열로 수집
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const cleanedHtml = cleanExhibitionHtml(rawData);
          resolve(cleanedHtml);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to LFmall timed out (8s)'));
    });
  });
}

/**
 * 특정 URL을 직접 Fetch하여 HTML을 정제
 */
function fetchAndCleanExhibitionByUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
      },
      timeout: 8000
    };

    const req = https.get(targetUrl, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Redirect failed to load. Status: ${res.statusCode}`));
        return;
      }
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        resolve(cleanExhibitionHtml(rawData));
      });
    });
    req.on('error', reject);
  });
}

/**
 * 상대경로 리소스를 절대경로로 파싱하고 보안 요소를 제거하는 클리너 함수
 * @param {string} html 
 */
function cleanExhibitionHtml(html) {
  if (!html) return '';

  let cleaned = html;

  // 0. LFmall 내부 React가 nxapi.lfmall.co.kr로 비동기 호출 시 CORS 에러로 크래시나는 현상 방지용 Mock API 주입
  const mockScript = `
  <script>
    (function() {
      // 1. fetch API 모킹
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : (input?.url || '');
        if (url.includes('nxapi.lfmall.co.kr')) {
          console.log('[TELEMETRY-API-MOCK] Bypassed real network call and mocked response for:', url);
          return Promise.resolve(new Response(JSON.stringify({
            result: { token: 'mock-token', session: null, status: '200' },
            code: '200',
            message: 'SUCCESS'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          }));
        }
        return originalFetch.apply(this, arguments);
      };

      // 2. XMLHttpRequest API 모킹
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes('nxapi.lfmall.co.kr')) {
          this.isMocked = true;
          this.mockedUrl = url;
        }
        return originalOpen.apply(this, arguments);
      };
      
      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        if (this.isMocked) {
          console.log('[TELEMETRY-API-MOCK] Bypassed XMLHttpRequest for:', this.mockedUrl);
          Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
          Object.defineProperty(this, 'status', { writable: true, value: 200 });
          Object.defineProperty(this, 'responseText', { 
            writable: true, 
            value: JSON.stringify({ result: {}, code: '200', message: 'SUCCESS' }) 
          });
          setTimeout(() => {
            if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
            if (typeof this.onload === 'function') this.onload();
          }, 20);
          return;
        }
        return originalSend.apply(this, arguments);
      };
    })();
  </script>
  `;

  // <head> 태그 최상단에 주입
  cleaned = cleaned.replace(/<head>/i, '<head>' + mockScript);

  // 1. 상대경로 src/href를 LFmall 절대경로로 치환
  // src="/app/..." or href="/app/..."
  cleaned = cleaned.replace(/(src|href)\s*=\s*"\s*\/([^"\/][^"]*)"/gi, '$1="https://www.lfmall.co.kr/$2"');
  cleaned = cleaned.replace(/(src|href)\s*=\s*'\s*\/([^'\/][^']*)'/gi, "$1='https://www.lfmall.co.kr/$2'");

  // 2. 스킴 없는 더블 슬래시 경로(//) 치환
  // src="//cdn..." or href="//cdn..."
  cleaned = cleaned.replace(/(src|href)\s*=\s*"\s*\/\/([^"]*)"/gi, '$1="https://$2"');
  cleaned = cleaned.replace(/(src|href)\s*=\s*'\s*\/\/([^']*)'/gi, "$1='https://$2'");

  // 3. CSS 내부의 url('/...') 또는 url(/...) 치환
  cleaned = cleaned.replace(/url\(\s*["']?\s*\/([^'"\/][^'")\s]*)\s*["']?\s*\)/gi, "url('https://www.lfmall.co.kr/$1')");

  // 4. 모바일 화면에서 화면 이동을 원활하게 돕기 위해 클릭 가능한 앵커(a태그)들이 
  // 기획전을 완전히 벗어나지 않도록 하되, 클릭 오버레이가 정상 감지될 수 있게
  // a 태그들의 기본 target을 _blank로 바꾸거나, 또는 iframe 내부 액션을 제어할 수 있게 함
  // 여기서는 target을 기본적으로 제거하거나 오버레이 조작 가능하도록 유지

  // 5. 프록시 페이지 내에 CSP(Content-Security-Policy) 메타 태그가 있다면 제거하여 혼선 예방
  cleaned = cleaned.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  return cleaned;
}

module.exports = {
  fetchAndCleanExhibition
};
