
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import type { Organization } from '@/lib/types';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { AuthModal } from '@/components/auth-modal';
import { Loader2, HandHeart } from 'lucide-react';
import Link from 'next/link';
import { getApprovedOrganizationsCached, initiateDonation } from '@/app/actions';

export default function DonatePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDonating, setIsDonating] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    const fetchOrgs = async () => {
        setIsLoading(true);
        const orgs = await getApprovedOrganizationsCached();
        setOrganizations(orgs);
        setIsLoading(false);
    }
    fetchOrgs();
  }, []);

  const handleDonate = async (organization: Organization) => {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication required",
            description: "You must be logged in to donate books."
        });
        return;
    }
    const orgId = String(organization._id);
    setIsDonating(orgId);
    try {
        const result = await initiateDonation(orgId);
        if (!result.success) {
            throw new Error(result.message || "Failed to initiate donation.");
        }
        if (!result.data?.chatId) {
            throw new Error("Failed to initiate donation.");
        }

        toast({
            title: "Thank you for your generosity!",
            description: "A chat has been started to coordinate the donation."
        });
        router.push(`/messages/${result.data.chatId}`);

    } catch (error) {
        console.error("Error initiating donation:", error);
        toast({
            variant: "destructive",
            title: "Donation failed",
            description: "Could not start the donation process. Please try again."
        });
    } finally {
        setIsDonating(null);
    }
  }

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">Donate Books</h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Share the joy of reading by donating your used books to one of our approved partner organizations.
          </p>
        </div>
        
        {isLoading ? (
            <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : organizations.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {organizations.map((org) => (
              <Card key={String(org._id)} className="flex flex-col border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <CardHeader className="flex-row items-start gap-4 p-6">
                  <Image
                    src={org.imageUrl}
                    alt={`${org.name} logo`}
                    width={80}
                    height={80}
                    className="rounded-lg border-2"
                    data-ai-hint="logo charity"
                  />
                  <div className="flex-1">
                    <CardTitle className="font-headline text-xl">{org.name}</CardTitle>
                    <p className="text-sm font-semibold text-primary">{org.location}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6 pt-0">
                  <CardDescription className="text-base">{org.description}</CardDescription>
                </CardContent>
                <CardFooter className="p-6">
                  {user ? (
                    <Button className="w-full" size="lg" onClick={() => handleDonate(org)} disabled={!!isDonating}>
                        {isDonating === String(org._id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Donate to {org.name}
                    </Button>
                  ) : (
                    <AuthModal>
                        <Button className="w-full" size="lg">Donate to {org.name}</Button>
                    </AuthModal>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed mt-8">
            <h3 className="text-xl font-semibold font-headline">No Organizations Found</h3>
            <p className="text-muted-foreground mt-2">We are not partnered with any donation organizations at the moment. Please check back later.</p>
          </div>
        )}

        <Card className="mt-16 bg-gradient-to-r from-primary/5 to-accent/5 border-2 border-primary/10">
            <CardContent className="p-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                <div className="flex-1">
                    <HandHeart className="h-12 w-12 text-primary mx-auto md:mx-0 mb-4"/>
                    <h2 className="text-2xl font-bold font-headline text-primary">Are you an organization?</h2>
                    <p className="text-muted-foreground mt-2 max-w-xl">
                        If you are a school, library, or non-profit interested in receiving book donations, apply to join our platform and connect with generous donors.
                    </p>
                </div>
                <Button asChild size="lg" className="flex-shrink-0 py-7 px-8 text-lg">
                    <Link href="/donate/apply">Apply Here</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
