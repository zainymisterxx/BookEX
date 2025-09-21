
"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, MoreHorizontal, UserPlus, UserMinus, Users, Send, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import React, { useState, useTransition, useEffect } from 'react';
import type { Community, Post, User, Comment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AuthModal } from '@/components/auth-modal';
import { cn } from '@/lib/utils';
import { toggleCommunityMembership, createPost, togglePostLike, addComment } from '@/app/actions';
import { Input } from '@/components/ui/input';
import type { Session } from 'next-auth';
import { useSocket } from '@/components/socket-provider';

interface CommunityDetailClientProps {
    initialCommunity: Community;
    initialPosts: Post[];
    initialPagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    communityId: string;
    currentUser: Session["user"] | null;
}

export function CommunityDetailClient({ 
  initialCommunity, 
  initialPosts, 
  initialPagination,
  communityId, 
  currentUser 
}: CommunityDetailClientProps) {
  const [community, setCommunity] = useState<Community>(initialCommunity);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [newPostContent, setNewPostContent] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(initialPagination?.page || 1);
  const [totalPages, setTotalPages] = useState(initialPagination?.pages || 1);
  const [totalPosts, setTotalPosts] = useState(initialPagination?.total || initialPosts.length);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const postsPerPage = initialPagination?.limit || 10;

  const [isPending, startTransition] = useTransition();

  const user = currentUser;
  const { toast } = useToast();
  const { 
    joinCommunity, 
    leaveCommunity, 
    emitPostCreated, 
    emitCommentCreated, 
    emitPostLiked,
    onNewPost, 
    onNewComment, 
    onPostLikeUpdate,
    offNewPost,
    offNewComment,
    offPostLikeUpdate,
    isConnected 
  } = useSocket();

  // Function to load posts with pagination and retry mechanism
  const loadPosts = async (page: number = 1, attempt: number = 1) => {
    setIsLoadingPosts(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/communities/${communityId}/posts?page=${page}&limit=${postsPerPage}`);
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
        setTotalPosts(data.pagination.total);
        setRetryCount(0); // Reset retry count on success
      } else if (response.status >= 500 && attempt < maxRetries) {
        // Retry on server errors
        setTimeout(() => loadPosts(page, attempt + 1), 1000 * attempt);
        setRetryCount(attempt);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load posts' }));
        setError(errorData.error || 'Failed to load posts');
        toast({ variant: 'destructive', title: 'Failed to load posts', description: errorData.error });
      }
    } catch (error) {
      if (attempt < maxRetries) {
        // Retry on network errors
        setTimeout(() => loadPosts(page, attempt + 1), 1000 * attempt);
        setRetryCount(attempt);
      } else {
        console.error('Error loading posts after retries:', error);
        setError('Network error. Please check your connection and try again.');
        toast({ variant: 'destructive', title: 'Network Error', description: 'Please check your connection and try again.' });
      }
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // Join/leave community room when component mounts/unmounts or user membership changes
  useEffect(() => {
    if (isConnected && user && community.members?.includes(user.id)) {
      joinCommunity(communityId);
    }

    return () => {
      if (isConnected) {
        leaveCommunity(communityId);
      }
    };
  }, [isConnected, user, community.members, communityId, joinCommunity, leaveCommunity]);

  // Set up real-time event listeners
  useEffect(() => {
    const handleNewPost = (data: { communityId: string; post: Post; timestamp: string }) => {
      if (data.communityId === communityId) {
        if (currentPage === 1) {
          // Only add to current posts if we're on the first page
          setPosts(prevPosts => {
            const exists = prevPosts.some(p => String(p._id) === String(data.post._id));
            if (!exists) {
              return [data.post, ...prevPosts.slice(0, postsPerPage - 1)]; // Keep only the limit
            }
            return prevPosts;
          });
        }
        // Update total count
        setTotalPosts(prev => prev + 1);
        setTotalPages(Math.ceil((totalPosts + 1) / postsPerPage));
      }
    };

    const handleNewComment = (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => {
      if (data.communityId === communityId) {
        setPosts(prevPosts => prevPosts.map(p => {
          if (String(p._id) === data.postId) {
            // Only add if comment doesn't already exist
            const exists = p.comments?.some(c => String(c._id) === String(data.comment._id));
            if (!exists) {
              return { ...p, comments: [...(p.comments || []), data.comment] };
            }
          }
          return p;
        }));
      }
    };

    const handlePostLikeUpdate = (data: { communityId: string; postId: string; userId: string; liked: boolean; timestamp: string }) => {
      if (data.communityId === communityId) {
        setPosts(prevPosts => prevPosts.map(p => {
          if (String(p._id) === data.postId) {
            const likedBy = p.likedBy || [];
            let newLikedBy: string[];
            let newLikes: number;

            if (data.liked) {
              // User liked the post
              if (!likedBy.includes(data.userId)) {
                newLikedBy = [...likedBy, data.userId];
                newLikes = (p.likes || 0) + 1;
              } else {
                newLikedBy = likedBy;
                newLikes = p.likes || 0;
              }
            } else {
              // User unliked the post
              newLikedBy = likedBy.filter(id => id !== data.userId);
              newLikes = Math.max(0, (p.likes || 0) - 1);
            }

            return { ...p, likedBy: newLikedBy, likes: newLikes };
          }
          return p;
        }));
      }
    };

    // Register event listeners
    onNewPost(handleNewPost);
    onNewComment(handleNewComment);
    onPostLikeUpdate(handlePostLikeUpdate);

    // Cleanup event listeners
    return () => {
      offNewPost(handleNewPost);
      offNewComment(handleNewComment);
      offPostLikeUpdate(handlePostLikeUpdate);
    };
  }, [communityId, onNewPost, onNewComment, onPostLikeUpdate, offNewPost, offNewComment, offPostLikeUpdate]);
  
  const handleToggleMembership = async () => {
      if (!user || !community) {
          toast({ 
            variant: 'destructive', 
            title: 'Authentication Required', 
            description: 'You must be logged in to join communities.' 
          });
          return;
      }
      
      const isMember = community.members?.includes(user.id) ?? false;
      const originalCommunity = { ...community };
      
      // Optimistic update
      setCommunity(prev => {
          if (!prev) return prev;
          const newMembers = isMember ? prev.members.filter(id => id !== user.id) : [...prev.members, user.id];
          return { ...prev, members: newMembers, memberCount: newMembers.length };
      });

      startTransition(async () => {
          try {
            const result = await toggleCommunityMembership(communityId, isMember);
            if (result.success) {
              toast({ 
                title: isMember ? `Left ${community?.name}` : `Welcome to ${community?.name}!`,
                description: isMember ? 'You have been removed from this community.' : 'You are now a member of this community.'
              });
              
              // Join/leave community room based on new membership status
              if (isConnected) {
                if (isMember) {
                  leaveCommunity(communityId);
                } else {
                  joinCommunity(communityId);
                }
                
                // Note: Real-time updates are handled by the socket provider
                // No need to emit server-side events from client components
              }
            } else {
              // Revert optimistic update
              setCommunity(originalCommunity);
              toast({ 
                variant: 'destructive', 
                title: 'Membership Update Failed',
                description: result.message || 'Unable to update your membership. Please try again.'
              });
            }
          } catch (error) {
            // Revert optimistic update
            setCommunity(originalCommunity);
            console.error('Error toggling membership:', error);
            toast({ 
              variant: 'destructive', 
              title: 'Network Error',
              description: 'Unable to connect to the server. Please check your connection and try again.'
            });
          }
      });
  }

  const handleCreatePost = async () => {
    if (!user) {
      toast({ 
        variant: 'destructive', 
        title: 'Authentication Required',
        description: 'You must be logged in to create posts.' 
      });
      return;
    }
    
    const trimmedContent = newPostContent.trim();
    if (!trimmedContent) {
      toast({ 
        variant: 'destructive', 
        title: 'Content Required',
        description: 'Please enter some content for your post.' 
      });
      return;
    }
    
    if (trimmedContent.length > 2000) {
      toast({ 
        variant: 'destructive', 
        title: 'Content Too Long',
        description: 'Posts cannot exceed 2000 characters.' 
      });
      return;
    }

    const originalPosts = [...posts];
    const tempPost: Post = {
      _id: `temp-${Date.now()}`,
      content: trimmedContent,
      authorId: user.id,
      communityId,
      likes: 0,
      createdAt: new Date().toISOString(),
      likedBy: [],
      comments: []
    };

    // Optimistic update
    setPosts(prevPosts => [tempPost, ...prevPosts]);
    setNewPostContent('');
    const originalContent = newPostContent;

    startTransition(async () => {
        try {
          const result = await createPost(communityId, { authorId: user.id, content: trimmedContent });
          if (result.success && result.newPost) {
              // Replace temp post with real post
              setPosts(prevPosts => prevPosts.map(p => 
                String(p._id) === String(tempPost._id) ? result.newPost! : p
              ));
              
              // Reload posts to get updated pagination info if needed
              if (currentPage === 1) {
                loadPosts(1);
              }
              
              // Emit real-time update for new post
              try {
                emitPostCreated(communityId, result.newPost);
              } catch (emitError) {
                console.warn('Failed to emit real-time post creation:', emitError);
              }
              
              toast({ title: 'Post created successfully!' });
            } else {
              // Revert optimistic update
              setPosts(originalPosts);
              setNewPostContent(originalContent);
              toast({ 
                variant: 'destructive', 
                title: 'Failed to create post',
                description: result.message || 'Please try again.' 
              });
            }
        } catch (error) {
          // Revert optimistic update
          setPosts(originalPosts);
          setNewPostContent(originalContent);
          console.error('Error creating post:', error);
          toast({ 
            variant: 'destructive', 
            title: 'Network Error',
            description: 'Unable to create post. Please check your connection and try again.' 
          });
        }
    });
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to like posts.' });
      return;
    }

    const post = posts.find(p => String(p._id) === postId);
    if (!post) return;
    
    const isLiked = post.likedBy?.includes(user.id);

    // Optimistic update
    setPosts(prevPosts => prevPosts.map(p => {
        if (String(p._id) === postId) {
            const newLikedBy = isLiked ? p.likedBy?.filter(id => id !== user.id) : [...(p.likedBy || []), user.id];
            return { ...p, likedBy: newLikedBy, likes: newLikedBy?.length || 0 };
        }
        return p;
    }));

    startTransition(async () => {
        const result = await togglePostLike(communityId, postId, !!isLiked);
        if (!result.success) {
            // Revert optimistic update on failure
            setPosts(prevPosts => prevPosts.map(p => (String(p._id) === postId ? post : p)));
            toast({ variant: 'destructive', title: 'Failed to update like status.' });
        } else {
            // Emit real-time update for like toggle
            try {
              emitPostLiked(communityId, postId, user.id, !isLiked);
            } catch (emitError) {
              console.warn('Failed to emit real-time like update:', emitError);
            }
        }
    });
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!user) return;
    if (!content.trim()) return;

    startTransition(async () => {
        const result = await addComment(communityId, postId, content);
        if (result.success && result.newComment) {
            setPosts(prevPosts => prevPosts.map(p => {
                if (String(p._id) === postId) {
                    return { ...p, comments: [...(p.comments || []), result.newComment!] };
                }
                return p;
            }));
            
            // Emit real-time update for new comment
            try {
              emitCommentCreated(communityId, postId, result.newComment);
            } catch (emitError) {
              console.warn('Failed to emit real-time comment creation:', emitError);
            }
        } else {
            toast({ variant: "destructive", title: "Failed to post comment." });
        }
    });
  };
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
  
  const isMember = user ? community.members?.includes(user.id) : false;

  return (
    <div className="bg-secondary min-h-screen">
      <div className="container py-4 md:py-12 px-4 md:px-6">
        <Card className="mb-4 md:mb-8 border-2 shadow-xl shadow-primary/10">
          <CardHeader className="p-4 md:p-8">
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex-1">
                <h1 className="text-2xl md:text-4xl font-bold font-headline text-primary leading-tight">{community.name}</h1>
                <div className="flex flex-wrap items-center gap-3 md:gap-6 text-muted-foreground mt-2 text-sm md:text-base">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 md:h-5 md:w-5" />
                    <span>{community.memberCount.toLocaleString()} members</span>
                  </div>
                </div>
                <p className="mt-3 md:mt-4 text-foreground/80 text-sm md:text-lg leading-relaxed">{community.description}</p>
              </div>
              <div className="md:ml-auto flex-shrink-0 self-start w-full md:w-auto">
                {user ? (
                  <Button 
                    size="lg" 
                    className="py-3 md:py-6 w-full md:w-auto" 
                    onClick={handleToggleMembership} 
                    disabled={isPending}
                  >
                      {isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin"/>
                      ) : isMember ? (
                          <UserMinus className="mr-2 h-4 w-4 md:h-5 md:w-5"/>
                      ) : (
                          <UserPlus className="mr-2 h-4 w-4 md:h-5 md:w-5"/>
                      )}
                      <span className="hidden sm:inline">
                        {isMember ? 'Leave Community' : 'Join Community'}
                      </span>
                      <span className="sm:hidden">
                        {isMember ? 'Leave' : 'Join'}
                      </span>
                  </Button>
                ) : (
                    <AuthModal>
                      <Button size="lg" className="py-3 md:py-6 w-full md:w-auto">
                        <UserPlus className="mr-2 h-4 w-4 md:h-5 md:w-5"/> 
                        <span className="hidden sm:inline">Join Community</span>
                        <span className="sm:hidden">Join</span>
                      </Button>
                    </AuthModal>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {user ? (
              isMember ? (
                <Card className="border-2 shadow-lg shadow-primary/5">
                  <CardHeader className="p-4 md:p-6">
                    <h2 className="font-headline text-lg md:text-xl font-semibold">Create a Post</h2>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6 pt-0">
                    <Textarea
                      placeholder={`What's on your mind, ${user.name}?`}
                      rows={3}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      disabled={isPending}
                      className="resize-none text-sm md:text-base"
                    />
                  </CardContent>
                  <CardFooter className="p-4 md:p-6 pt-0 flex justify-end">
                    <Button 
                      onClick={handleCreatePost} 
                      disabled={isPending || !newPostContent.trim()}
                      className="w-full sm:w-auto"
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Post
                    </Button>
                  </CardFooter>
                </Card>
              ) : null
            ) : (
              <Card className="border-2 shadow-lg shadow-primary/5 text-center p-4 md:p-8">
                  <h3 className="font-headline text-lg md:text-xl font-semibold">Join the conversation!</h3>
                  <p className="text-muted-foreground mt-2 mb-4 text-sm md:text-base">You need to be logged in to create a post.</p>
                  <AuthModal>
                    <Button className="w-full sm:w-auto">Login to Post</Button>
                  </AuthModal>
              </Card>
            )}
            
            <div className="space-y-6">
              {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">Failed to load posts</p>
                          <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadPosts(currentPage)}
                        disabled={isLoadingPosts}
                      >
                        {isLoadingPosts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {posts.map((post, index) => {
                const isLiked = user ? post.likedBy?.includes(user.id) : false;
                const postId = String(post._id);
                return (
                  <React.Fragment key={postId}>
                    {user && !isMember && index === 2 && (
                        <Card className="border-2 shadow-lg shadow-primary/5 text-center p-8 bg-accent/10 border-accent/50">
                            <h3 className="font-headline text-xl font-semibold text-accent-foreground">Join the conversation!</h3>
                            <p className="text-muted-foreground mt-2 mb-4">You must be a member to like posts and add comments.</p>
                            <Button onClick={handleToggleMembership} disabled={isPending}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Join Community
                            </Button>
                        </Card>
                    )}
                    <Card className="border-2 shadow-lg shadow-primary/5">
                      <CardHeader className="p-4 md:p-6">
                          <div className="flex items-start gap-3 md:gap-4">
                              {post.author ? (
                                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 flex-shrink-0">
                                    <AvatarImage src={post.author.avatarUrl} alt={post.author.name} />
                                    <AvatarFallback className="text-sm">{post.author.name?.charAt(0) || 'A'}</AvatarFallback>
                                </Avatar>
                              ) : <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-muted flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                      <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-sm md:text-base truncate">{post.author?.name || 'Anonymous'}</p>
                                          <p className="text-xs md:text-sm text-muted-foreground">{formatDate(post.createdAt)}</p>
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0 ml-2">
                                          <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6 pt-0">
                          <p className="text-sm md:text-base leading-relaxed break-words">{post.content}</p>
                      </CardContent>
                      <CardFooter className="flex-col items-start gap-3 md:gap-4 border-t pt-3 md:pt-4 mt-3 md:mt-4 px-4 md:px-6 pb-4 md:pb-6">
                          <div className="flex items-center gap-2 md:gap-4 w-full">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex items-center gap-2 text-muted-foreground hover:text-destructive flex-1 justify-start h-9 md:h-10" 
                                onClick={() => handleLikePost(postId)} 
                                disabled={!isMember}
                              >
                                  <Heart className={cn("h-4 w-4 md:h-5 md:w-5", isLiked && "fill-destructive text-destructive")} />
                                  <span className="text-sm">{post.likes}</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex items-center gap-2 text-muted-foreground flex-1 justify-start h-9 md:h-10"
                              >
                                  <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
                                  <span className="text-sm">{post.comments?.length || 0}</span>
                              </Button>
                          </div>
                          <div className="w-full space-y-3 md:space-y-4 pt-3 md:pt-4">
                              {post.comments?.map(comment => (
                                  <div key={String(comment._id)} className="flex items-start gap-3">
                                      <Avatar className="h-7 w-7 md:h-8 md:w-8 border-2 flex-shrink-0">
                                          <AvatarImage src={comment.author?.avatarUrl} alt={comment.author?.name} />
                                          <AvatarFallback className="text-xs">{comment.author?.name?.charAt(0) || 'A'}</AvatarFallback>
                                      </Avatar>
                                      <div className="bg-secondary/70 p-3 rounded-lg flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                              <p className="font-semibold text-xs md:text-sm truncate">{comment.author?.name}</p>
                                              <p className="text-xs text-muted-foreground flex-shrink-0">{formatDate(comment.createdAt)}</p>
                                          </div>
                                          <p className="text-xs md:text-sm break-words">{comment.content}</p>
                                      </div>
                                  </div>
                              ))}
                              {isMember && user && (
                                <CommentForm postId={postId} onAddComment={handleAddComment} isPending={isPending} user={user} />
                              )}
                          </div>
                      </CardFooter>
                    </Card>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 md:pt-6">
                <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-left">
                  Showing {((currentPage - 1) * postsPerPage) + 1} to {Math.min(currentPage * postsPerPage, totalPosts)} of {totalPosts} posts
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPosts(currentPage - 1)}
                    disabled={currentPage === 1 || isLoadingPosts}
                    className="h-8 md:h-9 px-2 md:px-3"
                  >
                    <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  
                  {/* Mobile-friendly page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => loadPosts(pageNum)}
                          disabled={isLoadingPosts}
                          className="w-8 h-8 md:w-9 md:h-9 p-0 text-xs md:text-sm"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPosts(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoadingPosts}
                    className="h-8 md:h-9 px-2 md:px-3"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Loading indicator for pagination */}
            {isLoadingPosts && (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    {retryCount > 0 ? `Retrying... (${retryCount}/${maxRetries})` : 'Loading posts...'}
                  </span>
                </div>
              </div>
            )}

          </div>
          <div className="lg:col-span-1 order-first lg:order-last">
            <Card className="sticky top-4 border-2 shadow-xl shadow-primary/10">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="font-headline text-lg md:text-xl">About {community.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-3 md:space-y-4 text-xs md:text-sm text-muted-foreground">
                <p className="leading-relaxed">This is a space for all things related to {community.name}. Feel free to post questions, start discussions, and share reviews.</p>
                <p className="leading-relaxed">Please be respectful of all members.</p>
                
                {/* Mobile stats */}
                <div className="lg:hidden pt-4 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Members</span>
                    <span className="text-primary font-semibold">{community.memberCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Posts</span>
                    <span className="text-primary font-semibold">{totalPosts.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentForm({ postId, onAddComment, isPending, user }: { postId: string, onAddComment: (postId: string, content: string) => void, isPending: boolean, user: Session["user"] }) {
    const [comment, setComment] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddComment(postId, comment);
        setComment('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-3 w-full pt-2">
            <Avatar className="h-8 w-8 border-2 flex-shrink-0">
                <AvatarImage src={user?.image || undefined} />
                <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative min-w-0">
                <Input 
                    placeholder="Write a comment..." 
                    value={comment} 
                    onChange={(e) => setComment(e.target.value)}
                    disabled={isPending}
                    className="h-9 md:h-10 text-sm pr-12"
                />
                 <Button 
                   type="submit" 
                   size="icon" 
                   className="h-7 w-7 md:h-8 md:w-8 absolute right-1 top-1/2 -translate-y-1/2" 
                   disabled={isPending || !comment.trim()}
                 >
                    {isPending ? <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" /> : <Send className="h-3 w-3 md:h-4 md:w-4" />}
                </Button>
            </div>
        </form>
    );
}
