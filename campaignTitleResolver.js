/**
 * Campaign Title Resolver (Core Telemetry Domain Module)
 * Ensures absolute metadata integrity for E-Commerce campaign titles.
 * Uses a strict First-Write-Wins logic based on state validation:
 * 1. Temp placeholders ('기획전 캠페인') and layout templates ('나를 나답게 LFmall.com') are treated as generic.
 * 2. Once a genuine campaign title is successfully received and persisted, it is locked forever.
 * 3. Any subsequent telemetry updates (e.g. details page title leakage) are strictly ignored to prevent database pollution.
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

const resolveExhibitionTitle = (existingTitle, incomingTitle) => {
  // A stored title is only truly verified if it exists and is not a temporary placeholder or corrupted layout template
  const isExistingValid = existingTitle && !isGenericOrCorrupted(existingTitle);

  if (isExistingValid) {
    // Lock verified title forever (First-Write-Wins)
    return {
      title: existingTitle,
      shouldUpdate: false
    };
  }

  // If the existing database title is missing or a placeholder, check if the incoming title is genuine
  const isIncomingValid = incomingTitle && !isGenericOrCorrupted(incomingTitle);

  if (isIncomingValid) {
    // We finally got the real campaign title from GTM! Update and prepare to lock.
    return {
      title: incomingTitle.trim(),
      shouldUpdate: true
    };
  }

  // Fallback: If both are invalid/generic, stick with the existing placeholder or default to '기획전 캠페인'
  const fallbackTitle = existingTitle || '기획전 캠페인';
  const shouldUpdate = !existingTitle; // Only write to DB if the entry was completely absent

  return {
    title: fallbackTitle,
    shouldUpdate
  };
};

module.exports = {
  isGenericOrCorrupted,
  resolveExhibitionTitle
};
