"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Trash2, Eye, Search, Shield, AlertTriangle, MessageSquare, UserMinus, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Community, Post, User } from '@/lib/types';

interface CommunityStats {
  totalCommunities: number;
  totalMembers: number;
  activeCommunities: number;
  reportedCommunities: number;
}

interface CommunityWithDetails extends Community {
  postsCount: number;
  recentActivity: string;
  reportedPosts: number;
}

export default function CommunityAdminDashboard() {
  const [communities, setCommunities] = useState<CommunityWithDetails[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityWithDetails | null>(null);
  const [communityMembers, setCommunityMembers] = useState<User[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<CommunityStats>({
    totalCommunities: 0,
    totalMembers: 0,
    activeCommunities: 0,
    reportedCommunities: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadCommunities();
    loadStats();
  }, []);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      // This would be replaced with actual API call
      const response = await fetch('/api/admin/communities');
      if (response.ok) {
        const data = await response.json();
        setCommunities(data.communities);
      }
    } catch (error) {
      console.error('Failed to load communities:', error);
      toast({ variant: 'destructive', title: 'Failed to load communities' });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // This would be replaced with actual API call
      const response = await fetch('/api/admin/communities/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadCommunityDetails = async (communityId: string) => {
    try {
      const response = await fetch(`/api/admin/communities/${communityId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCommunity(data.community);
        setCommunityMembers(data.members);
        setCommunityPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to load community details:', error);
      toast({ variant: 'destructive', title: 'Failed to load community details' });
    }
  };

  const deleteCommunity = async (communityId: string) => {
    try {
      const response = await fetch(`/api/admin/communities/${communityId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCommunities(prev => prev.filter(c => String(c._id) !== communityId));
        toast({ title: 'Community deleted successfully' });
        loadStats();
      } else {
        throw new Error('Failed to delete community');
      }
    } catch (error) {
      console.error('Failed to delete community:', error);
      toast({ variant: 'destructive', title: 'Failed to delete community' });
    }
  };

  const removeMember = async (communityId: string, userId: string) => {
    try {
      const response = await fetch(`/api/admin/communities/${communityId}/members/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCommunityMembers(prev => prev.filter(m => String(m._id) !== userId));
        toast({ title: 'Member removed successfully' });
        loadCommunityDetails(communityId);
      } else {
        throw new Error('Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast({ variant: 'destructive', title: 'Failed to remove member' });
    }
  };

  const deletePost = async (communityId: string, postId: string) => {
    try {
      const response = await fetch(`/api/admin/communities/${communityId}/posts/${postId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCommunityPosts(prev => prev.filter(p => String(p._id) !== postId));
        toast({ title: 'Post deleted successfully' });
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast({ variant: 'destructive', title: 'Failed to delete post' });
    }
  };

  const filteredCommunities = communities.filter(community => {
    const matchesSearch = community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         community.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' ||
                         (filterStatus === 'reported' && community.reportedPosts > 0) ||
                         (filterStatus === 'active' && community.postsCount > 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Community Administration</h1>
          <p className="text-muted-foreground">Manage communities, members, and content moderation</p>
        </div>
        <Button onClick={() => { loadCommunities(); loadStats(); }}>
          <Shield className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Communities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCommunities}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Communities</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCommunities}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reported Content</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reportedCommunities}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="communities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="communities">Communities</TabsTrigger>
          <TabsTrigger value="moderation">Moderation Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="communities" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Communities</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="filter">Filter</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter communities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Communities</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="reported">Reported Content</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Communities Table */}
          <Card>
            <CardHeader>
              <CardTitle>Communities ({filteredCommunities.length})</CardTitle>
              <CardDescription>Manage all communities on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading communities...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommunities.map((community) => (
                      <TableRow key={String(community._id)}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{community.name}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {community.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{community.memberCount}</TableCell>
                        <TableCell>{community.postsCount}</TableCell>
                        <TableCell>
                          <Badge variant={community.reportedPosts > 0 ? "destructive" : "secondary"}>
                            {community.reportedPosts > 0 ? "Reported" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadCommunityDetails(String(community._id))}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{community.name} - Details</DialogTitle>
                                  <DialogDescription>
                                    Manage community members and content
                                  </DialogDescription>
                                </DialogHeader>

                                <Tabs defaultValue="members" className="mt-4">
                                  <TabsList>
                                    <TabsTrigger value="members">Members ({communityMembers.length})</TabsTrigger>
                                    <TabsTrigger value="posts">Posts ({communityPosts.length})</TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="members" className="space-y-4">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Name</TableHead>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Role</TableHead>
                                          <TableHead>Actions</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {communityMembers.map((member) => (
                                          <TableRow key={String(member._id)}>
                                            <TableCell>{member.name}</TableCell>
                                            <TableCell>{member.email}</TableCell>
                                            <TableCell>
                                              <Badge variant="outline">
                                                {member.role === 'admin' ? 'Admin' : 'Member'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button variant="outline" size="sm">
                                                    <UserMinus className="h-4 w-4" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Are you sure you want to remove {member.name} from {community.name}?
                                                      This action cannot be undone.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      onClick={() => removeMember(String(community._id), String(member._id))}
                                                    >
                                                      Remove
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TabsContent>

                                  <TabsContent value="posts" className="space-y-4">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Content</TableHead>
                                          <TableHead>Author</TableHead>
                                          <TableHead>Likes</TableHead>
                                          <TableHead>Actions</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {communityPosts.map((post) => (
                                          <TableRow key={String(post._id)}>
                                            <TableCell>
                                              <div className="max-w-xs truncate">{post.content}</div>
                                            </TableCell>
                                            <TableCell>{post.author?.name || 'Unknown'}</TableCell>
                                            <TableCell>{post.likes || 0}</TableCell>
                                            <TableCell>
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button variant="outline" size="sm">
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Post</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      Are you sure you want to delete this post? This action cannot be undone.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      onClick={() => deletePost(String(community._id), String(post._id))}
                                                    >
                                                      Delete
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Community</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{community.name}"? This will permanently remove
                                    all posts, comments, and member associations. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteCommunity(String(community._id))}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete Community
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Moderation queue functionality will be implemented here. This will show reported posts,
              comments, and communities that need admin review.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Community analytics and insights will be displayed here, including growth metrics,
              engagement rates, and content performance statistics.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
