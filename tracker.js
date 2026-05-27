// ==========================================================================
// CLAY ANALYTICS - WEB SDK & MOCK DATABASE ENGINE
// ==========================================================================

const STORAGE_KEY = 'clay_analytics_events';
const SESSION_KEY = 'clay_analytics_session';
const USER_KEY = 'clay_analytics_user';

// --- Session & Identity Setup ---
function getOrGenerateId(key) {
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'id_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

export const getUserId = () => getOrGenerateId(USER_KEY);

export const getSessionId = () => {
  let session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    session = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, session);
  }
  return session;
};

// --- Raw Database Read/Write ---
export const getRawEvents = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse logs', e);
    return [];
  }
};

const saveEvents = (events) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  // Dispatch custom event so React components can update in real-time
  window.dispatchEvent(new CustomEvent('clay_analytics_update'));
};

// --- Seed Database with Realistic Historical Traffic (For WOW factor!) ---
function seedDatabase() {
  console.log('Seeding analytics database with realistic historical logs...');
  const events = [];
  const now = Date.now();
  
  // Seed configurations (approx. 5 days of data)
  const pageTypes = ['HOME', 'CATEGORY', 'PRODUCT_DETAIL', 'CART', 'CHECKOUT', 'PURCHASE'];
  const productIds = ['gadget-1', 'gadget-2', 'gadget-3', 'gadget-4'];
  const userCount = 420;
  const sessionCount = 650;
  
  // Create user IDs
  const userIds = Array.from({ length: userCount }, (_, i) => `user_seed_${i}_${Math.random().toString(36).substr(2, 5)}`);
  
  // Create sessions and walk them through the conversion funnel with realistic dropoffs
  for (let s = 0; s < sessionCount; s++) {
    const userId = userIds[s % userCount];
    const sessionId = `sess_seed_${s}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Time offset (spaced over last 5 days)
    const timeOffset = Math.random() * 5 * 24 * 60 * 60 * 1000;
    const sessionStartTime = now - timeOffset;
    
    let timeCursor = sessionStartTime;
    
    // Step 1: Home page view (100% of sessions)
    events.push({
      timestamp: timeCursor,
      type: 'PAGE_VIEW',
      pageType: 'HOME',
      url: '/home',
      sessionId,
      userId,
      extra: { referrer: 'direct' }
    });
    
    timeCursor += 5000 + Math.random() * 20000; // Users stay 5-25s
    
    // Step 2: Category page view (80% chance)
    if (Math.random() < 0.8) {
      events.push({
        timestamp: timeCursor,
        type: 'PAGE_VIEW',
        pageType: 'CATEGORY',
        url: '/category',
        sessionId,
        userId,
        extra: {}
      });
      
      timeCursor += 8000 + Math.random() * 30000;
      
      // Step 3: Product Detail view (60% chance from category)
      if (Math.random() < 0.65) {
        const prodId = productIds[Math.floor(Math.random() * productIds.length)];
        events.push({
          timestamp: timeCursor,
          type: 'PAGE_VIEW',
          pageType: 'PRODUCT_DETAIL',
          url: `/product/${prodId}`,
          sessionId,
          userId,
          extra: { productId: prodId }
        });
        
        events.push({
          timestamp: timeCursor + 2000,
          type: 'CLICK',
          pageType: 'PRODUCT_DETAIL',
          elementId: 'view-specifications-btn',
          sessionId,
          userId
        });
        
        timeCursor += 10000 + Math.random() * 45000;
        
        // Step 4: Add to Cart (35% chance)
        if (Math.random() < 0.35) {
          events.push({
            timestamp: timeCursor,
            type: 'ADD_TO_CART',
            pageType: 'PRODUCT_DETAIL',
            elementId: 'add-to-cart-btn',
            sessionId,
            userId,
            extra: { productId: prodId, price: 150 + Math.floor(Math.random() * 200) }
          });
          
          timeCursor += 4000 + Math.random() * 10000;
          
          // Visit Cart Page
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
          
          // Step 5: Checkout Page (50% chance from Cart)
          if (Math.random() < 0.5) {
            events.push({
              timestamp: timeCursor,
              type: 'PAGE_VIEW',
              pageType: 'CHECKOUT',
              url: '/checkout',
              sessionId,
              userId,
              extra: {}
            });
            
            timeCursor += 15000 + Math.random() * 40000;
            
            // Step 6: Purchase Done (60% chance from Checkout)
            if (Math.random() < 0.6) {
              events.push({
                timestamp: timeCursor,
                type: 'PURCHASE',
                pageType: 'CHECKOUT',
                elementId: 'pay-now-btn',
                sessionId,
                userId,
                extra: { orderId: 'ord_' + Math.random().toString(36).substr(2, 6), revenue: 200 + Math.floor(Math.random() * 300) }
              });
              
              events.push({
                timestamp: timeCursor + 100,
                type: 'PAGE_VIEW',
                pageType: 'PURCHASE',
                url: '/purchase-success',
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
  
  // Sort events chronologically
  events.sort((a, b) => a.timestamp - b.timestamp);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  return events;
}

// --- Tracking SDK Interface ---

// Helper: Extract exhibition ID from URL path or query parameters
function extractExhibitionId(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  
  // Pattern A: /app/event/103291
  const matchA = urlPath.match(/\/app\/event\/([a-zA-Z0-9_-]+)/);
  if (matchA) return matchA[1];
  
  // Pattern B: /planning.do?cmd=getEventDetail&datacls=992831
  const matchB = urlPath.match(/datacls=([a-zA-Z0-9_-]+)/);
  if (matchB) return matchB[1];
  
  return null;
}

// Helper: Safely stream telemetries to the live backend server
const sendToServer = (event) => {
  if (typeof fetch !== 'undefined') {
    fetch('/api/collect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }).catch(err => {
      console.warn('[TRACKER-WARNING] Telemetry live streaming failed. Operating in standalone mode.', err.message);
    });
  }
};

export const trackPageView = (pageType, url, extra = {}) => {
  const events = getRawEvents();
  
  // Extract and resolve exhibition ID & dynamic Title on client side
  let exhibitionId = extra.exhibitionId || extractExhibitionId(url);
  let exhibitionTitle = extra.exhibitionTitle;
  
  if (exhibitionId && !exhibitionTitle && typeof document !== 'undefined') {
    let pageTitle = document.title || '';
    // Clean up generic corporate suffixes (e.g., " | LFmall", " - 엘에프몰" etc.)
    exhibitionTitle = pageTitle
      .replace(/\s*[|:-]\s*(LFmall|엘에프몰|LF몰|LFMALL|lf몰)\s*$/gi, '')
      .trim();
      
    // Fallback search in meta tags if generic
    if (!exhibitionTitle || /^(LFmall|엘에프몰|LF몰|LFMALL)$/i.test(exhibitionTitle)) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) {
        exhibitionTitle = ogTitle.content
          .replace(/\s*[|:-]\s*(LFmall|엘에프몰|LF몰|LFMALL|lf몰)\s*$/gi, '')
          .trim();
      }
    }
  }

  const event = {
    timestamp: Date.now(),
    type: 'PAGE_VIEW',
    pageType,
    url,
    sessionId: getSessionId(),
    userId: getUserId(),
    extra: {
      ...extra,
      exhibitionId: exhibitionId || undefined,
      exhibitionTitle: exhibitionTitle || undefined
    }
  };
  events.push(event);
  saveEvents(events);
  
  // Live server integration
  sendToServer(event);
};

export const trackEvent = (type, pageType, elementId, extra = {}) => {
  const events = getRawEvents();
  
  let currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  let exhibitionId = extra.exhibitionId || extractExhibitionId(currentUrl);

  const event = {
    timestamp: Date.now(),
    type,
    pageType,
    elementId,
    sessionId: getSessionId(),
    userId: getUserId(),
    extra: {
      ...extra,
      exhibitionId: exhibitionId || undefined
    }
  };
  events.push(event);
  saveEvents(events);
  
  // Live server integration
  sendToServer(event);
};

// Clear Logs and Reset to default Seed
export const resetDatabase = () => {
  localStorage.removeItem(STORAGE_KEY);
  seedDatabase();
  window.dispatchEvent(new CustomEvent('clay_analytics_update'));
};

// --- Analytics Calculations & API (Simulating Aggregation Workers) ---

// 1. Get Top Scorecards
export const getSummaryStats = () => {
  const events = getRawEvents();
  const pageViews = events.filter(e => e.type === 'PAGE_VIEW');
  
  const totalPV = pageViews.length;
  const uniqueUV = new Set(events.map(e => e.userId)).size;
  
  // Calculate Avg Session Duration & Bounce rate
  // Group events by session
  const sessionMap = {};
  events.forEach(e => {
    if (!sessionMap[e.sessionId]) {
      sessionMap[e.sessionId] = [];
    }
    sessionMap[e.sessionId].push(e.timestamp);
  });
  
  const sessions = Object.values(sessionMap);
  let totalDuration = 0;
  let bounceCount = 0;
  
  sessions.forEach(timestamps => {
    if (timestamps.length <= 1) {
      bounceCount++; // Only 1 event is a bounce
    } else {
      const min = Math.min(...timestamps);
      const max = Math.max(...timestamps);
      totalDuration += (max - min);
    }
  });
  
  const avgDurationMs = sessions.length ? totalDuration / sessions.length : 0;
  const avgDurationSec = Math.floor(avgDurationMs / 1000);
  
  // Format Duration as mm:ss
  const mins = Math.floor(avgDurationSec / 60);
  const secs = avgDurationSec % 60;
  const durationFormatted = `${mins}m ${secs}s`;
  
  const bounceRate = sessions.length ? Math.floor((bounceCount / sessions.length) * 100) : 0;
  
  // Total Revenue
  const purchaseEvents = events.filter(e => e.type === 'PURCHASE');
  const revenue = purchaseEvents.reduce((acc, curr) => acc + (curr.extra?.revenue || 0), 0);
  
  return {
    totalPV: totalPV.toLocaleString(),
    uniqueUV: uniqueUV.toLocaleString(),
    avgDuration: durationFormatted,
    bounceRate: `${bounceRate}%`,
    revenue: `$${revenue.toLocaleString()}`
  };
};

// 2. Get Conversion Funnel Rates
export const getFunnelData = () => {
  const events = getRawEvents();
  const sessionMap = {};
  
  // Map session steps
  events.forEach(e => {
    if (!sessionMap[e.sessionId]) {
      sessionMap[e.sessionId] = {
        home: false,
        detail: false,
        cart: false,
        checkout: false,
        purchase: false
      };
    }
    const s = sessionMap[e.sessionId];
    if (e.pageType === 'HOME') s.home = true;
    if (e.pageType === 'PRODUCT_DETAIL') s.detail = true;
    if (e.type === 'ADD_TO_CART') s.cart = true;
    if (e.pageType === 'CHECKOUT') s.checkout = true;
    if (e.type === 'PURCHASE') s.purchase = true;
  });
  
  const sessions = Object.values(sessionMap);
  const total = sessions.length;
  
  const homeCount = sessions.filter(s => s.home).length;
  const detailCount = sessions.filter(s => s.detail).length;
  const cartCount = sessions.filter(s => s.cart).length;
  const checkoutCount = sessions.filter(s => s.checkout).length;
  const purchaseCount = sessions.filter(s => s.purchase).length;
  
  const getRate = (val) => total ? Math.floor((val / total) * 100) : 0;
  
  return [
    { name: '1. Home Page View', count: homeCount, rate: getRate(homeCount), color: 'var(--colors-brand-peach)' },
    { name: '2. Product Clicked', count: detailCount, rate: getRate(detailCount), color: 'var(--colors-brand-pink)' },
    { name: '3. Add to Cart', count: cartCount, rate: getRate(cartCount), color: 'var(--colors-brand-ochre)' },
    { name: '4. Checkout Started', count: checkoutCount, rate: getRate(checkoutCount), color: 'var(--colors-brand-lavender)' },
    { name: '5. Purchase Completed', count: purchaseCount, rate: getRate(purchaseCount), color: 'var(--colors-brand-mint)' }
  ];
};

// 3. Get Page-Level Performance Table Data
export const getPagePerformance = () => {
  const events = getRawEvents();
  const pageViews = events.filter(e => e.type === 'PAGE_VIEW');
  
  const pageMap = {};
  
  // Group by page URL
  pageViews.forEach(pv => {
    if (!pageMap[pv.url]) {
      pageMap[pv.url] = {
        url: pv.url,
        pageType: pv.pageType,
        pv: 0,
        uvSet: new Set(),
        sessionTimeMap: {},
        sessionEventsCount: {}
      };
    }
    const page = pageMap[pv.url];
    page.pv++;
    page.uvSet.add(pv.userId);
    
    // Group timestamps by session for this page
    if (!page.sessionTimeMap[pv.sessionId]) {
      page.sessionTimeMap[pv.sessionId] = [];
    }
    page.sessionTimeMap[pv.sessionId].push(pv.timestamp);
  });
  
  // Calculate average duration and bounce rate per page
  // A session "bounce" on a page is if the user session has no other events on this page or anywhere else
  return Object.values(pageMap).map(page => {
    const uvCount = page.uvSet.size;
    const sessionTimes = Object.values(page.sessionTimeMap);
    
    let totalStayMs = 0;
    let singleActionPageSessions = 0;
    
    sessionTimes.forEach(timestamps => {
      if (timestamps.length <= 1) {
        singleActionPageSessions++;
        totalStayMs += 8000; // Simulated default stay of 8s for single views
      } else {
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        totalStayMs += (max - min);
      }
    });
    
    const avgStaySec = sessionTimes.length ? Math.floor((totalStayMs / sessionTimes.length) / 1000) : 0;
    const bounceRate = sessionTimes.length ? Math.floor((singleActionPageSessions / sessionTimes.length) * 100) : 0;
    
    return {
      url: page.url,
      pageType: page.pageType,
      pv: page.pv,
      uv: uvCount,
      avgStay: `${avgStaySec}s`,
      bounceRate: `${Math.min(bounceRate, 85)}%` // Capped bounce rate for realism
    };
  }).sort((a, b) => b.pv - a.pv);
};

// 4. Get Real-time Event log (most recent 40)
export const getRealtimeLogs = (limit = 40) => {
  const events = getRawEvents();
  return events.slice(-limit).reverse();
};

// --- Live Random Traffic Simulator ---
// Generates simulated e-commerce interactions in real time to show off dashboard dynamics
export const simulateUserTraffic = () => {
  const userPool = Array.from({ length: 15 }, (_, i) => `sim_user_${Math.floor(Math.random() * 1000)}`);
  const productPool = ['gadget-1', 'gadget-2', 'gadget-3', 'gadget-4'];
  
  const userId = userPool[Math.floor(Math.random() * userPool.length)];
  const sessionId = 'sim_sess_' + Math.random().toString(36).substr(2, 9);
  
  const events = getRawEvents();
  const now = Date.now();
  
  // Simulated paths based on random probability
  const rand = Math.random();
  
  if (rand < 0.4) {
    // 40% Home Page
    events.push({
      timestamp: now,
      type: 'PAGE_VIEW',
      pageType: 'HOME',
      url: '/home',
      sessionId,
      userId,
      extra: { referrer: 'social_media' }
    });
  } else if (rand < 0.65) {
    // 25% Category Page
    events.push({
      timestamp: now,
      type: 'PAGE_VIEW',
      pageType: 'CATEGORY',
      url: '/category',
      sessionId,
      userId,
      extra: {}
    });
  } else if (rand < 0.85) {
    // 20% Product Page + click
    const prodId = productPool[Math.floor(Math.random() * productPool.length)];
    events.push({
      timestamp: now,
      type: 'PAGE_VIEW',
      pageType: 'PRODUCT_DETAIL',
      url: `/product/${prodId}`,
      sessionId,
      userId,
      extra: { productId: prodId }
    });
    
    // Quick delay simulation (in actual logs we just push close timestamp)
    if (Math.random() < 0.5) {
      events.push({
        timestamp: now + 500,
        type: 'ADD_TO_CART',
        pageType: 'PRODUCT_DETAIL',
        elementId: 'add-to-cart-btn',
        sessionId,
        userId,
        extra: { productId: prodId, price: 199 }
      });
    }
  } else if (rand < 0.95) {
    // 10% Checkout
    events.push({
      timestamp: now,
      type: 'PAGE_VIEW',
      pageType: 'CHECKOUT',
      url: '/checkout',
      sessionId,
      userId,
      extra: {}
    });
  } else {
    // 5% Purchase Completed!
    events.push({
      timestamp: now,
      type: 'PURCHASE',
      pageType: 'CHECKOUT',
      elementId: 'pay-now-btn',
      sessionId,
      userId,
      extra: { orderId: 'ord_sim_' + Math.random().toString(36).substr(2, 4), revenue: 249 }
    });
    events.push({
      timestamp: now + 100,
      type: 'PAGE_VIEW',
      pageType: 'PURCHASE',
      url: '/purchase-success',
      sessionId,
      userId,
      extra: {}
    });
  }
  
  saveEvents(events);
};
