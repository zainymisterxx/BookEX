"use client";

import { useState, useEffect, useDeferredValue } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Settings, LogOut, User as UserIcon, Bell, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut, useSession } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { AdminNotificationDropdown } from './admin-notification-dropdown';

export function AdminHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Enhanced search functionality
  useEffect(() => {
    const performSearch = async () => {
      if (deferredSearchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(deferredSearchQuery)}`);
        if (response.ok) {
          const results = await response.json();
          setSearchResults(results);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [deferredSearchQuery]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-20 items-center justify-between">
        {/* Left logo area aligned with sidebar width */}
        <div className="flex items-center justify-between px-6 lg:w-64 lg:border-r border-border h-full shrink-0">
          <Link href="/admin" className="flex items-center gap-2.5 group transition-all duration-300">
            <div className="p-1.5 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <BookOpen className="h-6 w-6" />
            </div>
            <span className="font-extrabold font-headline text-xl tracking-tight text-primary">BookEx</span>
          </Link>
          
          {/* Subtle admin indicator */}
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
            Admin
          </Badge>
        </div>

        {/* Right content area for search and actions */}
        <div className="flex-1 flex items-center justify-between px-6 h-full min-w-0">
          {/* Center - Enhanced Search */}
          <div className="flex-1 max-w-md mr-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users, reports, organizations..."
                className="pl-10 pr-4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowResults(searchResults.length > 0)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
              />
              
              {/* Search Results Dropdown */}
              {showResults && (searchResults.length > 0 || isSearching) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Search className="h-4 w-4 animate-pulse mx-auto mb-2" />
                      Searching...
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchResults.map((result, index) => (
                        <a
                          key={index}
                          href={result.href}
                          className="block px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowResults(false);
                            setSearchQuery('');
                            
                            const hashIndex = result.href.indexOf('#');
                            const targetPath = hashIndex !== -1 ? result.href.substring(0, hashIndex) : result.href;
                            const hash = hashIndex !== -1 ? result.href.substring(hashIndex) : '';
                            
                            if (window.location.pathname === targetPath) {
                              window.location.hash = hash;
                              window.dispatchEvent(new Event('hashchange'));
                            } else {
                              router.push(result.href);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              result.type === 'user' ? 'bg-blue-100 text-blue-600' :
                              result.type === 'organization' ? 'bg-green-100 text-green-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {result.type === 'user' ? <UserIcon className="h-4 w-4" /> :
                               result.type === 'organization' ? <Shield className="h-4 w-4" /> :
                               <Bell className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{result.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {result.type}
                            </Badge>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Admin actions and profile */}
          <div className="flex items-center space-x-4">
            {/* Admin notifications */}
            <AdminNotificationDropdown />

            {/* Back to main site */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                Exit Admin
              </Link>
            </Button>

            {/* Admin profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.image || ''} alt={user?.name || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    <Badge variant="secondary" className="w-fit text-xs mt-1">
                      Administrator
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile/me" className="flex items-center">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin?tab=settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex items-center">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Main Site</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
