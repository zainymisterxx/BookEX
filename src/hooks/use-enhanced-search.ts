'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type SortOption = 
  | 'relevance' 
  | 'price-low' 
  | 'price-high' 
  | 'newest' 
  | 'oldest' 
  | 'title-asc' 
  | 'title-desc';

export interface SearchFilters {
  searchQuery: string;
  genre: string;
  condition: string;
  city: string;
  minPrice: number;
  maxPrice: number;
  sortBy: SortOption;
}

export interface UseEnhancedSearchProps {
  initialFilters?: Partial<SearchFilters>;
  debounceMs?: number;
}

export interface ActiveFilter {
  key: keyof SearchFilters;
  label: string;
  value: string | number;
  displayValue: string;
}

export function useEnhancedSearch({ 
  initialFilters = {}, 
  debounceMs = 300 
}: UseEnhancedSearchProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Default filter values
  const defaultFilters: SearchFilters = {
    searchQuery: '',
    genre: '',
    condition: '',
    city: '',
    minPrice: 0,
    maxPrice: 10000,
    sortBy: 'relevance',
    ...initialFilters,
  };

  // State for all search filters
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    searchQuery: initialFilters.searchQuery || '',
    genre: initialFilters.genre || '',
    condition: initialFilters.condition || '',
    city: initialFilters.city || '',
    minPrice: initialFilters.minPrice || 0,
    maxPrice: initialFilters.maxPrice || 10000,
    sortBy: initialFilters.sortBy || 'relevance',
  }));

  // Highlight matching terms in search results
  const highlightSearchTerm = (text: string, searchTerm: string): string => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  };

  // Get active filters as chips/tags
  const activeFilters = useMemo((): ActiveFilter[] => {
    const active: ActiveFilter[] = [];

    if (filters.searchQuery) {
      active.push({
        key: 'searchQuery',
        label: 'Search',
        value: filters.searchQuery,
        displayValue: `"${filters.searchQuery}"`,
      });
    }

    if (filters.genre) {
      active.push({
        key: 'genre',
        label: 'Genre',
        value: filters.genre,
        displayValue: filters.genre.charAt(0).toUpperCase() + filters.genre.slice(1),
      });
    }

    if (filters.condition) {
      active.push({
        key: 'condition',
        label: 'Condition',
        value: filters.condition,
        displayValue: filters.condition.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      });
    }

    if (filters.city) {
      active.push({
        key: 'city',
        label: 'City',
        value: filters.city,
        displayValue: filters.city,
      });
    }

    if (filters.minPrice > 0 || filters.maxPrice < 10000) {
      active.push({
        key: 'minPrice',
        label: 'Price Range',
        value: `${filters.minPrice}-${filters.maxPrice}`,
        displayValue: `Rs. ${filters.minPrice.toLocaleString()} - Rs. ${filters.maxPrice.toLocaleString()}`,
      });
    }

    if (filters.sortBy !== 'relevance') {
      const sortLabels: Record<SortOption, string> = {
        'relevance': 'Relevance',
        'price-low': 'Price: Low to High',
        'price-high': 'Price: High to Low',
        'newest': 'Newest First',
        'oldest': 'Oldest First',
        'title-asc': 'Title: A to Z',
        'title-desc': 'Title: Z to A',
      };

      active.push({
        key: 'sortBy',
        label: 'Sort',
        value: filters.sortBy,
        displayValue: sortLabels[filters.sortBy],
      });
    }

    return active;
  }, [filters]);

  // Create URL query string from filters
  const createQueryString = (newFilters: Partial<SearchFilters>): string => {
    const urlParams = new URLSearchParams(searchParams.toString());
    
    const updatedFilters = { ...filters, ...newFilters };
    
    // Set or remove parameters based on their values
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value === '' || value === 0 || 
          (key === 'maxPrice' && value === 10000) || 
          (key === 'sortBy' && value === 'relevance')) {
        urlParams.delete(key);
      } else {
        urlParams.set(key, String(value));
      }
    });

    return urlParams.toString();
  };

  // Update a specific filter
  const updateFilter = (key: keyof SearchFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Update multiple filters at once
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Clear a specific filter
  const clearFilter = (key: keyof SearchFilters) => {
    const defaultValue = key === 'maxPrice' ? 10000 : 
                        key === 'sortBy' ? 'relevance' : 
                        (typeof defaultFilters[key] === 'number' ? 0 : '');
    updateFilter(key, defaultValue);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters(defaultFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Debounced URL update
  useEffect(() => {
    const handler = setTimeout(() => {
      const queryString = createQueryString(filters);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [filters, pathname, router, debounceMs]);

  // Sort options for dropdown
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title-asc', label: 'Title: A to Z' },
    { value: 'title-desc', label: 'Title: Z to A' },
  ];

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilter,
    clearAllFilters,
    activeFilters,
    hasActiveFilters,
    highlightSearchTerm,
    sortOptions,
  };
}
