/**
 * Travel System Utilities
 * Handles hex distance calculation and travel ticket requirements
 */

/**
 * Calculate the distance between two hexes using offset coordinates
 * Hex IDs are in format "row-col" where row and col are offset coordinates
 */
export function calculateHexDistance(hex1: string, hex2: string): number {
  // Parse coordinates from "row-col" format
  const [row1, col1] = hex1.split('-').map(Number);
  const [row2, col2] = hex2.split('-').map(Number);

  // Convert offset coordinates to cube coordinates for distance calculation
  // Using odd-r offset system
  const q1 = col1 - Math.floor(row1 / 2);
  const r1 = row1;
  const q2 = col2 - Math.floor(row2 / 2);
  const r2 = row2;

  const s1 = -q1 - r1;
  const s2 = -q2 - r2;

  // Calculate distance using cube coordinates
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/**
 * Calculate number of travel tickets needed for a given distance
 * Rule: 1 ticket per 30 hexes (rounded up)
 */
export function calculateTicketsNeeded(distance: number): number {
  if (distance === 0) return 0;
  return Math.ceil(distance / 30);
}

/**
 * Validate hex ID format (should be "row-col")
 */
export function isValidHexId(hexId: string): boolean {
  const parts = hexId.split('-');
  if (parts.length !== 2) return false;

  const row = Number(parts[0]);
  const col = Number(parts[1]);

  return !isNaN(row) && !isNaN(col) && Number.isInteger(row) && Number.isInteger(col);
}

/**
 * Travel cost breakdown
 */
export interface TravelCost {
  distance: number;
  ticketsNeeded: number;
  canTravel: boolean;
  reason?: string;
}

/**
 * Calculate travel cost from current hex to destination
 */
export function calculateTravelCost(
  currentHex: string | null,
  destinationHex: string,
  availableTickets: number
): TravelCost {
  // First time travel is free
  if (!currentHex) {
    return {
      distance: 0,
      ticketsNeeded: 0,
      canTravel: true,
      reason: 'First-time travel is free',
    };
  }

  // Validate hex IDs
  if (!isValidHexId(currentHex) || !isValidHexId(destinationHex)) {
    return {
      distance: 0,
      ticketsNeeded: 0,
      canTravel: false,
      reason: 'Invalid hex coordinates',
    };
  }

  // Already at destination
  if (currentHex === destinationHex) {
    return {
      distance: 0,
      ticketsNeeded: 0,
      canTravel: false,
      reason: 'Already at this location',
    };
  }

  const distance = calculateHexDistance(currentHex, destinationHex);
  const ticketsNeeded = calculateTicketsNeeded(distance);

  if (availableTickets < ticketsNeeded) {
    return {
      distance,
      ticketsNeeded,
      canTravel: false,
      reason: `Insufficient tickets (need ${ticketsNeeded}, have ${availableTickets})`,
    };
  }

  return {
    distance,
    ticketsNeeded,
    canTravel: true,
  };
}
