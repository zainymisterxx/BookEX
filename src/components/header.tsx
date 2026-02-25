
"use client";

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { BookOpen, Bell, Search, Menu, LogOut, User as UserIcon, Settings, PlusCircle, MessageSquare, CheckCircle, Loader2, Repeat2 } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AuthModal } from './auth-modal';
import type { Notification } from '@/lib/types';
import { Badge } from './ui/badge';
import { getUserNotifications, markNotificationsAsRead } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from './notification-provider';

const navLinks = [
  { href: '/books', label: 'Buy' },
  { href: '/exchange', label: 'Exchange' },
  { href: '/community', label: 'Community' },
  { href: '/messages', label: 'Chat' },
  { href: '/donate', label: 'Donate' },
];

export function Header() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const { notifications, unreadCount, isLoading: isNotifLoading, markAllAsRead, refreshNotifications } = useNotifications();

  useEffect(() => {
    // Refresh notifications when user changes
    if (user?.id) {
      refreshNotifications();
    }
  }, [user?.id]); // Only trigger when user ID changes, not user object reference

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/');
    router.refresh();
  };

  const handleMarkAsRead = async () => {
      if (!user || unreadCount === 0) return;
      
      startTransition(async () => {
        const result = await markNotificationsAsRead();
        if (result.success) {
            markAllAsRead();
        } else {
            toast({ variant: 'destructive', title: 'Could not mark notifications as read.' });
        }
      });
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/books?searchQuery=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="font-bold font-headline text-xl text-primary">BookEx</span>
          </Link>
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="flex flex-col gap-4 p-4">
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-7 w-7 text-primary" />
                  <span className="font-bold font-headline text-xl text-primary">BookEx</span>
                </Link>
                <nav className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-lg font-medium text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <nav className="hidden md:flex md:items-center md:gap-6 text-base ml-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
          <form onSubmit={handleSearchSubmit} className="relative hidden sm:block w-full max-w-xs">
            <Input 
              type="search" 
              placeholder="Search books..." 
              className="pl-10 h-11" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </form>

          {status === 'loading' ? (
            <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
          ) : user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex justify-between items-center">
                    Notifications
                    {unreadCount > 0 && <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleMarkAsRead} disabled={isPending}>Mark all as read</Button>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isNotifLoading ? (
                    <div className="flex justify-center items-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map(notif => (
                        <DropdownMenuItem key={String(notif._id)} asChild className="cursor-pointer">
                            <Link href={notif.link || '#'} className="flex flex-col items-start !whitespace-normal">
                                <p className={notif.read ? 'text-muted-foreground' : 'font-semibold'}>{notif.message}</p>
                                <p className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleString()}</p>
                            </Link>
                        </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem className="justify-center text-muted-foreground">
                      <CheckCircle className="mr-2 h-4 w-4"/> You're all caught up!
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-11 w-11 rounded-full">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                      <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile/me"><UserIcon className="mr-2 h-4 w-4" />My Profile</Link>
                  </DropdownMenuItem>
                   <DropdownMenuItem asChild>
                    <Link href="/messages"><MessageSquare className="mr-2 h-4 w-4" />Messages</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/exchange/history"><Repeat2 className="mr-2 h-4 w-4" />Exchange History</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/books/sell"><PlusCircle className="mr-2 h-4 w-4" />List a Book</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
             <div className="flex items-center gap-2">
                <AuthModal initialTab="login">
                    <Button variant="outline" size="lg">Login</Button>
                </AuthModal>
                <AuthModal initialTab="signup">
                    <Button size="lg">Sign Up</Button>
                </AuthModal>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
