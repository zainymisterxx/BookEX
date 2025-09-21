"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Users, BookOpen, MessageSquare, Shield, TrendingUp, 
  Activity, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';

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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await fetch('/api/admin/comprehensive-dashboard');
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats?.users.total || 0}</p>
                <p className="text-xs text-muted-foreground">
                  +{stats?.users.weeklyGrowth || 0}% this week
                </p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Books</p>
                <p className="text-2xl font-bold">{stats?.books.active || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {stats?.books.total || 0} total books
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Activity</p>
                <p className="text-2xl font-bold">{stats?.activity.messages || 0}</p>
                <p className="text-xs text-muted-foreground">Messages today</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Security Score</p>
                <p className="text-2xl font-bold">{stats?.security.healthScore || 0}%</p>
                <div className="flex items-center mt-1">
                  {(stats?.security.healthScore || 0) > 90 ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {(stats?.security.healthScore || 0) > 90 ? 'Excellent' : 'Needs attention'}
                  </span>
                </div>
              </div>
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* User Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">User Activity Trend</CardTitle>
            <CardDescription>Daily user engagement over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData?.userActivity || []}>
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
            <Button variant="outline" className="justify-start">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
            <Button variant="outline" className="justify-start">
              <BookOpen className="h-4 w-4 mr-2" />
              Review Books
            </Button>
            <Button variant="outline" className="justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Security Logs
            </Button>
            <Button variant="outline" className="justify-start">
              <Activity className="h-4 w-4 mr-2" />
              System Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
