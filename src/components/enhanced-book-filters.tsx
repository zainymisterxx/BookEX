'use client';

import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PriceRangeSlider } from '@/components/ui/price-range-slider';
import { FilterTags } from '@/components/ui/filter-tags';
import { useEnhancedSearch, SearchFilters, SortOption } from '@/hooks/use-enhanced-search';
import { cn } from '@/lib/utils';

interface EnhancedBookFiltersProps {
  genres: string[];
  conditions: string[];
  cities?: string[];
  showPriceFilter?: boolean;
  initialFilters?: Partial<SearchFilters>;
  className?: string;
}

export function EnhancedBookFilters({
  genres,
  conditions,
  cities,
  showPriceFilter = false,
  initialFilters,
  className,
}: EnhancedBookFiltersProps) {
  const {
    filters,
    updateFilter,
    clearFilter,
    clearAllFilters,
    activeFilters,
    hasActiveFilters,
    sortOptions,
  } = useEnhancedSearch({ initialFilters });

  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main search and sort row */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 bg-background rounded-lg shadow-sm border">
        {/* Search input */}
        <div className="relative flex-1">
          <Input
            placeholder="Search by title, author, or description..."
            className="pl-10 h-12 text-base"
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value: SortOption) => updateFilter('sortBy', value)}
          >
            <SelectTrigger className="w-full lg:w-[200px] h-12">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Advanced filters toggle */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="h-12 px-3"
                aria-label="Toggle advanced filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      {/* Active filters tags */}
      {hasActiveFilters && (
        <FilterTags
          activeFilters={activeFilters}
          onRemoveFilter={(key) => clearFilter(key as keyof SearchFilters)}
          onClearAll={clearAllFilters}
        />
      )}

      {/* Advanced filters */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleContent>
          <div className="p-4 bg-muted/50 rounded-lg border space-y-6">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Advanced Filters</Label>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-destructive hover:text-destructive/80"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Genre filter */}
              <div className="space-y-2">
                <Label htmlFor="genre-select">Genre</Label>
                <Select
                  value={filters.genre}
                  onValueChange={(value) => updateFilter('genre', value === 'all' ? '' : value)}
                >
                  <SelectTrigger id="genre-select">
                    <SelectValue placeholder="All genres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genres</SelectItem>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre} className="capitalize">
                        {genre.replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition filter */}
              <div className="space-y-2">
                <Label htmlFor="condition-select">Condition</Label>
                <Select
                  value={filters.condition}
                  onValueChange={(value) => updateFilter('condition', value === 'all' ? '' : value)}
                >
                  <SelectTrigger id="condition-select">
                    <SelectValue placeholder="All conditions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All conditions</SelectItem>
                    {conditions.map((condition) => (
                      <SelectItem key={condition} value={condition} className="capitalize">
                        {condition.replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* City filter (for exchange) */}
              {cities && cities.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="city-select">City</Label>
                  <Select
                    value={filters.city}
                    onValueChange={(value) => updateFilter('city', value === 'all' ? '' : value)}
                  >
                    <SelectTrigger id="city-select">
                      <SelectValue placeholder="All cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cities</SelectItem>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Price range filter (for sale books) */}
            {showPriceFilter && (
              <div className="space-y-4">
                <PriceRangeSlider
                  value={[filters.minPrice, filters.maxPrice]}
                  onValueChange={([min, max]) => {
                    updateFilter('minPrice', min);
                    updateFilter('maxPrice', max);
                  }}
                  min={0}
                  max={10000}
                  step={100}
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// Backward compatibility component that wraps the enhanced version
interface LegacyBookFiltersProps {
  genres: string[];
  conditions: string[];
  cities?: string[];
  initialState?: {
    searchQuery?: string;
    genre?: string;
    condition?: string;
    city?: string;
  };
}

export function BookFilters({ 
  genres, 
  conditions, 
  cities, 
  initialState 
}: LegacyBookFiltersProps) {
  return (
    <EnhancedBookFilters
      genres={genres}
      conditions={conditions}
      cities={cities}
      showPriceFilter={false}
      initialFilters={initialState}
    />
  );
}

// Clear button component for compatibility
export const ClearBookFiltersButton = () => {
  const { clearAllFilters } = useEnhancedSearch();
  
  return (
    <Button onClick={clearAllFilters}>
      Clear All Filters
    </Button>
  );
};
