'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ActiveFilter } from '@/hooks/use-enhanced-search';

interface FilterTagsProps {
  activeFilters: ActiveFilter[];
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterTags({ 
  activeFilters, 
  onRemoveFilter, 
  onClearAll, 
  className 
}: FilterTagsProps) {
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Active Filters ({activeFilters.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
        >
          Clear All
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((filter) => (
          <FilterTag
            key={`${filter.key}-${filter.value}`}
            filter={filter}
            onRemove={() => onRemoveFilter(filter.key)}
          />
        ))}
      </div>
    </div>
  );
}

interface FilterTagProps {
  filter: ActiveFilter;
  onRemove: () => void;
}

function FilterTag({ filter, onRemove }: FilterTagProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'flex items-center gap-1.5 pr-1 pl-3 py-1 text-xs',
        'hover:bg-secondary/80 transition-colors',
        'border border-border/50'
      )}
    >
      <span className="font-medium text-muted-foreground">
        {filter.label}:
      </span>
      <span className="text-foreground">
        {filter.displayValue}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className={cn(
          'h-4 w-4 p-0 ml-1 hover:bg-destructive/20 hover:text-destructive',
          'rounded-full transition-colors'
        )}
        aria-label={`Remove ${filter.label} filter`}
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}

// Component for displaying search results count with filters
interface SearchResultsHeaderProps {
  totalResults: number;
  searchQuery?: string;
  activeFiltersCount: number;
  className?: string;
}

export function SearchResultsHeader({ 
  totalResults, 
  searchQuery, 
  activeFiltersCount,
  className 
}: SearchResultsHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between py-4', className)}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {totalResults.toLocaleString()} {totalResults === 1 ? 'book' : 'books'} found
          {searchQuery && (
            <span className="text-muted-foreground font-normal">
              {' '}for "{searchQuery}"
            </span>
          )}
        </h2>
        {activeFiltersCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} applied
          </p>
        )}
      </div>
    </div>
  );
}
