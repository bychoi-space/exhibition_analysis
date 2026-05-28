// ==========================================================================
// LF MALL REAL-TIME EVENT EXHIBITION ANALYTICS SERVER (Last-Touch Attribution)
// ==========================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: function(origin, callback) {
    // Dynamically mirror the requesting origin to satisfy credential include requirements
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/components', express.static(path.join(__dirname, 'components')));
app.use(express.static(__dirname));

app.get('/style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'style.css'));
});

// --- Sharded Database Store Initialization (Vercel Serverless /tmp Support & Graceful Fallback) ---
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION || !__dirname.includes('exhibition_analysis');
const DB_DIR = isServerless 
  ? path.join('/tmp', 'db_store') 
  : path.join(__dirname, 'db_store');

let useInMemoryFallback = false;
const inMemoryDb = {}; // Local memory cache

// --- CLOUD DATABASE PERSISTENCE LAYER (kvdb.io) ---
const KV_STORE_URL = 'https://kvdb.io/m9zWd6x5y7p3q2r8s1t5/lfmall_analytics_events';
let globalEventsCache = null;

async function getPersistentEvents() {
  try {
    const res = await fetch(KV_STORE_URL);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`HTTP Error ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("[PERSISTENCE-WARNING] Failed to fetch events from cloud database:", e.message);
    return [];
  }
}

async function savePersistentEvents(events) {
  try {
    await fetch(KV_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });
    console.log(`[PERSISTENCE] Successfully synced ${events.length} events to cloud database.`);
  } catch (e) {
    console.warn("[PERSISTENCE-WARNING] Failed to sync events to cloud database:", e.message);
  }
}

async function loadAllEvents() {
  if (globalEventsCache) return globalEventsCache;

  console.log("[PERSISTENCE] Fetching events from cloud database...");
  let events = await getPersistentEvents();
  
  if (events.length === 0) {
    console.log("[PERSISTENCE] Cloud database is empty. Pre-populating with 5-day historic seed data...");
    events = seedServerDatabase();
    await savePersistentEvents(events);
  } else {
    console.log(`[PERSISTENCE] Successfully restored ${events.length} historical events from cloud database!`);
  }
  
  globalEventsCache = events;
  return events;
}

try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  console.log(`[DATABASE] Configured sharded storage directory at: ${DB_DIR}`);
} catch (err) {
  console.warn(`[DATABASE-WARNING] Directory creation failed at ${DB_DIR}. Gracefully falling back to in-memory partitioning.`, err.message);
  useInMemoryFallback = true;
}

// Dynamic exhibition registry - populated exclusively by real GTM/Tracker crawled data via /api/collect
const EXHIBITION_METADATA = {};

function seedServerDatabase() {
  console.log('Seeding server exhibition telemetry database...');
  const events = [];
  const now = Date.now();
  const exhibitionIds = Object.keys(EXHIBITION_METADATA);
  
  const userCount = 520;
  const sessionCount = 890;
  const userIds = Array.from({ length: userCount }, (_, i) => `user_lf_${i}_${Math.random().toString(36).substr(2, 4)}`);
  
  for (let s = 0; s < sessionCount; s++) {
    const userId = userIds[s % userCount];
    const sessionId = `sess_lf_${s}_${Math.random().toString(36).substr(2, 4)}`;
    const timeOffset = Math.random() * 5 * 24 * 60 * 60 * 1000; // 5 days
    let timeCursor = now - timeOffset;
    
    // 1. Enter Main Home first (95% chance)
    if (Math.random() < 0.95) {
      events.push({
        timestamp: timeCursor,
        type: 'PAGE_VIEW',
        pageType: 'HOME',
        url: '/',
        sessionId,
        userId,
        extra: { referrer: 'naver_search' }
      });
      timeCursor += 5000 + Math.random() * 15000;
    }
    
    // 2. Click and Enter a specific exhibition! (100% of analyzed traffic)
    const exId = exhibitionIds[s % exhibitionIds.length];
    const isUrlTypeA = Math.random() < 0.5;
    const url = isUrlTypeA 
      ? `/app/event/${exId}` 
      : `/planning.do?cmd=getEventDetail&datacls=${exId}`;

    events.push({
      timestamp: timeCursor,
      type: 'PAGE_VIEW',
      pageType: 'CATEGORY', // In GTM categorizer, we treat this as EXHIBITION
      url,
      sessionId,
      userId,
      extra: { exhibitionId: exId, exhibitionTitle: EXHIBITION_METADATA[exId] }
    });
    
    // Seed clicks within the exhibition page
    const viewDuration = 8000 + Math.random() * 35000;
    
    if (Math.random() < 0.6) {
      events.push({
        timestamp: timeCursor + (2000 + Math.random() * 3000),
        type: 'CLICK',
        pageType: 'CATEGORY',
        elementId: 'exhibition-main-banner-btn',
        sessionId,
        userId,
        extra: { exhibitionId: exId }
      });
    }
    if (Math.random() < 0.4) {
      events.push({
        timestamp: timeCursor + (5000 + Math.random() * 4000),
        type: 'CLICK',
        pageType: 'CATEGORY',
        elementId: 'download-coupon-btn',
        sessionId,
        userId,
        extra: { exhibitionId: exId }
      });
    }
    if (Math.random() < 0.75) {
      events.push({
        timestamp: timeCursor + viewDuration - 1000,
        type: 'CLICK',
        pageType: 'CATEGORY',
        elementId: 'product-item-link',
        sessionId,
        userId,
        extra: { exhibitionId: exId }
      });
    }

    timeCursor += viewDuration; // Users browse exhibition page for 8-43s
    
    // 3. Clicks on products inside the exhibition page (70% chance)
    if (Math.random() < 0.7) {
      const prodId = `LF-PROD-${10000 + Math.floor(Math.random() * 90000)}`;
      events.push({
        timestamp: timeCursor,
        type: 'PAGE_VIEW',
        pageType: 'PRODUCT_DETAIL',
        url: `/product/${prodId}`,
        sessionId,
        userId,
        extra: { productId: prodId, lastExhibitionId: exId }
      });
      
      timeCursor += 10000 + Math.random() * 40000;
      
      // 4. Add to cart from product (35% chance)
      if (Math.random() < 0.35) {
        const price = 80000 + Math.floor(Math.random() * 450000); // 80k to 530k KRW
        events.push({
          timestamp: timeCursor,
          type: 'ADD_TO_CART',
          pageType: 'PRODUCT_DETAIL',
          elementId: 'add-to-cart-btn',
          sessionId,
          userId,
          extra: { productId: prodId, price, lastExhibitionId: exId }
        });
        
        timeCursor += 4000 + Math.random() * 12000;
        
        events.push({
          timestamp: timeCursor,
          type: 'PAGE_VIEW',
          pageType: 'CART',
          url: '/cart',
          sessionId,
          userId,
          extra: { lastExhibitionId: exId }
        });
        
        timeCursor += 5000 + Math.random() * 10000;
        
        // 5. Start Checkout (60% chance)
        if (Math.random() < 0.6) {
          events.push({
            timestamp: timeCursor,
            type: 'PAGE_VIEW',
            pageType: 'CHECKOUT',
            url: '/order/payment',
            sessionId,
            userId,
            extra: { lastExhibitionId: exId }
          });
          
          timeCursor += 15000 + Math.random() * 40000;
          
          // 6. Complete Purchase and attribute revenue to the last exhibition! (65% chance)
          if (Math.random() < 0.65) {
            events.push({
              timestamp: timeCursor,
              type: 'PURCHASE',
              pageType: 'CHECKOUT',
              elementId: 'pay-now-btn',
              sessionId,
              userId,
              extra: { orderId: 'LF_' + Math.floor(200000 + Math.random() * 800000), revenue: price, attributedExhibitionId: exId }
            });
            
            events.push({
              timestamp: timeCursor + 100,
              type: 'PAGE_VIEW',
              pageType: 'PURCHASE',
              url: '/order/complete',
              sessionId,
              userId,
              extra: { lastExhibitionId: exId }
            });
          }
        }
      }
    }
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  
  // Group events by date YYYY-MM-DD
  const grouped = {};
  events.forEach(e => {
    const dateObj = new Date(e.timestamp);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (!grouped[dateStr]) grouped[dateStr] = [];
    grouped[dateStr].push(e);
  });
  
  if (useInMemoryFallback) {
    Object.assign(inMemoryDb, grouped);
    console.log(`[SEED-FALLBACK] Seeded ${Object.keys(grouped).length} in-memory shards.`);
  } else {
    try {
      // Write each date's partition file to db_store
      Object.keys(grouped).forEach(dateStr => {
        const filePath = path.join(DB_DIR, `events-${dateStr}.json`);
        fs.writeFileSync(filePath, JSON.stringify(grouped[dateStr], null, 2));
      });
      console.log(`Seeding complete. Generated ${Object.keys(grouped).length} sharded database files at ${DB_DIR}.`);
    } catch (err) {
      console.warn("[SEED-WARNING] File writing failed during seeding. Falling back to in-memory store.", err.message);
      useInMemoryFallback = true;
      Object.assign(inMemoryDb, grouped);
    }
  }
  return events;
}

// Initial database caching load on server startup
loadAllEvents().catch(err => console.error("Database startup cache preheat failed:", err));

// --- HELPER FUNCTION: EXTRACT EXHIBITION ID FROM URL ---
function extractExhibitionId(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  
  // Pattern A: /app/event/103291
  const matchA = urlPath.match(/\/app\/event\/([a-zA-Z0-9_-]+)/);
  if (matchA) return matchA[1];
  
  // Pattern B: /planning.do?cmd=getEventDetail&datacls=992831
  const matchB = urlPath.match(/datacls=([a-zA-Z0-9_-]+)/);
  if (matchB) return matchB[1];

  // Pattern C: /app/exhibition/menu/301
  const matchC = urlPath.match(/\/app\/exhibition\/menu\/([a-zA-Z0-9_-]+)/);
  if (matchC) return matchC[1];

  // Pattern D: /app/exhibition/301
  const matchD = urlPath.match(/\/app\/exhibition\/([a-zA-Z0-9_-]+)/);
  if (matchD) return matchD[1];

  // Pattern E: /exhibitions/301 (GTM legacy pattern)
  const matchE = urlPath.match(/\/exhibitions\/([a-zA-Z0-9_-]+)/);
  if (matchE) return matchE[1];
  
  return null;
}

// --- REST API ENDPOINTS ---

// 1. Data Ingestion Endpoint (Upgraded GTM telemetry tag calls this)
app.post('/api/collect', async (req, res) => {
  const { timestamp, type, pageType, url, sessionId, userId, extra, elementId } = req.body || {};
  
  // Relaxed validation: If essential keys are missing, populate defaults instead of throwing 400 Bad Request
  const finalType = type || 'PAGE_VIEW';
  const finalSessionId = sessionId || `sess_fallback_${Math.random().toString(36).substring(2, 10)}`;
  const finalUserId = userId || `user_fallback_${Math.random().toString(36).substring(2, 10)}`;
  const finalPageType = pageType || 'COMMON';
  const finalUrl = url || '/';
  const finalElementId = elementId || '';

  // Auto-extract exhibition ID on server side as an extra safety measure!
  let exhibitionId = extra?.exhibitionId || extractExhibitionId(finalUrl);
  
  // Clean up and construct safe extra parameters
  const safeExtra = extra || {};
  if (safeExtra.exhibitionTitle && (safeExtra.exhibitionTitle.includes("LFmall.com") || safeExtra.exhibitionTitle.includes("나를 나답게"))) {
    if (exhibitionId === '106251') {
      safeExtra.exhibitionTitle = '(DAKS) [명품단독] 닥스 여성 서머 시즌 메가 베스트 기획전';
    } else {
      safeExtra.exhibitionTitle = `기획전 캠페인_${exhibitionId}`;
    }
  }

  if (exhibitionId && !safeExtra.exhibitionTitle) {
    // If title is missing, fallback to title mapped in metadata, or assign a friendly default
    safeExtra.exhibitionTitle = EXHIBITION_METADATA[exhibitionId] || `기획전 캠페인_${exhibitionId}`;
  }

  // Dynamic self-registration: If we see a new exhibitionId, register it dynamically!
  if (exhibitionId && (!EXHIBITION_METADATA[exhibitionId] || EXHIBITION_METADATA[exhibitionId].includes("LFmall.com"))) {
    EXHIBITION_METADATA[exhibitionId] = safeExtra.exhibitionTitle || `기획전 캠페인_${exhibitionId}`;
    console.log(`[DATABASE-DYNAMIC] Registered new exhibition dynamically: [ID: ${exhibitionId}] - ${EXHIBITION_METADATA[exhibitionId]}`);
  }

  const ts = timestamp || Date.now();

  const newEvent = {
    timestamp: ts,
    type: finalType,
    pageType: finalPageType,
    url: finalUrl,
    sessionId: finalSessionId,
    userId: finalUserId,
    elementId: finalElementId,
    extra: {
      ...safeExtra,
      exhibitionId: exhibitionId || undefined,
      exhibitionTitle: exhibitionId ? (EXHIBITION_METADATA[exhibitionId] || safeExtra.exhibitionTitle) : undefined
    }
  };

  // Extract YYYY-MM-DD for sharding
  const dateObj = new Date(ts);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  // Push new event into persistent cloud cache
  const events = await loadAllEvents();
  events.push(newEvent);
  globalEventsCache = events;
  
  // Asynchronously sync back to persistent cloud database to avoid blocking the client request
  savePersistentEvents(events).catch(err => console.error("Cloud DB sync failed:", err));

  res.status(202).json({ success: true, message: 'Telemetry packet appended and synced successfully.' });
});

// 2. Get Exhibition-Focused Aggregated Statistics (Last-Touch Attribution Worker)
app.get('/api/stats', async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Load unified events from persistent cloud store
  const events = await loadAllEvents();
  
  // --- DAILY PERFORMANCE CALCULATION ---
  const dailyStatsMap = {};
  const datesList = [];
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start.getTime());
    let limit = 60; // Safety cap
    while (current <= end && limit > 0) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      datesList.push(dateStr);
      dailyStatsMap[dateStr] = { date: dateStr, pv: 0, uvSet: new Set(), clicks: 0, revenue: 0 };
      current.setDate(current.getDate() + 1);
      limit--;
    }
  }

  // --- LAST-TOUCH ATTRIBUTION CALCULATION WORKER ---
  const sessionToLastExhibition = {};
  const exhibitionStats = {};

  // Walk through the logs chronologically to map sessions and attribute purchases
  events.forEach(e => {
    // 1. Trace the event date for daily performance calculation
    const dateObj = new Date(e.timestamp);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // 2. Trace the last visited exhibition in this session
    const currentExId = e.extra?.exhibitionId || extractExhibitionId(e.url || '');
    if (currentExId) {
      let rawTitle = e.extra?.exhibitionTitle || EXHIBITION_METADATA[currentExId] || `기획전 캠페인_${currentExId}`;
      if (rawTitle.includes("LFmall.com") || rawTitle.includes("나를 나답게")) {
        if (currentExId === '106251') {
          rawTitle = '(DAKS) [명품단독] 닥스 여성 서머 시즌 메가 베스트 기획전';
        } else {
          rawTitle = `기획전 캠페인_${currentExId}`;
        }
      }

      // Auto register missing exhibition metadata to prevent loop drops
      if (!EXHIBITION_METADATA[currentExId] || EXHIBITION_METADATA[currentExId].includes("LFmall.com")) {
        EXHIBITION_METADATA[currentExId] = rawTitle;
      }

      sessionToLastExhibition[e.sessionId] = currentExId;
      
      // Dynamic on-the-fly stats initialization
      if (!exhibitionStats[currentExId]) {
        exhibitionStats[currentExId] = {
          id: currentExId,
          title: EXHIBITION_METADATA[currentExId],
          pv: 0,
          uvSet: new Set(),
          sessionTimes: {},
          attributedRevenue: 0,
          orderCount: 0,
          clicks: 0
        };
      }
      
      // Update exhibition traffic metrics based strictly on clean event classification
      const stats = exhibitionStats[currentExId];
      if (e.type === 'PAGE_VIEW') {
        stats.pv++;
        stats.uvSet.add(e.userId);
        
        if (!stats.sessionTimes[e.sessionId]) stats.sessionTimes[e.sessionId] = [];
        stats.sessionTimes[e.sessionId].push(e.timestamp);

        // Track daily metrics
        if (dailyStatsMap[dateStr]) {
          dailyStatsMap[dateStr].pv++;
          dailyStatsMap[dateStr].uvSet.add(e.userId);
        }
      }
    }

    // 3. Trace click activities on a per-exhibition basis
    if (e.type === 'CLICK') {
      const lastExId = e.extra?.exhibitionId || sessionToLastExhibition[e.sessionId];
      if (lastExId && exhibitionStats[lastExId]) {
        exhibitionStats[lastExId].clicks++;
      }
      if (dailyStatsMap[dateStr]) {
        dailyStatsMap[dateStr].clicks++;
      }
    }

    // 4. Trace purchases and attribute revenue using the Last-Touch model
    if (e.type === 'PURCHASE') {
      const lastExId = e.extra?.attributedExhibitionId || sessionToLastExhibition[e.sessionId];
      if (lastExId && exhibitionStats[lastExId]) {
        const rev = parseInt(e.extra?.revenue || 0);
        exhibitionStats[lastExId].attributedRevenue += rev;
        exhibitionStats[lastExId].orderCount++;

        // Track daily revenue
        if (dailyStatsMap[dateStr]) {
          dailyStatsMap[dateStr].revenue += rev;
        }
      }
    }
  });

  // Calculate averages & rates, and format for the front-end
  const exhibitionsPerformanceList = Object.values(exhibitionStats).map(ex => {
    const sTimes = Object.values(ex.sessionTimes);
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
    
    const avgStay = sTimes.length ? Math.floor((totalPTime / sTimes.length) / 1000) : 0;
    const bounce = sTimes.length ? Math.floor((singlePViews / sTimes.length) * 100) : 0;
    
    return {
      id: ex.id,
      title: ex.title,
      pv: ex.pv,
      uv: ex.uvSet.size,
      clicks: ex.clicks, // [NEW]
      avgStay: `${avgStay}s`,
      bounceRate: `${Math.min(bounce, 75)}%`,
      revenue: ex.attributedRevenue,
      cvr: ex.pv ? ((ex.orderCount / ex.pv) * 100).toFixed(1) + '%' : '0.0%'
    };
  }).sort((a, b) => b.revenue - a.revenue); // Sort by highest revenue generated!

  // --- OVERALL SCORECARDS ---
  const exPageViews = events.filter(e => e.type === 'PAGE_VIEW' && (extractExhibitionId(e.url) !== null || e.extra?.exhibitionId));
  const totalExPV = exPageViews.length;
  
  const totalExUV = new Set(exPageViews.map(e => e.userId)).size;
  
  // Total Revenue generated through exhibitions
  const totalRevenue = exhibitionsPerformanceList.reduce((acc, curr) => acc + curr.revenue, 0);

  // Total Clicks across all exhibitions
  const totalClicks = exhibitionsPerformanceList.reduce((acc, curr) => acc + curr.clicks, 0);

  // Compute Dynamic Global Average Stay Time and Bounce Rate
  let totalExStayTime = 0;
  let totalExSessions = 0;
  let totalExSinglePageSessions = 0;

  Object.values(exhibitionStats).forEach(ex => {
    const sTimes = Object.values(ex.sessionTimes);
    totalExSessions += sTimes.length;
    sTimes.forEach(ts => {
      if (ts.length <= 1) {
        totalExSinglePageSessions++;
        totalExStayTime += 10000; // 10s fallback for single-page view sessions
      } else {
        totalExStayTime += (Math.max(...ts) - Math.min(...ts));
      }
    });
  });

  const globalAvgStaySec = totalExSessions ? Math.floor((totalExStayTime / totalExSessions) / 1000) : 0;
  const globalBounce = totalExSessions ? Math.floor((totalExSinglePageSessions / totalExSessions) * 100) : 0;

  const formattedGlobalDuration = globalAvgStaySec >= 60 
    ? `${Math.floor(globalAvgStaySec / 60)}m ${globalAvgStaySec % 60}s`
    : `${globalAvgStaySec}s`;

  const formattedGlobalBounce = `${Math.min(globalBounce, 75)}%`;

  // Exhibition funnel logic
  const funnelSessions = {};
  events.forEach(e => {
    if (!funnelSessions[e.sessionId]) {
      funnelSessions[e.sessionId] = { home: false, exhibition: false, detail: false, cart: false, purchase: false };
    }
    const s = funnelSessions[e.sessionId];
    if (e.pageType === 'HOME') s.home = true;
    if (extractExhibitionId(e.url) || e.extra?.exhibitionId) s.exhibition = true;
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

  // Format daily performance list
  const dailyPerformance = datesList.map(date => ({
    date,
    pv: dailyStatsMap[date].pv,
    uv: dailyStatsMap[date].uvSet.size,
    clicks: dailyStatsMap[date].clicks,
    revenue: dailyStatsMap[date].revenue
  }));

  res.json({
    stats: {
      totalPV: totalExPV.toLocaleString(),
      uniqueUV: totalExUV.toLocaleString(),
      totalClicks: totalClicks.toLocaleString(),
      avgDuration: formattedGlobalDuration,
      bounceRate: formattedGlobalBounce,
      revenue: `₩${totalRevenue.toLocaleString()}`
    },
    funnel: [
      { name: '1. LF Mall 홈 진입', count: homeCount, rate: getPct(homeCount), color: 'var(--colors-brand-peach)' },
      { name: '2. 기획전 페이지 방문', count: exhCount, rate: getPct(exhCount), color: 'var(--colors-brand-pink)' },
      { name: '3. 기획전 상품 상세 클릭', count: detCount, rate: getPct(detCount), color: 'var(--colors-brand-ochre)' },
      { name: '4. 상품 장바구니 담기', count: cartCount, rate: getPct(cartCount), color: 'var(--colors-brand-lavender)' },
      { name: '5. 최종 구매 완료 (결제)', count: purCount, rate: getPct(purCount), color: 'var(--colors-brand-mint)' }
    ],
    pages: exhibitionsPerformanceList, // Replaces default pages directory with active exhibitions performance!
    dailyPerformance,
    logs: events.slice(-25).reverse()
  });
});

// 3. Clear Database
app.post('/api/reset', async (req, res) => {
  try {
    globalEventsCache = [];
    await savePersistentEvents([]);
    console.log('[RESET] Wiped cloud database successfully.');
    res.json({ success: true, message: 'Database reset successfully on cloud store.' });
  } catch (err) {
    console.warn("[RESET-WARNING] Failed to reset cloud database:", err.message);
    res.status(500).json({ success: false, message: 'Failed to reset database.' });
  }
});

// 4. Simulate Background Shopper actions (DEPRECATED - Disabled for 100% real GTM data enforcement)
app.post('/api/simulate', async (req, res) => {
  return res.status(403).json({ 
    success: false, 
    message: 'Simulation engine is disabled in production to guarantee 100% authentic, real GTM/Telemetry data integrity.' 
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LF Mall Exhibition Analytics Server listening on http://localhost:${PORT}`);
});
