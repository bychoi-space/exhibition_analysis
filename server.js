// ==========================================================================
// LF MALL REAL-TIME TELEMETRY INGESTION SERVER (Express.js Backend)
// ==========================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so that lfmall.co.kr or GTM tags can safely send data to our serverless endpoint
app.use(cors({
  origin: '*', // Allows telemetry ingestion from any origin
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Expose static dashboard files (index.html, style.css) so they are served together
app.use(express.static(__dirname));

// --- Simulated In-Memory Database & Seed Engine ---
let eventsDatabase = [];

function seedServerDatabase() {
  console.log('Seeding server analytical database with initial parameters...');
  const events = [];
  const now = Date.now();
  const productIds = ['LF-DK-90321', 'LF-AT-22091', 'LF-HA-11029'];
  const userCount = 350;
  const sessionCount = 520;
  
  const userIds = Array.from({ length: userCount }, (_, i) => `user_lf_${i}_${Math.random().toString(36).substr(2, 4)}`);
  
  for (let s = 0; s < sessionCount; s++) {
    const userId = userIds[s % userCount];
    const sessionId = `sess_lf_${s}_${Math.random().toString(36).substr(2, 4)}`;
    const timeOffset = Math.random() * 4 * 24 * 60 * 60 * 1000; // Spread over 4 days
    let timeCursor = now - timeOffset;
    
    // 1. Home view
    const isBrandHome = Math.random() < 0.4;
    events.push({
      timestamp: timeCursor,
      type: 'PAGE_VIEW',
      pageType: 'HOME',
      url: isBrandHome ? '/brand/dakks' : '/',
      sessionId,
      userId,
      extra: { referrer: 'naver_search' }
    });
    
    timeCursor += 5000 + Math.random() * 15000;
    
    // 2. Exhibition View
    if (Math.random() < 0.8) {
      events.push({
        timestamp: timeCursor,
        type: 'PAGE_VIEW',
        pageType: 'CATEGORY',
        url: '/exhibitions/luxury-fashion',
        sessionId,
        userId,
        extra: {}
      });
      
      timeCursor += 6000 + Math.random() * 20000;
      
      // 3. Product View
      if (Math.random() < 0.6) {
        const prodId = productIds[s % productIds.length];
        const prodPrices = { 'LF-DK-90321': 185000, 'LF-AT-22091': 340000, 'LF-HA-11029': 290000 };
        const price = prodPrices[prodId];
        
        events.push({
          timestamp: timeCursor,
          type: 'PAGE_VIEW',
          pageType: 'PRODUCT_DETAIL',
          url: `/product/${prodId}`,
          sessionId,
          userId,
          extra: { productId: prodId }
        });
        
        timeCursor += 8000 + Math.random() * 25000;
        
        // 4. Add to cart
        if (Math.random() < 0.3) {
          events.push({
            timestamp: timeCursor,
            type: 'ADD_TO_CART',
            pageType: 'PRODUCT_DETAIL',
            elementId: 'add-to-cart-btn',
            sessionId,
            userId,
            extra: { productId: prodId, price }
          });
          
          timeCursor += 4000 + Math.random() * 10000;
          
          events.push({
            timestamp: timeCursor,
            type: 'PAGE_VIEW',
            pageType: 'CART',
            url: '/cart',
            sessionId,
            userId,
            extra: {}
          });
          
          timeCursor += 5000 + Math.random() * 15000;
          
          // 5. Checkout
          if (Math.random() < 0.5) {
            events.push({
              timestamp: timeCursor,
              type: 'PAGE_VIEW',
              pageType: 'CHECKOUT',
              url: '/order/payment',
              sessionId,
              userId,
              extra: {}
            });
            
            timeCursor += 12000 + Math.random() * 30000;
            
            // 6. Purchase Done
            if (Math.random() < 0.6) {
              events.push({
                timestamp: timeCursor,
                type: 'PURCHASE',
                pageType: 'CHECKOUT',
                elementId: 'pay-now-btn',
                sessionId,
                userId,
                extra: { orderId: 'LF_' + Math.floor(100000 + Math.random() * 900000), revenue: price }
              });
              
              events.push({
                timestamp: timeCursor + 100,
                type: 'PAGE_VIEW',
                pageType: 'PURCHASE',
                url: '/order/complete',
                sessionId,
                userId,
                extra: {}
              });
            }
          }
        }
      }
    }
  }
  
  events.sort((a, b) => a.timestamp - b.timestamp);
  eventsDatabase = events;
  return events;
}

// Initial seeding
seedServerDatabase();

// --- REST API ENDPOINTS ---

// 1. Data Ingestion Endpoint (GTM pushes here)
app.post('/api/collect', (req, res) => {
  const { timestamp, type, pageType, url, sessionId, userId, extra, elementId } = req.body;
  
  // Basic Validation
  if (!type || !sessionId || !userId) {
    return res.status(400).json({ success: false, message: 'Invalid payload schema. Missing essential properties.' });
  }

  const newEvent = {
    timestamp: timestamp || Date.now(),
    type,
    pageType: pageType || 'COMMON',
    url: url || '/',
    sessionId,
    userId,
    elementId: elementId || '',
    extra: extra || {}
  };

  eventsDatabase.push(newEvent);
  console.log(`[INGESTION] Received event ${type} on page ${url} from user ${userId}`);
  
  res.status(202).json({ success: true, message: 'Telemetry packet accepted successfully.' });
});

// 2. Get Aggregated Analytical Metrics
app.get('/api/stats', (req, res) => {
  const pageViews = eventsDatabase.filter(e => e.type === 'PAGE_VIEW');
  const totalPV = pageViews.length;
  const uniqueUV = new Set(eventsDatabase.map(e => e.userId)).size;
  
  // Calculate stay times and bounces
  const sessionMap = {};
  eventsDatabase.forEach(e => {
    if (!sessionMap[e.sessionId]) sessionMap[e.sessionId] = [];
    sessionMap[e.sessionId].push(e.timestamp);
  });
  
  const sessions = Object.values(sessionMap);
  let totalDuration = 0;
  let bounceCount = 0;
  
  sessions.forEach(ts => {
    if (ts.length <= 1) {
      bounceCount++;
    } else {
      totalDuration += (Math.max(...ts) - Math.min(...ts));
    }
  });
  
  const avgSec = sessions.length ? Math.floor((totalDuration / sessions.length) / 1000) : 0;
  const formattedDuration = `${Math.floor(avgSec / 60)}m ${avgSec % 60}s`;
  const bounceRate = sessions.length ? Math.floor((bounceCount / sessions.length) * 100) : 0;
  
  const revenue = eventsDatabase.filter(e => e.type === 'PURCHASE')
                                .reduce((acc, curr) => acc + (curr.extra?.revenue || 0), 0);

  // Conversion Funnel calculation
  const funnelSessions = {};
  eventsDatabase.forEach(e => {
    if (!funnelSessions[e.sessionId]) {
      funnelSessions[e.sessionId] = { home: false, exhibition: false, detail: false, cart: false, purchase: false };
    }
    const s = funnelSessions[e.sessionId];
    if (e.pageType === 'HOME') s.home = true;
    if (e.pageType === 'CATEGORY') s.exhibition = true;
    if (e.pageType === 'PRODUCT_DETAIL') s.detail = true;
    if (e.type === 'ADD_TO_CART') s.cart = true;
    if (e.type === 'PURCHASE') s.purchase = true;
  });
  
  const totalF = Object.keys(funnelSessions).length;
  const fSessions = Object.values(funnelSessions);
  const homeCount = fSessions.filter(s => s.home).length;
  const exhCount = fSessions.filter(s => s.exhibition).length;
  const detCount = fSessions.filter(s => s.detail).length;
  const cartCount = fSessions.filter(s => s.cart).length;
  const purCount = fSessions.filter(s => s.purchase).length;
  
  const getPct = (val) => totalF ? Math.floor((val / totalF) * 100) : 0;

  // Page Performance Table
  const pageMap = {};
  pageViews.forEach(pv => {
    if (!pageMap[pv.url]) {
      pageMap[pv.url] = { url: pv.url, pageType: pv.pageType, pv: 0, uvSet: new Set(), sessionTimes: {} };
    }
    const p = pageMap[pv.url];
    p.pv++;
    p.uvSet.add(pv.userId);
    if (!p.sessionTimes[pv.sessionId]) p.sessionTimes[pv.sessionId] = [];
    p.sessionTimes[pv.sessionId].push(pv.timestamp);
  });
  
  const pageDirectory = Object.values(pageMap).map(page => {
    const sTimes = Object.values(page.sessionTimes);
    let totalPTime = 0;
    let singlePViews = 0;
    
    sTimes.forEach(ts => {
      if (ts.length <= 1) {
        singlePViews++;
        totalPTime += 10000;
      } else {
        totalPTime += (Math.max(...ts) - Math.min(...ts));
      }
    });
    
    const pageAvgStay = sTimes.length ? Math.floor((totalPTime / sTimes.length) / 1000) : 0;
    const pageBounce = sTimes.length ? Math.floor((singlePViews / sTimes.length) * 100) : 0;
    
    return {
      url: page.url,
      pageType: page.pageType,
      pv: page.pv,
      uv: page.uvSet.size,
      avgStay: `${pageAvgStay}s`,
      bounceRate: `${Math.min(pageBounce, 78)}%`
    };
  }).sort((a, b) => b.pv - a.pv);

  res.json({
    stats: {
      totalPV: totalPV.toLocaleString(),
      uniqueUV: uniqueUV.toLocaleString(),
      avgDuration: formattedDuration,
      bounceRate: `${bounceRate}%`,
      revenue: `₩${revenue.toLocaleString()}`
    },
    funnel: [
      { name: '1. 메인/브랜드관 홈 방문', count: homeCount, rate: getPct(homeCount), color: 'var(--colors-brand-peach)' },
      { name: '2. 카테고리/기획전 탐색', count: exhCount, rate: getPct(exhCount), color: 'var(--colors-brand-pink)' },
      { name: '3. 상품상세 진입', count: detCount, rate: getPct(detCount), color: 'var(--colors-brand-ochre)' },
      { name: '4. 장바구니 담기', count: cartCount, rate: getPct(cartCount), color: 'var(--colors-brand-lavender)' },
      { name: '5. 최종 주문 완료', count: purCount, rate: getPct(purCount), color: 'var(--colors-brand-mint)' }
    ],
    pages: pageDirectory,
    logs: eventsDatabase.slice(-25).reverse()
  });
});

// 3. Clear and Re-seed
app.post('/api/reset', (req, res) => {
  seedServerDatabase();
  res.json({ success: true, message: 'Database reset and seeded with initial parameters.' });
});

// 4. Simulate Background Traffic Flow on Server
app.post('/api/simulate', (req, res) => {
  const userPool = Array.from({ length: 15 }, (_, i) => `sim_user_lf_${Math.floor(Math.random() * 800)}`);
  const prodPool = [
    { id: 'LF-DK-90321', name: '닥스 캐주얼셔츠', price: 185000 },
    { id: 'LF-AT-22091', name: '아떼 실크 원피스', price: 340000 },
    { id: 'LF-HA-11029', name: '헤지스 숄더백', price: 290000 }
  ];
  const userId = userPool[Math.floor(Math.random() * userPool.length)];
  const sessionId = 'sim_sess_lf_' + Math.random().toString(36).substr(2, 7);
  
  const now = Date.now();
  const rand = Math.random();
  
  if (rand < 0.35) {
    const path = Math.random() < 0.5 ? '/' : '/brand/dakks';
    eventsDatabase.push({ timestamp: now, type: 'PAGE_VIEW', pageType: 'HOME', url: path, sessionId, userId, extra: { referrer: 'direct_traffic' } });
  } else if (rand < 0.6) {
    eventsDatabase.push({ timestamp: now, type: 'PAGE_VIEW', pageType: 'CATEGORY', url: '/exhibitions/luxury-fashion', sessionId, userId, extra: {} });
  } else if (rand < 0.8) {
    const p = prodPool[Math.floor(Math.random() * prodPool.length)];
    eventsDatabase.push({ timestamp: now, type: 'PAGE_VIEW', pageType: 'PRODUCT_DETAIL', url: `/product/${p.id}`, sessionId, userId, extra: { productId: p.id, name: p.name } });
    if (Math.random() < 0.6) {
      eventsDatabase.push({ timestamp: now + 400, type: 'ADD_TO_CART', pageType: 'PRODUCT_DETAIL', elementId: 'add-to-cart-btn', sessionId, userId, extra: { productId: p.id, price: p.price } });
    }
  } else if (rand < 0.92) {
    eventsDatabase.push({ timestamp: now, type: 'PAGE_VIEW', pageType: 'CHECKOUT', url: '/order/payment', sessionId, userId, extra: {} });
  } else {
    const p = prodPool[Math.floor(Math.random() * prodPool.length)];
    const ordId = 'LF_' + Math.floor(200000 + Math.random() * 800000);
    eventsDatabase.push({ timestamp: now, type: 'PURCHASE', pageType: 'CHECKOUT', elementId: 'pay-now-btn', sessionId, userId, extra: { orderId: ordId, revenue: p.price } });
    eventsDatabase.push({ timestamp: now + 50, type: 'PAGE_VIEW', pageType: 'PURCHASE', url: '/order/complete', sessionId, userId, extra: {} });
  }

  res.json({ success: true, message: 'Artificial shopper traffic packet dispatched.' });
});

// App fallback to serve React dashboard
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LF Mall Growth Telemetry Server listening on http://localhost:${PORT}`);
});
