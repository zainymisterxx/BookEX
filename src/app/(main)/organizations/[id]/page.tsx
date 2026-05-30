import { notFound } from 'next/navigation';
import { getOrganizationById } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Globe,
  HandHeart,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';

export default async function OrganizationProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getOrganizationById(id);

  if (!data) {
    notFound();
  }

  const { organization: org, donationBooks } = data;

  return (
    <div className="bg-secondary min-h-screen">
      <div className="container py-8 max-w-4xl mx-auto">
        {/* Back link */}
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/donate">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Organizations
          </Link>
        </Button>

        {/* Org header */}
        <div className="flex flex-col sm:flex-row gap-6 items-start mb-8">
          <div className="shrink-0">
            <Avatar className="h-20 w-20 rounded-xl border-2">
              <AvatarImage
                src={org.imageUrl}
                alt={`${org.name} logo`}
              />
              <AvatarFallback className="text-2xl rounded-xl">
                {org.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold font-headline text-primary">
              {org.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {org.location && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {org.location}
                </span>
              )}
            </div>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href={`/donate?orgId=${String(org._id)}`}>
              <HandHeart className="h-4 w-4 mr-2" />
              Donate Books
            </Link>
          </Button>
        </div>

        {/* Description */}
        <Card className="mb-6 border-2">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed">
              {org.description}
            </p>
          </CardContent>
        </Card>

        {/* Contact info */}
        {(org.contactEmail || org.contactPhone || org.website) && (
          <Card className="mb-6 border-2">
            <CardHeader>
              <CardTitle className="text-lg">Contact &amp; Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {org.contactEmail && (
                <a
                  href={`mailto:${org.contactEmail}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {org.contactEmail}
                </a>
              )}
              {org.contactPhone && (
                <a
                  href={`tel:${org.contactPhone}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {org.contactPhone}
                </a>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {org.website}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <Separator className="my-6" />

        {/* Accepted donation books */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold font-headline text-primary flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Books Available for Donation
          </h2>
          <Badge variant="outline">{donationBooks.length} listed</Badge>
        </div>

        {donationBooks.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {donationBooks.map((book) => (
              <Card
                key={String(book._id)}
                className="flex flex-col border-2 hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-[3/2] overflow-hidden rounded-t-xl">
                  {book.imageUrl ? (
                    <Image
                      src={book.imageUrl}
                      alt={book.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center">
                      <BookOpen className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4 flex-1">
                  <h3 className="font-semibold leading-tight line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {book.author}
                  </p>
                  <Badge variant="outline" className="text-xs mt-2 capitalize">
                    {book.condition.replace('-', ' ')}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-background rounded-lg border-2 border-dashed">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No books currently listed — be the first to donate!
            </p>
            <Button asChild className="mt-4">
              <Link href={`/donate?orgId=${String(org._id)}`}>
                Donate a Book
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
