
"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getBookRecommendations } from '@/ai/flows/get-book-recommendations';
import { aiAssistantFlow, type AiAssistantOutput } from '@/ai/flows/intelligent-book-search';
import { Loader2, Sparkles, Wand2, Search, Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { AuthModal } from './auth-modal';

export function FloatingAiAssistant() {
  const { data: session, status } = useSession();
  const [recoQuery, setRecoQuery] = useState('');
  const [recoResult, setRecoResult] = useState<string[]>([]);
  const [isRecoLoading, setIsRecoLoading] = useState(false);
  const [recoError, setRecoError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<AiAssistantOutput | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');


  const handleGetRecommendations = async () => {
    if (!session?.user) {
      setRecoError('Please sign in to use AI recommendations.');
      return;
    }

    if (!recoQuery.trim()) {
      setRecoError('Please enter your preferences or mood.');
      return;
    }
    
    setIsRecoLoading(true);
    setRecoError('');
    setRecoResult([]);
    
    try {
      const result = await getBookRecommendations({ 
        moodOrInterest: recoQuery.trim(),
        userId: session.user.id || session.user.email || 'anonymous'
      });
      setRecoResult(result.recommendations);
    } catch (error: any) {
      console.error('Recommendation error:', error);
      
      if (error.message?.includes('Rate limit exceeded')) {
        setRecoError('You\'ve made too many requests. Please try again in an hour.');
      } else if (error.message?.includes('inappropriate content')) {
        setRecoError('Please refine your request and avoid inappropriate content.');
      } else if (error.message?.includes('Validation failed')) {
        setRecoError('Please enter a valid request (1-500 characters).');
      } else {
        setRecoError('Failed to get recommendations. Please check your connection and try again.');
      }
    } finally {
      setIsRecoLoading(false);
    }
  };
  
  const handleIntelligentSearch = async () => {
    if (!session?.user) {
      setSearchError('Please sign in to use AI search.');
      return;
    }

    if (!searchQuery.trim()) {
      setSearchError('Please enter a search query.');
      return;
    }
    
    setIsSearchLoading(true);
    setSearchError('');
    setSearchResult(null);
    
    try {
      const result = await aiAssistantFlow({ 
        query: searchQuery.trim(),
        userId: session.user.id || session.user.email || 'anonymous'
      });
      setSearchResult(result);
    } catch (error: any) {
      console.error('Search error:', error);
      
      if (error.message?.includes('Rate limit exceeded')) {
        setSearchError('You\'ve made too many requests. Please try again in an hour.');
      } else if (error.message?.includes('inappropriate content')) {
        setSearchError('Please refine your search and avoid inappropriate content.');
      } else if (error.message?.includes('Validation failed')) {
        setSearchError('Please enter a valid search query (1-300 characters).');
      } else {
        setSearchError('Search failed. Please check your connection and try again.');
      }
    } finally {
      setIsSearchLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl z-50 bg-accent hover:bg-accent/90 hover:scale-110 hover:shadow-accent/20 transition-all duration-300 border-2 border-accent/20"
        >
          <Sparkles className="h-8 w-8" />
          <span className="sr-only">Open AI Assistant</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Sparkles className="text-accent h-6 w-6"/>AI Assistant
          </DialogTitle>
          <DialogDescription>
            Your literary companion. Get book recommendations, summaries, and search our marketplace.
          </DialogDescription>
        </DialogHeader>

        {!session?.user ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="flex items-center justify-center w-16 h-16 bg-accent/10 rounded-full">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Sign in Required</h3>
              <p className="text-muted-foreground">
                Please sign in to access AI-powered book recommendations and intelligent search.
              </p>
            </div>
            <AuthModal>
              <Button size="lg" className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />
                Sign In to Use AI Assistant
              </Button>
            </AuthModal>
          </div>
        ) : (
          <Tabs defaultValue="assistant" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger value="assistant" className="text-base">AI Assistant</TabsTrigger>
                <TabsTrigger value="recommendations" className="text-base">Recommendations</TabsTrigger>
            </TabsList>
             <TabsContent value="assistant">
                <Card className="border-0 shadow-none">
                <CardHeader>
                    <CardTitle className="font-headline">Your Assistant</CardTitle>
                    <CardDescription>Ask to find books from our marketplace, get summaries, and more.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                    <Label htmlFor="search-query">Your Request</Label>
                    <Input 
                        id="search-query" 
                        placeholder="e.g., 'Find sci-fi books, then summarize the first one.'" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isSearchLoading}
                        className="h-11"
                    />
                    </div>
                    {searchResult && (
                        <div className="p-4 bg-secondary rounded-lg space-y-4 border max-h-64 overflow-y-auto">
                            <p className="text-foreground/90 italic">"{searchResult.response}"</p>
                            {searchResult.books && searchResult.books.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {searchResult.books.map(book => (
                                        <Link key={book._id} href={`/books/${book._id}`} className="block group">
                                            <Card className="overflow-hidden">
                                                <div className="relative aspect-[3/4] w-full">
                                                    <Image src={book.imageUrl} alt={book.title} fill className="object-cover" data-ai-hint="book cover"/>
                                                </div>
                                                <div className="p-2">
                                                    <p className="text-sm font-semibold truncate group-hover:underline">{book.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                                                </div>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {searchError && <p className="text-sm text-destructive">{searchError}</p>}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleIntelligentSearch} disabled={isSearchLoading || !searchQuery} size="lg">
                    {isSearchLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working on it...</>
                    ) : (
                        <><Sparkles className="mr-2 h-4 w-4" /> Ask Assistant</>
                    )}
                    </Button>
                </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="recommendations">
                <Card className="border-0 shadow-none">
                <CardHeader>
                    <CardTitle className="font-headline">Get Book Recommendations</CardTitle>
                    <CardDescription>Describe a mood, interest, or genre to get book suggestions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                    <Label htmlFor="mood">Mood or Interest</Label>
                    <Input 
                        id="mood" 
                        placeholder="e.g., a fast-paced sci-fi thriller" 
                        value={recoQuery}
                        onChange={(e) => setRecoQuery(e.target.value)}
                        disabled={isRecoLoading}
                        className="h-11"
                    />
                    </div>
                    {recoResult.length > 0 && (
                        <div className="p-4 bg-secondary rounded-lg space-y-2 border">
                            <h3 className="font-semibold font-headline flex items-center gap-2 text-primary"><Sparkles className="h-5 w-5"/>Here are some recommendations:</h3>
                            <ul className="list-disc list-inside text-foreground/90">
                                {recoResult.map((rec, index) => <li key={index}>{rec}</li>)}
                            </ul>
                        </div>
                    )}
                    {recoError && <p className="text-sm text-destructive">{recoError}</p>}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleGetRecommendations} disabled={isRecoLoading || !recoQuery} size="lg">
                    {isRecoLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding Books...</>
                    ) : (
                        <><Wand2 className="mr-2 h-4 w-4" /> Get Recommendations</>
                    )}
                    </Button>
                </CardFooter>
                </Card>
            </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
