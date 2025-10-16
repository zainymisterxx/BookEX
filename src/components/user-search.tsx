"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, User, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface User {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

interface UserSearchProps {
  onUserSelect: (user: User) => void;
  placeholder?: string;
  className?: string;
}

export function UserSearch({ onUserSelect, placeholder = "Search users by username...", className }: UserSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { toast } = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length < 2) {
      setUsers([]);
      setShowResults(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiFetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
          setShowResults(true);
          setSelectedIndex(-1);
        } else {
          throw new Error('Search failed');
        }
      } catch (error) {
        console.error('Search error:', error);
        toast({
          variant: 'destructive',
          title: 'Search Error',
          description: 'Failed to search users. Please try again.'
        });
        setUsers([]);
        setShowResults(false);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, toast]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || users.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < users.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < users.length) {
          handleUserSelect(users[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleUserSelect = (user: User) => {
    onUserSelect(user);
    setSearchQuery('');
    setUsers([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const displayName = (user: User) => {
    if (user.username) {
      return `@${user.username}`;
    }
    return user.name;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (users.length > 0) setShowResults(true);
          }}
          className="pl-10 pr-4"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto shadow-lg">
          <CardContent className="p-0">
            {users.length > 0 ? (
              users.map((user, index) => (
                <div
                  key={user._id}
                  className={cn(
                    "flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/50 transition-colors border-b last:border-b-0",
                    selectedIndex === index && "bg-secondary/70"
                  )}
                  onClick={() => handleUserSelect(user)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback>
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{displayName(user)}</div>
                    {user.username && user.name && (
                      <div className="text-sm text-muted-foreground truncate">{user.name}</div>
                    )}
                  </div>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            ) : searchQuery.length >= 2 && !isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <User className="h-12 w-12 mb-3 opacity-50" />
                <p className="font-medium">No users found</p>
                <p className="text-sm">Try searching for a different username</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}