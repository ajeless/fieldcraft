export type FreeCoordinatePoint = {
  x: number;
  y: number;
};

export type FreeCoordinateBounds = FreeCoordinatePoint & {
  width: number;
  height: number;
};

const coordinatePrecision = 100;

export function isPointInFreeCoordinateBounds(
  point: FreeCoordinatePoint,
  bounds: FreeCoordinateBounds
): boolean {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x <= bounds.x + bounds.width &&
    point.y <= bounds.y + bounds.height
  );
}

export function roundFreeCoordinatePoint(
  point: FreeCoordinatePoint
): FreeCoordinatePoint {
  return {
    x: roundFreeCoordinate(point.x),
    y: roundFreeCoordinate(point.y)
  };
}

export function freeCoordinateDistance(
  from: FreeCoordinatePoint,
  to: FreeCoordinatePoint
): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

// Bearing follows board-view convention: 0 is up, 90 is right, clockwise positive.
export function freeCoordinateBearingDegrees(
  from: FreeCoordinatePoint,
  to: FreeCoordinatePoint
): number {
  const degrees = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;

  return (degrees + 360) % 360;
}

function roundFreeCoordinate(value: number): number {
  return Math.round(value * coordinatePrecision) / coordinatePrecision;
}
