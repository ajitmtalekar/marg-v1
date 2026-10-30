// indoorSmoothing.js

export function smoothIndoorPosition(prev, next, sameFloor) {
  if (!prev || !sameFloor) return next;

  const alpha = 0.25; // smoothing strength

  return [
    prev[0] * (1 - alpha) + next[0] * alpha,
    prev[1] * (1 - alpha) + next[1] * alpha
  ];
}
