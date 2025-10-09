"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { 
  Heart, 
  MessageCircle, 
  MoreHorizontal, 
  Send, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Crown,
  Shield,
  User,
  Trash2,
  Edit,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Post, Comment, CommunityRole } from '@/lib/types';
import type { Session } from 'next-auth';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/components/socket-provider';

interface ForumChannelProps {
  channelId: string;
  communityId: string;
  currentUser: Session["user"] | null;
  userRole: CommunityRole | null;
  isMember: boolean;
}

export function ForumChannel({ 
  channelId, 
  communityId, 
  currentUser, 
  userRole, 
  isMember 
}: ForumChannelProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { 
    joinChannel, 
    leaveChannel, 
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

  const postsPerPage = 10;

  // Load posts for this channel
  const loadPosts = async (page: number = 1) => {
    setIsLoadingPosts(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/posts?page=${page}&limit=${postsPerPage}`);
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load posts' }));
        setError(errorData.error || 'Failed to load posts');
        toast({ variant: 'destructive', title: 'Failed to load posts', description: errorData.error });
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      setError('Network error. Please check your connection and try again.');
      toast({ variant: 'destructive', title: 'Network Error', description: 'Please check your connection and try again.' });
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // Join/leave channel room
  useEffect(() => {
    if (isConnected && isMember) {
      joinChannel(channelId, communityId);
    }

    return () => {
      if (isConnected) {
        leaveChannel(channelId);
      }
    };
  }, [isConnected, isMember, channelId, communityId, joinChannel, leaveChannel]);

  // Set up real-time event listeners
  useEffect(() => {
    const handleNewPost = (data: { communityId: string; post: Post; timestamp: string }) => {
      if (data.communityId === communityId) {
        if (currentPage === 1) {
          setPosts(prevPosts => {
            const exists = prevPosts.some(p => String(p._id) === String(data.post._id));
            if (!exists) {
              return [data.post, ...prevPosts.slice(0, postsPerPage - 1)];
            }
            return prevPosts;
          });
        }
      }
    };

    const handleNewComment = (data: { communityId: string; postId: string; comment: Comment; timestamp: string }) => {
      if (data.communityId === communityId) {
        setPosts(prevPosts => prevPosts.map(p => {
          if (String(p._id) === data.postId) {
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
              if (!likedBy.includes(data.userId)) {
                newLikedBy = [...likedBy, data.userId];
                newLikes = (p.likes || 0) + 1;
              } else {
                newLikedBy = likedBy;
                newLikes = p.likes || 0;
              }
            } else {
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
  }, [channelId, onNewPost, onNewComment, onPostLikeUpdate, offNewPost, offNewComment, offPostLikeUpdate, currentPage]);

  // Load initial posts
  useEffect(() => {
    loadPosts(1);
  }, [channelId]);

  const handleCreatePost = async () => {
    if (!currentUser || !isMember) {
      toast({ variant: 'destructive', title: 'Authentication Required', description: 'You must be logged in to create posts.' });
      return;
    }
    
    const trimmedContent = newPostContent.trim();
    if (!trimmedContent) {
      toast({ variant: 'destructive', title: 'Content Required', description: 'Please enter some content for your post.' });
      return;
    }

    const originalPosts = [...posts];
    const tempPost: Post = {
      _id: `temp-${Date.now()}`,
      content: trimmedContent,
      authorId: currentUser.id,
      communityId,
      likes: 0,
      createdAt: new Date().toISOString(),
      likedBy: [],
      comments: []
    };

    // Optimistic update
    setPosts(prevPosts => [tempPost, ...prevPosts]);
    setNewPostContent('');

    startTransition(async () => {
      try {
        const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            authorId: currentUser.id, 
            content: trimmedContent 
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.newPost) {
            // Replace temp post with real post
            setPosts(prevPosts => prevPosts.map(p => 
              String(p._id) === String(tempPost._id) ? result.newPost! : p
            ));
            
            // Emit real-time update
            try {
              emitPostCreated(channelId, result.newPost);
            } catch (emitError) {
              console.warn('Failed to emit real-time post creation:', emitError);
            }
            
            toast({ title: 'Post created successfully!' });
          } else {
            setPosts(originalPosts);
            setNewPostContent(trimmedContent);
            toast({ variant: 'destructive', title: 'Failed to create post', description: result.message || 'Please try again.' });
          }
        } else {
          setPosts(originalPosts);
          setNewPostContent(trimmedContent);
          toast({ variant: 'destructive', title: 'Failed to create post', description: 'Please try again.' });
        }
      } catch (error) {
        setPosts(originalPosts);
        setNewPostContent(trimmedContent);
        console.error('Error creating post:', error);
        toast({ variant: 'destructive', title: 'Network Error', description: 'Unable to create post. Please check your connection and try again.' });
      }
    });
  };

  const handleLikePost = async (postId: string) => {
    if (!currentUser || !isMember) {
      toast({ variant: 'destructive', title: 'You must be logged in to like posts.' });
      return;
    }

    const post = posts.find(p => String(p._id) === postId);
    if (!post) return;
    
    const isLiked = post.likedBy?.includes(currentUser.id);

    // Optimistic update
    setPosts(prevPosts => prevPosts.map(p => {
        if (String(p._id) === postId) {
            const newLikedBy = isLiked ? p.likedBy?.filter(id => id !== currentUser.id) : [...(p.likedBy || []), currentUser.id];
            return { ...p, likedBy: newLikedBy, likes: newLikedBy?.length || 0 };
        }
        return p;
    }));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/posts/${postId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ liked: !isLiked }),
        });

        if (response.ok) {
          // Emit real-time update
          try {
            emitPostLiked(channelId, postId, currentUser.id, !isLiked);
          } catch (emitError) {
            console.warn('Failed to emit real-time like update:', emitError);
          }
        } else {
          // Revert optimistic update on failure
          setPosts(prevPosts => prevPosts.map(p => (String(p._id) === postId ? post : p)));
          toast({ variant: 'destructive', title: 'Failed to update like status.' });
        }
      } catch (error) {
        // Revert optimistic update on failure
        setPosts(prevPosts => prevPosts.map(p => (String(p._id) === postId ? post : p)));
        toast({ variant: 'destructive', title: 'Failed to update like status.' });
      }
    });
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!currentUser || !isMember) return;
    if (!content.trim()) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/communities/${communityId}/channels/${channelId}/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.newComment) {
            setPosts(prevPosts => prevPosts.map(p => {
                if (String(p._id) === postId) {
                    return { ...p, comments: [...(p.comments || []), result.newComment] };
                }
                return p;
            }));
            
            // Emit real-time update
            try {
              emitCommentCreated(channelId, postId, result.newComment);
            } catch (emitError) {
              console.warn('Failed to emit real-time comment creation:', emitError);
            }
          } else {
            toast({ variant: "destructive", title: "Failed to post comment." });
          }
        } else {
          toast({ variant: "destructive", title: "Failed to post comment." });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Failed to post comment." });
      }
    });
  };

  const getRoleIcon = (role?: CommunityRole) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Create Post Section */}
      {isMember && currentUser && (
        <div className="p-4 border-b border-border bg-background">
          <Card>
            <CardHeader className="pb-3">
              <h3 className="font-semibold">Create a Post</h3>
            </CardHeader>
            <CardContent className="pb-3">
              <MarkdownEditor
                value={newPostContent}
                onChange={setNewPostContent}
                disabled={isPending}
                placeholder={`What's on your mind, ${currentUser.name}?`}
              />
            </CardContent>
            <CardFooter className="pt-0">
              <Button 
                onClick={handleCreatePost} 
                disabled={isPending || !newPostContent.trim()}
                className="ml-auto"
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Post
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Posts Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
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
                  <Button variant="outline" size="sm" onClick={() => loadPosts(currentPage)} disabled={isLoadingPosts}>
                    {isLoadingPosts ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Retry'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {posts.map((post) => {
            const isLiked = currentUser ? (post.likedBy || []).includes(currentUser.id) : false;
            const postId = String(post._id);
            return (
              <Card key={postId} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border-2 flex-shrink-0">
                      <AvatarImage src={post.author?.avatarUrl} alt={post.author?.name} />
                      <AvatarFallback className="text-sm">{post.author?.name?.charAt(0) || 'A'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm truncate">{post.author?.name || 'Anonymous'}</p>
                            {getRoleIcon((post.author as any)?.role)}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {(userRole === 'admin' || userRole === 'moderator') && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Flag className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <MarkdownContent content={post.content} className="prose prose-sm max-w-none" />
                </CardContent>
                <CardFooter className="flex-col items-start gap-3 pt-3 border-t">
                  <div className="flex items-center gap-4 w-full">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-2 text-muted-foreground hover:text-destructive" 
                      onClick={() => handleLikePost(postId)} 
                      disabled={!isMember}
                    >
                      <Heart className={cn("h-4 w-4", isLiked && "fill-destructive text-destructive")} />
                      <span className="text-sm">{post.likes}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-sm">{post.comments?.length || 0}</span>
                    </Button>
                  </div>
                  
                  {/* Comments Section */}
                  <div className="w-full space-y-3">
                    {post.comments?.map(comment => (
                      <div key={String(comment._id)} className="flex items-start gap-3">
                        <Avatar className="h-7 w-7 border-2 flex-shrink-0">
                          <AvatarImage src={comment.author?.avatarUrl} alt={comment.author?.name} />
                          <AvatarFallback className="text-xs">{comment.author?.name?.charAt(0) || 'A'}</AvatarFallback>
                        </Avatar>
                        <div className="bg-secondary/70 p-3 rounded-lg flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-xs truncate">{comment.author?.name}</p>
                              {getRoleIcon((comment.author as any)?.role)}
                            </div>
                            <p className="text-xs text-muted-foreground flex-shrink-0">{formatDate(comment.createdAt)}</p>
                          </div>
                          <p className="text-xs break-words">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {isMember && currentUser && (
                      <CommentForm postId={postId} onAddComment={handleAddComment} isPending={isPending} user={currentUser} />
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPosts(currentPage - 1)}
                  disabled={currentPage === 1 || isLoadingPosts}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPosts(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoadingPosts}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingPosts && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading posts...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Comment Form Component
function CommentForm({ postId, onAddComment, isPending, user }: { 
  postId: string, 
  onAddComment: (postId: string, content: string) => void, 
  isPending: boolean, 
  user: Session["user"] 
}) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      onAddComment(postId, comment);
      setComment('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3 w-full pt-2">
      <Avatar className="h-8 w-8 border-2 flex-shrink-0">
        <AvatarImage src={user?.image || undefined} />
        <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 relative min-w-0">
        <input 
          type="text"
          placeholder="Write a comment..." 
          value={comment} 
          onChange={(e) => setComment(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm border rounded-md bg-background"
        />
        <Button 
          type="submit" 
          size="icon" 
          className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2" 
          disabled={isPending || !comment.trim()}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
    </form>
  );
}
