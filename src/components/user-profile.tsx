"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  MapPin, 
  Calendar, 
  BookOpen, 
  MessageCircle, 
  UserPlus,
  Star,
  Mail,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User as UserType, Book } from '@/lib/types';
import type { Session } from 'next-auth';
import { useToast } from '@/hooks/use-toast';
import { BookCard } from '@/components/book-card';

interface UserProfileProps {
  user: UserType;
  listings: Book[];
  currentUser: Session["user"] | null;
}

export function UserProfile({ user, listings, currentUser }: UserProfileProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const { toast } = useToast();
  const isOwnProfile = currentUser?.id === user._id;

  const handleMessage = () => {
    // Navigate to messages page
    window.location.href = `/messages?user=${user._id}`;
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    toast({
      title: isFollowing ? 'Unfollowed' : 'Following',
      description: isFollowing 
        ? `You are no longer following ${user.name}` 
        : `You are now following ${user.name}`
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="text-2xl font-semibold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  
                  {user.city && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{user.city}</span>
                    </div>
                  )}
                  
                  {user.createdAt && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Joined {formatDate(user.createdAt)}</span>
                    </div>
                  )}
                </div>

                {/* Rating */}
                {user.averageRating && user.reviews && user.reviews > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4",
                            i < Math.floor(user.averageRating!)
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.averageRating.toFixed(1)} ({user.reviews} reviews)
                    </span>
                  </div>
                )}

                {/* Bio */}
                {user.bio && (
                  <div className="text-center">
                    <p className="text-muted-foreground">{user.bio}</p>
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-2 w-full">
                  {user.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {!isOwnProfile && (
                  <div className="flex gap-2 w-full">
                    <Button 
                      onClick={handleMessage}
                      className="flex-1"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={handleFollow}
                      className="flex-1"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listings */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Books for {user.type === 'sell' ? 'Sale' : 'Exchange'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listings.map((book) => (
                    <BookCard key={book._id} book={book} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No books listed yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
