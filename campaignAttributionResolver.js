/**
 * Campaign Attribution Resolver (Core Telemetry Domain Module)
 * Governs E-Commerce attribution using a robust 7-day Time-Window Lookup model.
 * 
 * Logic:
 * When a PURCHASE event occurs, we search the user's historical actions:
 * 1. Look back chronologically (most recent first) up to 7 days.
 * 2. Search for a PRODUCT_DETAIL page view event that matches:
 *    - The same userId.
 *    - The same productId (either explicitly supplied or parsed from the URL).
 *    - An exhibitionId context was active during that detail view.
 * 3. If found, attribute the purchase revenue and order count to that exhibition!
 * 4. This bypasses intermediary page views like cart, checkout, or login.
 */

// Helper to extract productId from URL path
const extractProductId = (urlPath) => {
  if (!urlPath || typeof urlPath !== 'string') return null;
  
  // /product/gadget-1 or similar patterns
  const match = urlPath.match(/\/product\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

const findAttributedExhibition = (recentLogs, userId, incomingProductId, incomingUrl, purchaseTimestamp) => {
  if (!userId) return null;

  // Resolve target product ID from either extra payload or url
  const targetProductId = incomingProductId || extractProductId(incomingUrl);
  if (!targetProductId) return null;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  // Sort logs descending (most recent first) to get the latest interaction
  const sortedLogs = [...recentLogs].sort((a, b) => b.timestamp - a.timestamp);

  for (const log of sortedLogs) {
    // 1. Time-window check: must be within 7 days of the purchase
    const timeDiff = purchaseTimestamp - log.timestamp;
    if (timeDiff > SEVEN_DAYS_MS) {
      // Since logs are sorted chronologically, once we exceed 7 days, we can stop
      break;
    }

    // Must be a positive time difference (occurred before purchase)
    if (timeDiff < 0) continue;

    // 2. Check if the log belongs to the same user
    if (log.userId !== userId) continue;

    // 3. Must be a PRODUCT_DETAIL page view
    const isProductView = log.type === 'PAGE_VIEW' && log.pageType === 'PRODUCT_DETAIL';
    if (!isProductView) continue;

    // 4. Check if the product matches
    const logProductId = log.extra?.productId || extractProductId(log.url);
    if (logProductId !== targetProductId) continue;

    // 5. Must have a valid exhibition associated with it
    const logExhibitionId = log.extra?.exhibitionId;
    if (logExhibitionId) {
      console.log(`[ATTRIBUTION-MATCH] User ${userId} bought ${targetProductId}. Found matching view in Exhibition ${logExhibitionId} from ${Math.round(timeDiff / (1000 * 60))} mins ago.`);
      return logExhibitionId;
    }
  }

  return null;
};

module.exports = {
  findAttributedExhibition
};
