
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ListFilter, Search, X } from "lucide-react";

interface BookFiltersProps {
    genres: string[];
    conditions: string[];
    cities?: string[];
    initialState?: {
        searchQuery?: string;
        genre?: string;
        condition?: string;
        city?: string;
    }
}

export function BookFilters({ genres, conditions, cities, initialState }: BookFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(initialState?.searchQuery || '');
  const [selectedGenre, setSelectedGenre] = useState(initialState?.genre || '');
  const [selectedCondition, setSelectedCondition] = useState(initialState?.condition || '');
  const [selectedCity, setSelectedCity] = useState(initialState?.city || '');
  
  const createQueryString = (params: Record<string, string | undefined>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        newSearchParams.set(key, value);
      } else {
        newSearchParams.delete(key);
      }
    }
    return newSearchParams.toString();
  };

  // Effect to update URL when a filter changes
  useEffect(() => {
    // A small debounce to prevent excessive re-renders while typing
    const handler = setTimeout(() => {
        const query = createQueryString({ 
            searchQuery, 
            genre: selectedGenre, 
            condition: selectedCondition, 
            city: selectedCity 
        });
        router.push(`${pathname}?${query}`);
    }, 300);

    return () => clearTimeout(handler);

  }, [searchQuery, selectedGenre, selectedCondition, selectedCity, router, pathname]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGenre('');
    setSelectedCondition('');
    setSelectedCity('');
  };

  const hasActiveFilters = !!searchQuery || !!selectedGenre || !!selectedCondition || !!selectedCity;

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 bg-background rounded-lg shadow-sm border">
        <div className="relative flex-1">
        <Input 
            placeholder="Search by title or author..." 
            className="pl-10 h-12 text-base" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex gap-2">
            {cities && (
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full md:w-auto h-12 text-base">
                          <ListFilter className="mr-2 h-4 w-4"/>
                          {selectedCity ? selectedCity : "City"}
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Filter by City</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {cities.map(city => (
                        <DropdownMenuItem key={city} onSelect={() => setSelectedCity(city)}>{city}</DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full md:w-auto h-12 text-base">
                        <ListFilter className="mr-2 h-4 w-4"/>
                        {selectedGenre ? selectedGenre : "Genre"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Filter by Genre</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {genres.map(genre => (
                    <DropdownMenuItem key={genre} onSelect={() => setSelectedGenre(genre)}>{genre}</DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full md:w-auto h-12 text-base capitalize">
                        <ListFilter className="mr-2 h-4 w-4"/>
                        {selectedCondition ? selectedCondition.replace('-', ' ') : "Condition"}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Filter by Condition</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {conditions.map(condition => (
                    <DropdownMenuItem key={condition} onSelect={() => setSelectedCondition(condition)} className="capitalize">{condition.replace('-', ' ')}</DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="h-12">
                <X className="mr-2 h-4 w-4"/>
                Clear
            </Button>
            )}
        </div>
    </div>
  );
}

export const ClearBookFiltersButton = () => {
    const router = useRouter();
    const pathname = usePathname();
    return (
        <Button onClick={() => router.push(pathname)}>Clear All Filters</Button>
    )
}
