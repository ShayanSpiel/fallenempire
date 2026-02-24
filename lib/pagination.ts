/**
 * Pagination utilities for efficient data loading
 * Reduces memory footprint and improves performance with large datasets
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  total?: number;
}

/**
 * Calculate pagination offset
 */
export const calculateOffset = (page: number, pageSize: number): number => {
  return (page - 1) * pageSize;
};

/**
 * Calculate if more pages exist
 */
export const hasMorePages = (
  total: number | undefined,
  currentCount: number,
  pageSize: number
): boolean => {
  if (total === undefined) {
    // If no total, assume more if we got a full page
    return currentCount === pageSize;
  }
  return currentCount === pageSize;
};

/**
 * Viewport-based region filtering
 * Returns approximate geographic bounds from map viewport
 */
export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Convert Deck.gl view state to viewport bounds
 * Useful for fetching regions only in visible area
 */
export const viewStateToViewportBounds = (
  viewState: {
    latitude: number;
    longitude: number;
    zoom: number;
  },
  width: number,
  height: number
): ViewportBounds => {
  // Simplified calculation - in production would use proper WebMercator math
  const zoomLevel = viewState.zoom;
  const metersPerPixel = (40075016.686 * Math.cos(viewState.latitude * (Math.PI / 180))) / (256 * Math.pow(2, zoomLevel));

  const latDelta = (height * metersPerPixel) / 111320;
  const lngDelta = (width * metersPerPixel) / (111320 * Math.cos(viewState.latitude * (Math.PI / 180)));

  return {
    minLat: viewState.latitude - latDelta / 2,
    maxLat: viewState.latitude + latDelta / 2,
    minLng: viewState.longitude - lngDelta / 2,
    maxLng: viewState.longitude + lngDelta / 2,
  };
};

/**
 * Build pagination query object for Supabase
 */
export const buildPaginationQuery = (page: number, pageSize: number) => {
  const offset = calculateOffset(page, pageSize);
  return { from: offset, to: offset + pageSize - 1 };
};

/**
 * Create pagination state manager
 */
export class PaginationManager {
  private currentPage: number = 1;
  private pageSize: number;
  private total: number | undefined;

  constructor(pageSize: number = 50) {
    this.pageSize = pageSize;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  setCurrentPage(page: number): void {
    if (page < 1) throw new Error("Page must be >= 1");
    this.currentPage = page;
  }

  getPageSize(): number {
    return this.pageSize;
  }

  getOffset(): number {
    return calculateOffset(this.currentPage, this.pageSize);
  }

  setTotal(total: number): void {
    this.total = total;
  }

  getTotalPages(): number {
    if (!this.total) return 1;
    return Math.ceil(this.total / this.pageSize);
  }

  hasNextPage(): boolean {
    if (!this.total) return true;
    return this.currentPage < this.getTotalPages();
  }

  hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  nextPage(): void {
    if (this.hasNextPage()) {
      this.currentPage += 1;
    }
  }

  previousPage(): void {
    if (this.hasPreviousPage()) {
      this.currentPage -= 1;
    }
  }

  reset(): void {
    this.currentPage = 1;
  }
}
