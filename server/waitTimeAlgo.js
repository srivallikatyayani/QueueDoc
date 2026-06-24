export function calculateEffectiveAvg(consultations, manualSeedSeconds) {
  if (!consultations || consultations.length === 0) {
    return { effectiveAvgSeconds: manualSeedSeconds, sampleCount: 0 };
  }

  const validDurations = [];
  let ema = null;
  const alpha = 0.3;
  let validSampleCount = 0;

  for (let i = 0; i < consultations.length; i++) {
    const duration = consultations[i].duration_seconds;
    
    // Check outlier against current rolling median of valid samples
    if (validDurations.length > 0) {
      const sorted = [...validDurations].sort((a, b) => a - b);
      let median;
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        median = (sorted[mid - 1] + sorted[mid]) / 2;
      } else {
        median = sorted[mid];
      }
      
      if (duration > 3 * median) {
        continue; // Discard outlier
      }
    }
    
    validDurations.push(duration);
    validSampleCount++;
    
    if (ema === null) {
      ema = duration;
    } else {
      ema = alpha * duration + (1 - alpha) * ema;
    }
  }

  if (validSampleCount === 0) {
    return { effectiveAvgSeconds: manualSeedSeconds, sampleCount: 0 };
  }

  // Confidence blending: shift weight from manual seed to EMA
  // 1-2: 0%, 3: 25%, 4: 50%, 5: 75%, 6+: 100%
  let emaWeight = 0;
  if (validSampleCount >= 6) {
    emaWeight = 1.0;
  } else if (validSampleCount === 3) {
    emaWeight = 0.25;
  } else if (validSampleCount === 4) {
    emaWeight = 0.50;
  } else if (validSampleCount === 5) {
    emaWeight = 0.75;
  }

  const effectiveAvgSeconds = Math.round((ema * emaWeight) + (manualSeedSeconds * (1 - emaWeight)));

  return { 
    effectiveAvgSeconds, 
    sampleCount: validSampleCount 
  };
}
