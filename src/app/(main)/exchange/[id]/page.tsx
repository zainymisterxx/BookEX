import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { getExchangeById } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  MessageSquare,
  Repeat2,
  XCircle,
} from 'lucide-react';
import { ExchangeActionButtons } from './exchange-action-buttons';
import type { ExchangeStatus } from '@/lib/types';

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  proposed: {
    label: 'Proposed',
    className: 'bg-blue-100 text-blue-800',
    icon: <Clock className="h-4 w-4" />,
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-green-100 text-green-800',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-yellow-100 text-yellow-800',
    icon: <Repeat2 className="h-4 w-4" />,
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-800',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-800',
    icon: <XCircle className="h-4 w-4" />,
  },
  rejected: {
    label: 'Declined',
    className: 'bg-red-100 text-red-800',
    icon: <XCircle className="h-4 w-4" />,
  },
  disputed: {
    label: 'Disputed',
    className: 'bg-orange-100 text-orange-800',
    icon: <XCircle className="h-4 w-4" />,
  },
};

export default async function ExchangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/');
  }

  const exchange = await getExchangeById(id, session.user.id);

  if (!exchange) {
    notFound();
  }

  const statusCfg = STATUS_CONFIG[exchange.status] ?? {
    label: exchange.status,
    className: 'bg-gray-100 text-gray-800',
    icon: <Clock className="h-4 w-4" />,
  };

  const isProposer = exchange.proposerId === session.user.id;
  const isResponder = exchange.responderId === session.user.id;

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
        <Link href="/exchange/history">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Exchanges
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary">
            Exchange Detail
          </h1>
          <p className="text-muted-foreground mt-1">
            {isProposer ? 'You proposed this exchange' : 'Proposed to you'}
          </p>
        </div>
        <Badge
          className={`${statusCfg.className} border-0 flex items-center gap-1.5 text-sm px-3 py-1.5`}
        >
          {statusCfg.icon}
          {statusCfg.label}
        </Badge>
      </div>

      {/* Books */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center mb-8">
        <BookCard
          book={exchange.proposerBook}
          label={isProposer ? 'Your Book' : "Proposer's Book"}
        />
        <div className="flex justify-center">
          <ArrowRight className="h-8 w-8 text-muted-foreground" />
        </div>
        <BookCard
          book={exchange.responderBook}
          label={isResponder ? 'Your Book' : "Responder's Book"}
        />
      </div>

      {/* Participants */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Participants</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-6">
          <UserRow user={exchange.proposer} role="Proposer" />
          <UserRow user={exchange.responder} role="Responder" />
        </CardContent>
      </Card>

      {/* Proposal message */}
      {exchange.proposalMessage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Proposal Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground italic">
              &ldquo;{exchange.proposalMessage}&rdquo;
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {exchange.statusHistory && exchange.statusHistory.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {exchange.statusHistory.map((entry, i) => {
                const cfg = STATUS_CONFIG[entry.status] ?? {
                  label: entry.status,
                  className: 'bg-gray-100 text-gray-800',
                };
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Badge
                      className={`${cfg.className} border-0 shrink-0 mt-0.5`}
                    >
                      {cfg.label}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                      {entry.notes && (
                        <p className="mt-0.5 text-foreground/80">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {exchange.chatId && (
          <Button asChild variant="outline">
            <Link href={`/messages/${String(exchange.chatId)}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Open Chat
            </Link>
          </Button>
        )}
        <ExchangeActionButtons
          exchangeId={String(exchange._id)}
          status={exchange.status as ExchangeStatus}
          isProposer={isProposer}
          isResponder={isResponder}
          proposerConfirmed={exchange.proposerConfirmed}
          responderConfirmed={exchange.responderConfirmed}
        />
      </div>
    </div>
  );
}

function BookCard({
  book,
  label,
}: {
  book: { title: string; author: string; imageUrl?: string; condition?: string } | undefined;
  label: string;
}) {
  if (!book) return null;
  return (
    <Card className="flex flex-col items-center p-4 text-center gap-3">
      {book.imageUrl && (
        <div className="relative w-24 h-32 shrink-0">
          <Image
            src={book.imageUrl}
            alt={book.title}
            fill
            className="object-cover rounded border"
          />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </p>
        <h3 className="font-semibold leading-tight">{book.title}</h3>
        <p className="text-sm text-muted-foreground">{book.author}</p>
        {book.condition && (
          <Badge variant="outline" className="text-xs mt-2 capitalize">
            {book.condition.replace('-', ' ')}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function UserRow({
  user,
  role,
}: {
  user: { _id?: string | object; name?: string; avatarUrl?: string; city?: string } | undefined;
  role: string;
}) {
  if (!user) return null;
  const userId = user._id ? String(user._id) : undefined;
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback>{user.name?.[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-xs text-muted-foreground">{role}</p>
        {userId ? (
          <Link
            href={`/profile/${userId}`}
            className="font-semibold hover:underline"
          >
            {user.name}
          </Link>
        ) : (
          <p className="font-semibold">{user.name}</p>
        )}
        {user.city && (
          <p className="text-xs text-muted-foreground">{user.city}</p>
        )}
      </div>
    </div>
  );
}
