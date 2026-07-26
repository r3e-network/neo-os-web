export interface PileDimensions {
  half: number;
  height: number;
}

/**
 * Physical tray dimensions are deliberately flatter than the logical level
 * box. Difficulty grows through variety, occlusion and reserve depth; letting
 * the 54-body mobile budget spread across a much larger floor would make later
 * levels look emptier than L2 instead of increasingly layered.
 */
export function pileDimensions(boxSize: number): PileDimensions {
  const safeBoxSize = Math.max(9, Math.min(12, boxSize));
  return {
    half: Math.max(2.75, Math.min(3, 2.75 + (safeBoxSize - 9) * 0.08)),
    height: 0.78 + (safeBoxSize - 9) * 0.035,
  };
}
