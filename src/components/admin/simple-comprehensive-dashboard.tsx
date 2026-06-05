"use client";

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Users, BookOpen, MessageSquare, Shield,
  Activity, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { suspendUser, bulkDeleteBooks, broadcastAnnouncement } from '@/app/actions';

// Types for dashboard data
interface DashboardStats {
  users: {
    total: number;
    active: number;
    newToday: number;
    weeklyGrowth: number;
  };
  books: {
    total: number;
    active: number;
    sold: number;
    exchanges: number;
  };
  activity: {
    messages: number;
    exchanges: number;
    reviews: number;
    reports: number;
  };
  security: {
    threats: number;
    blocked: number;
    healthScore: number;
    alerts: number;
  };
}

interface ChartData {
  userActivity: Array<{ date: string; users: number; books: number; messages: number }>;
  securityMetrics: Array<{ category: string; count: number; color: string }>;
  bookCategories: Array<{ genre: string; count: number }>;
  userEngagement: Array<{ hour: string; active: number }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function ComprehensiveAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<'7' | '30' | '90'>('7');
  const [isPending, startQuickAction] = useTransition();
  const { toast } = useToast();

  // Quick Action Dialog States
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendUserId, setSuspendUserId] = useState('');
  
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeBookId, setRemoveBookId] = useState('');
  
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await apiFetch('/api/admin/comprehensive-dashboard');
      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const data = await response.json();
      setStats(data.stats);
      setChartData(data.charts);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendUserId.trim()) return;
    startQuickAction(async () => {
      const result = await suspendUser(suspendUserId.trim());
      if (result.success) {
        toast({ title: 'User suspended' });
        setSuspendDialogOpen(false);
        setSuspendUserId('');
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  };

  const handleRemoveListingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!removeBookId.trim()) return;
    startQuickAction(async () => {
      const result = await bulkDeleteBooks([removeBookId.trim()]);
      if (result.success) {
        toast({ title: 'Book listing removed', description: `${result.data.count} listing(s) removed` });
        setRemoveDialogOpen(false);
        setRemoveBookId('');
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  };

  const handleSendAnnouncementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;
    startQuickAction(async () => {
      const result = await broadcastAnnouncement(announcementTitle.trim(), announcementMessage.trim());
      if (result.success) {
        toast({ title: 'Announcement sent', description: `Notified ${result.data.notified} users` });
        setAnnouncementDialogOpen(false);
        setAnnouncementTitle('');
        setAnnouncementMessage('');
      } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.message });
      }
    });
  };

  // Filter chart data client-side based on selected days range
  const filteredUserActivity = (() => {
    const activity = chartData?.userActivity ?? [];
    const days = parseInt(analyticsDays, 10);
    return activity.slice(-days);
  })();

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Dashboard Error</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadDashboardData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold tracking-tight">{stats?.users.total || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{stats?.users.weeklyGrowth || 0}% this week
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Books</p>
                <p className="text-2xl font-bold tracking-tight">{stats?.books.active || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.books.total || 0} total books
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Activity</p>
                <p className="text-2xl font-bold tracking-tight">{stats?.activity.messages || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Messages today</p>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                <MessageSquare className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md hover:-translate-y-1 transition-all duration-300 border border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Security Score</p>
                <p className="text-2xl font-bold tracking-tight">{stats?.security.healthScore || 0}%</p>
                <div className="flex items-center mt-1">
                  {(stats?.security.healthScore || 0) > 90 ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mr-1" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(stats?.security.healthScore || 0) > 90 ? 'Excellent' : 'Needs attention'}
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
                <Shield className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* User Activity Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="font-headline">User Activity Trend</CardTitle>
                <CardDescription>Daily user engagement over selected period</CardDescription>
              </div>
              <Select value={analyticsDays} onValueChange={(v) => setAnalyticsDays(v as '7' | '30' | '90')}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredUserActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Active Users"
                  />
                  <Line
                    type="monotone"
                    dataKey="messages"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Messages"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Book Categories Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Book Categories</CardTitle>
            <CardDescription>Distribution of books by genre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.bookCategories || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ genre, percent }) => `${genre} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {(chartData?.bookCategories || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Security Overview</CardTitle>
          <CardDescription>Current security status and recent activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">System Health</span>
                <span className="text-sm text-muted-foreground">{stats?.security.healthScore || 0}%</span>
              </div>
              <Progress value={stats?.security.healthScore || 0} className="h-2" />
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.security.blocked || 0}</p>
              <p className="text-sm text-muted-foreground">Threats Blocked</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats?.security.alerts || 0}</p>
              <p className="text-sm text-muted-foreground">Active Alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start" onClick={() => setSuspendDialogOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Suspend User
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setRemoveDialogOpen(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Remove Listing
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setAnnouncementDialogOpen(true)}>
              <Shield className="h-4 w-4 mr-2" />
              Send Announcement
            </Button>
            <Button variant="outline" className="justify-start" onClick={loadDashboardData}>
              <Activity className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suspend User Modal */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSuspendUserSubmit}>
            <DialogHeader>
              <DialogTitle>Suspend User Account</DialogTitle>
              <DialogDescription>
                Temporarily or permanently suspend a user from accessing the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="suspend-user-id">User ID</Label>
                <Input
                  id="suspend-user-id"
                  placeholder="e.g. 60c72b2f9b1d8e25d482a123"
                  value={suspendUserId}
                  onChange={(e) => setSuspendUserId(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSuspendDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? 'Suspending...' : 'Suspend User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Listing Modal */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRemoveListingSubmit}>
            <DialogHeader>
              <DialogTitle>Remove Book Listing</DialogTitle>
              <DialogDescription>
                Remove a book listing from the platform by entering its listing ID.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="remove-book-id">Book ID</Label>
                <Input
                  id="remove-book-id"
                  placeholder="e.g. 60c72b2f9b1d8e25d482b456"
                  value={removeBookId}
                  onChange={(e) => setRemoveBookId(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoveDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? 'Removing...' : 'Remove Listing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Announcement Modal */}
      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSendAnnouncementSubmit}>
            <DialogHeader>
              <DialogTitle>Broadcast System Announcement</DialogTitle>
              <DialogDescription>
                Send a system-wide notification to all active users on the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="announcement-title">Announcement Title</Label>
                <Input
                  id="announcement-title"
                  placeholder="e.g. Scheduled Maintenance"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-message">Message Body</Label>
                <Textarea
                  id="announcement-message"
                  placeholder="Type your system announcement message here..."
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Sending...' : 'Broadcast Announcement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
