"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageSquare, CheckCircle, XCircle, Clock, Repeat2, ArrowRight } from 'lucide-react';
import { AuthModal } from '@/components/auth-modal';
import Link from 'next/link';
import Image from 'next/image';
import type { Exchange, ExchangeStatus } from '@/lib/types';
import { getUserExchanges } from '@/app/actions';
import { useExchangeRealtime } from '@/hooks/use-exchange-realtime';

export default function ExchangeHistoryPage() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | ExchangeStatus>('all');
  const { data: session, status } = useSession();
  const user = session?.user;

  // Set up real-time updates for all user's exchanges
  useExchangeRealtime({
    onStatusUpdate: (data) => {
      console.log('Exchange history real-time update:', data);
      // Refresh the current page data
      fetchExchanges();
    },
    onError: (error) => {
      console.error('Exchange history real-time error:', error);
    }
  });

  useEffect(() => {
    if (!user) {
      if (status !== 'loading') setIsLoading(false);
      return;
    }

    fetchExchanges();
  }, [user, status, activeTab, currentPage]);

  const fetchExchanges = async () => {
    setIsLoading(true);
    try {
      const statusFilter = activeTab === 'all' ? undefined : activeTab as ExchangeStatus;
      const result = await getUserExchanges(currentPage, 10, statusFilter);
      
      if (result.success) {
        setExchanges(result.data.exchanges);
        setTotalCount(result.data.totalCount);
        setHasMore(result.data.hasMore);
      } else {
        console.error('Error fetching exchanges:', result.message);
      }
    } catch (error) {
      console.error('Error fetching exchanges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return <Clock className="h-4 w-4" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Repeat2 className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'disputed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return 'bg-blue-100 text-blue-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'disputed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: ExchangeStatus) => {
    switch (status) {
      case 'proposed':
        return 'Proposed';
      case 'accepted':
        return 'Accepted';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'disputed':
        return 'Disputed';
      default:
        return status;
    }
  };

  const ExchangeCard = ({ exchange }: { exchange: Exchange }) => {
    const isProposer = exchange.proposerId === user?.id;
    const otherUser = isProposer ? exchange.responder : exchange.proposer;
    const myBook = isProposer ? exchange.proposerBook : exchange.responderBook;
    const theirBook = isProposer ? exchange.responderBook : exchange.proposerBook;
    
    return (
      <Card className="mb-4 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={`${getStatusColor(exchange.status)} border-0`}>
                {getStatusIcon(exchange.status)}
                <span className="ml-1">{getStatusText(exchange.status)}</span>
              </Badge>
              <span className="text-sm text-muted-foreground">
                {isProposer ? 'You proposed' : 'Proposed to you'}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {new Date(exchange.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Exchange Details */}
          <div className="flex items-center gap-4 mb-4">
            {/* Your Book */}
            <div className="flex-1">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {isProposer ? 'Your Book' : 'Their Book'}
              </div>
              <div className="flex items-center gap-3">
                {myBook?.imageUrl && (
                  <Image
                    src={myBook.imageUrl}
                    alt={myBook.title}
                    width={60}
                    height={80}
                    className="rounded border object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{myBook?.title}</h4>
                  <p className="text-sm text-muted-foreground">{myBook?.author}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {myBook?.condition}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Exchange Arrow */}
            <div className="flex-shrink-0">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Their Book */}
            <div className="flex-1">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {isProposer ? 'Their Book' : 'Your Book'}
              </div>
              <div className="flex items-center gap-3">
                {theirBook?.imageUrl && (
                  <Image
                    src={theirBook.imageUrl}
                    alt={theirBook.title}
                    width={60}
                    height={80}
                    className="rounded border object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{theirBook?.title}</h4>
                  <p className="text-sm text-muted-foreground">{theirBook?.author}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {theirBook?.condition}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Other User Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={otherUser?.avatarUrl} />
                <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">{otherUser?.name}</div>
                <div className="text-xs text-muted-foreground">{otherUser?.city}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {exchange.chatId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/messages/${exchange.chatId}`}>
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Proposal Message */}
          {exchange.proposalMessage && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-1">Proposal Message:</div>
              <div className="text-sm text-muted-foreground">"{exchange.proposalMessage}"</div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading && status === 'loading') {
    return (
      <div className="container py-16">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Exchange History</h1>
          <p className="text-muted-foreground mb-8">
            Sign in to view your exchange history
          </p>
          <AuthModal>
            <Button>Sign In</Button>
          </AuthModal>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Exchange History</h1>
          <p className="text-muted-foreground">
            Track your book exchanges and their current status
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value as any);
          setCurrentPage(1);
        }} className="mb-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="proposed">Proposed</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : exchanges.length > 0 ? (
              <>
                <div className="space-y-4">
                  {exchanges.map((exchange) => (
                    <ExchangeCard key={String(exchange._id)} exchange={exchange} />
                  ))}
                </div>

                {/* Pagination */}
                {(hasMore || currentPage > 1) && (
                  <div className="flex items-center justify-between mt-8">
                    <div className="text-sm text-muted-foreground">
                      Showing {exchanges.length} of {totalCount} exchanges
                    </div>
                    <div className="flex gap-2">
                      {currentPage > 1 && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage(currentPage - 1)}
                        >
                          Previous
                        </Button>
                      )}
                      {hasMore && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentPage(currentPage + 1)}
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="py-16">
                <CardContent className="text-center">
                  <div className="mb-4">
                    <Repeat2 className="h-12 w-12 text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {activeTab === 'all' ? 'No exchanges yet' : `No ${getStatusText(activeTab as ExchangeStatus).toLowerCase()} exchanges`}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {activeTab === 'all' 
                      ? 'Start your first book exchange by browsing exchange books'
                      : `You don't have any ${getStatusText(activeTab as ExchangeStatus).toLowerCase()} exchanges`
                    }
                  </p>
                  {activeTab === 'all' && (
                    <Button asChild>
                      <Link href="/exchange">
                        Browse Exchange Books
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
