'use client';

import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface AutocompleteItem {
  id: string;
  label: string;
  description?: string;
  badge?: {
    label: string;
    variant?: 'default' | 'minimal' | 'accent' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';
  };
  icon?: LucideIcon;
  avatar?: string;
  rankBadge?: {
    label: string;
    variant?: 'default' | 'minimal' | 'accent' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline';
  };
}

interface InlineAutocompleteProps {
  items: AutocompleteItem[];
  isOpen: boolean;
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
  maxItems?: number;
  trigger?: '/' | '@';
  position?: 'top' | 'bottom' | 'cursor';
  cursorCoordinates?: { top: number; left: number; height: number };
}

/**
 * Minimalist inline autocomplete component
 * Renders below textarea input (relative positioning)
 * Supports keyboard navigation and touch interaction
 */
export const InlineAutocomplete = React.forwardRef<HTMLDivElement, InlineAutocompleteProps>(
  (
    {
      items,
      isOpen,
      selectedIndex,
      onSelect,
      onClose,
      maxItems = 6,
      trigger = '/',
      position = 'top',
      cursorCoordinates,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Scroll selected item into view
    useEffect(() => {
      if (selectedIndex >= 0 && containerRef.current) {
        const selectedElement = containerRef.current.querySelector(
          `[data-index="${selectedIndex}"]`,
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, [selectedIndex]);

    if (!isOpen || items.length === 0) {
      return null;
    }

    const displayItems = items.slice(0, maxItems);

    // Calculate position styles for cursor-based positioning
    const isCursorPosition = position === 'cursor' && cursorCoordinates;
    const positionStyle = isCursorPosition
      ? {
          top: `${cursorCoordinates.top + cursorCoordinates.height + 2}px`,
          left: `${cursorCoordinates.left}px`,
        }
      : undefined;

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 pointer-events-auto",
          isCursorPosition ? "" : "left-0 right-0",
          !isCursorPosition && (position === 'top' ? "bottom-full mb-0.5" : "top-full mt-1")
        )}
        style={positionStyle}
      >
        <Card
          className={cn(
            'p-0 overflow-hidden shadow-md border-border/60 rounded-md',
            'animate-in fade-in-0 duration-200',
            position === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2',
            isCursorPosition && 'min-w-[280px] max-w-[400px]',
          )}
          variant="default"
        >
          <div
            className="max-h-64 overflow-y-auto"
            ref={containerRef}
            role="listbox"
          >
            {displayItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => onSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelect(item);
                    }
                  }}
                  role="option"
                  aria-selected={index === selectedIndex}
                  tabIndex={index === selectedIndex ? 0 : -1}
                  className={cn(
                    'px-3 py-2.5 cursor-pointer transition-colors duration-150',
                    'border-b border-border/20 last:border-b-0',
                    'flex items-center gap-3',
                    'hover:bg-muted active:bg-muted/80',
                    index === selectedIndex && 'bg-muted',
                  )}
                >
                  {/* Icon or Avatar */}
                  {Icon ? (
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.label}
                      className="h-7 w-7 rounded-full flex-shrink-0 object-cover"
                    />
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground truncate">
                        {item.label}
                      </div>
                      {item.badge && (
                        <Badge variant={item.badge.variant || 'minimal'} className="flex-shrink-0 text-xs">
                          {item.badge.label}
                        </Badge>
                      )}
                      {item.rankBadge && (
                        <Badge
                          variant={item.rankBadge.variant || 'minimal'}
                          className="flex-shrink-0 text-xs"
                        >
                          {item.rankBadge.label}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  },
);

InlineAutocomplete.displayName = 'InlineAutocomplete';
