
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, UploadCloud, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import type { User, BookGenre } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AuthModal } from '@/components/auth-modal';
import { analyzeBookCondition, type AnalyzeBookConditionOutput } from '@/ai/flows/analyze-book-condition';
import { listBook, getUserCity, getBookForEdit, updateBookListing, checkProfileCompletion } from '@/app/actions';
import { useSession } from 'next-auth/react';
import { fileToDataUri } from '@/lib/utils';

const genres: BookGenre[] = ["fantasy", "sci-fi", "mystery", "romance", "self-help", "historical-fiction", "other"];

function SellBookForm() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState<BookGenre | ''>('');
  const [condition, setCondition] = useState<'new' | 'like-new' | 'used' | 'worn' | ''>('');
  const [listingType, setListingType] = useState<'sell' | 'exchange'>('sell');
  const [price, setPrice] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  
  const [isListingLoading, setIsListingLoading] = useState(false);
  const [userCity, setUserCity] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeBookConditionOutput | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editBookId, setEditBookId] = useState<string | null>(null);
  const [isLoadingBookData, setIsLoadingBookData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchUserData = async () => {
        if (session?.user?.id) {
            const city = await getUserCity(session.user.id);
            setUserCity(city);
        }
    };
    fetchUserData();
  }, [session]);

  // Check profile completion
  useEffect(() => {
    const checkProfile = async () => {
      if (status === 'loading') return;
      
      const result = await checkProfileCompletion();
      if (result.isAuthenticated && !result.profileCompleted) {
        router.push('/profile/settings');
      }
    };
    checkProfile();
  }, [status, router]);

  // Check for edit mode and load book data
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      setIsEditMode(true);
      setEditBookId(editId);
      loadBookForEdit(editId);
    }
  }, [searchParams]);

  const loadBookForEdit = async (bookId: string) => {
    setIsLoadingBookData(true);
    setLoadError(null);
    try {
      const result = await getBookForEdit(bookId);
      
      if (!result.success) {
        throw new Error(result.error.userMessage);
      }
      
      const bookData = result.data;
      
      // Populate form with existing book data
      setTitle(bookData.title || '');
      setAuthor(bookData.author || '');
      setDescription(bookData.description || '');
      
      // Validate genre against allowed values, fallback to 'other' if invalid
      const validGenres: BookGenre[] = ["fantasy", "sci-fi", "mystery", "romance", "self-help", "historical-fiction", "other"];
      const isValidGenre = validGenres.includes(bookData.genre as BookGenre);
      setGenre(isValidGenre ? bookData.genre : 'other');
      
      setCondition(bookData.condition || '');
      setListingType(bookData.type || 'sell');
      setPrice(bookData.price ? bookData.price.toString() : '');
      
      toast({
        title: "Book data loaded",
        description: "You can now edit your listing."
      });
    } catch (error) {
      console.error('Error loading book for edit:', error);
      setLoadError('Error loading book data. Please try again.');
      toast({
        variant: "destructive",
        title: "Error loading book",
        description: "Could not load book data for editing. Please try again."
      });
    } finally {
      setIsLoadingBookData(false);
    }
  };
  

  const handleAnalyze = async () => {
    if (!title || !author || !description || !coverImage) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill in the title, author, description, and upload an image to get suggestions.' });
        return;
    }
    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysisResult(null);
    try {
        const photoDataUri = await fileToDataUri(coverImage);
        const result = await analyzeBookCondition({ 
            title, 
            author, 
            description, 
            photoDataUri,
            userId: session?.user?.id || 'anonymous' // Add required userId
        });
        setAnalysisResult(result);
    } catch (error) {
        console.error("Error analyzing book:", error);
        setAnalysisError('The AI assistant could not provide a suggestion. Please fill in the details manually.');
    } finally {
        setIsAnalyzing(false);
    }
  };


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      setCoverImage(file);
      setAnalysisResult(null); 
    }
  };
  
  const applySuggestion = () => {
      if (analysisResult) {
          setCondition(analysisResult.suggestedCondition);
          if (listingType === 'sell') {
              setPrice(analysisResult.suggestedPricePKR.toString());
          }
          toast({ title: "AI suggestions applied!" });
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
        toast({
            variant: 'destructive',
            title: 'Not logged in',
            description: 'You must be logged in to list a book.',
        });
        return;
    }

    if (!userCity) {
        toast({
            variant: 'destructive',
            title: 'City required',
            description: 'Please set your city in your profile before listing a book.',
        });
        return;
    }

    if (!title || !author || !description || !genre || !condition || (listingType === 'sell' && !price)) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all the required fields.',
      });
      return;
    }

    // For new listings, require image. For edits, image is optional
    if (!isEditMode && !coverImage) {
      toast({
        variant: 'destructive',
        title: 'Missing image',
        description: 'Please upload a cover image for your book.',
      });
      return;
    }
    
    setIsListingLoading(true);
    try {
      let imageUrl = '';
      if (coverImage) {
        imageUrl = await fileToDataUri(coverImage);
      }
      
      if (isEditMode && editBookId) {
        // Update existing book - imageUrl is optional
        const updateData = {
          title,
          author,
          description,
          genre,
          condition,
          type: listingType,
          price: listingType === 'sell' ? parseFloat(price) : undefined,
          city: userCity,
          ...(imageUrl && { imageUrl }), // Only include imageUrl if provided
        };

        const result = await updateBookListing(editBookId, updateData);
        if (!result.success) {
          throw new Error(result.error.userMessage);
        }
        
        toast({
          title: 'Success!',
          description: 'Your book listing has been updated.',
        });
        router.push(`/books/${editBookId}`);
      } else {
        // Create new book - imageUrl is required
        if (!imageUrl) {
          throw new Error('Cover image is required for new listings');
        }
        
        const bookData = {
          title,
          author,
          description,
          genre,
          condition,
          type: listingType,
          price: listingType === 'sell' ? parseFloat(price) : undefined,
          imageUrl,
          sellerId: session.user.id,
          city: userCity,
        };

        const result = await listBook(bookData);
        if (!result.success || !result.data?.bookId) {
          throw new Error(result.success ? 'Failed to create book listing' : result.error.userMessage);
        }
        
        toast({
          title: 'Success!',
          description: 'Your book has been listed.',
        });
        router.push(`/books/${result.data.bookId}`);
      }
    } catch (error) {
      console.error('Error with book listing:', error);
      toast({
        variant: 'destructive',
        title: isEditMode ? 'Update failed' : 'Listing failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsListingLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="bg-secondary">
        <div className="container py-12 md:py-16 text-center min-h-[60vh] flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold font-headline">Please log in</h2>
            <p className="text-muted-foreground mt-2 mb-6">You need to be logged in to list your books.</p>
            <AuthModal>
              <Button size="lg">Login to Continue</Button>
            </AuthModal>
        </div>
      </div>
    )
  }
  
  if (!userCity) {
      return (
         <div className="bg-secondary">
            <div className="container py-12 md:py-16 text-center min-h-[60vh] flex flex-col justify-center items-center">
                 <Alert variant="destructive" className="max-w-md text-left">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Location Required</AlertTitle>
                    <AlertDescription>
                        To list a book for sale or exchange, please add your city to your profile first.
                        <Button variant="link" asChild className="p-0 h-auto ml-1">
                            <Link href="/profile/settings">Go to Profile Settings</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        </div>
      )
  }

  // Show loading state when loading book data for editing
  if (isLoadingBookData) {
    return (
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading book data...</p>
        </div>
      </div>
    );
  }

  // Show error state if book loading failed
  if (loadError) {
    return (
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Book</AlertTitle>
          <AlertDescription>
            {loadError}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-4"
              onClick={() => router.push('/books')}
            >
              Go Back to Books
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="bg-secondary">
        <div className="container py-12 md:py-16">
            <Card className="max-w-3xl mx-auto border-2 shadow-xl shadow-primary/10">
                <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold font-headline text-primary">
                  {isEditMode ? 'Edit Your Book' : 'List Your Book'}
                </CardTitle>
                <CardDescription className="text-lg">Fill out the details below to add your book to the marketplace.</CardDescription>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <Label htmlFor="title">Book Title</Label>
                          <Input id="title" placeholder="e.g., The Midnight Library" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isListingLoading}/>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="author">Author</Label>
                          <Input id="author" placeholder="e.g., Matt Haig" value={author} onChange={(e) => setAuthor(e.target.value)} disabled={isListingLoading} />
                      </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="A short summary of the book and its physical condition." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isListingLoading} />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Cover Image</Label>
                        <Label htmlFor="cover-image" className="cursor-pointer">
                            <div className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 text-center bg-background hover:border-primary transition-colors">
                                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground"/>
                                <p className="mt-4 text-muted-foreground">{coverImage ? coverImage.name : 'Click to upload your book cover'}</p>
                                <Input id="cover-image" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" disabled={isListingLoading || isAnalyzing} />
                            </div>
                        </Label>
                    </div>

                    <Card className="bg-accent/10 border-accent/50">
                        <CardHeader>
                            <CardTitle className="text-xl font-headline flex items-center gap-2 text-accent-foreground"><Sparkles className="h-5 w-5 text-accent"/>AI-Powered Suggestions</CardTitle>
                            <CardDescription>Get suggestions for your book's condition and price based on the details you've provided.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!analysisResult && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                     <Button type="button" onClick={handleAnalyze} disabled={isAnalyzing}>
                                        {isAnalyzing ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Analyzing...</>
                                        ) : (
                                            <><Wand2 className="mr-2 h-4 w-4"/>Get AI Suggestions</>
                                        )}
                                    </Button>
                                    <p className="text-sm text-muted-foreground flex-1">Fill in the title, author, description, and upload an image to enable suggestions.</p>
                                </div>
                            )}
                             {analysisResult && (
                                <div className="space-y-4">
                                    <p className="text-sm text-accent-foreground/90 italic">"{analysisResult.justification}"</p>
                                    <div className="flex items-center gap-6">
                                        <div>
                                            <p className="text-sm font-medium">Suggested Condition</p>
                                            <p className="text-lg font-semibold capitalize">{analysisResult.suggestedCondition.replace('-', ' ')}</p>
                                        </div>
                                        {listingType === 'sell' && (
                                            <div>
                                                <p className="text-sm font-medium">Suggested Price (PKR)</p>
                                                <p className="text-lg font-semibold">Rs. {analysisResult.suggestedPricePKR.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>
                                    <Button type="button" size="sm" onClick={applySuggestion}>Apply Suggestions</Button>
                                </div>
                            )}
                            {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <Label htmlFor="genre">Genre</Label>
                          <Select onValueChange={(v) => setGenre(v as BookGenre)} value={genre} disabled={isListingLoading}>
                              <SelectTrigger id="genre">
                              <SelectValue placeholder="Select a genre" />
                              </SelectTrigger>
                              <SelectContent>
                                {genres.map(g => (
                                    <SelectItem key={g} value={g} className="capitalize">{g.replace('-', ' ')}</SelectItem>
                                ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="condition">Condition</Label>
                          <Select onValueChange={(value) => setCondition(value as 'new' | 'like-new' | 'used' | 'worn')} value={condition} disabled={isListingLoading}>
                              <SelectTrigger id="condition">
                              <SelectValue placeholder="Select the book's condition" />
                              </SelectTrigger>
                              <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="like-new">Like New</SelectItem>
                              <SelectItem value="used">Used</SelectItem>
                              <SelectItem value="worn">Worn</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Listing Type</Label>
                        <RadioGroup value={listingType} onValueChange={(v) => setListingType(v as 'sell' | 'exchange')} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="sell" id="sell"/>
                                <Label htmlFor="sell" className="text-base cursor-pointer">For Sale</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="exchange" id="exchange"/>
                                <Label htmlFor="exchange" className="text-base cursor-pointer">For Exchange</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {listingType === 'sell' && (
                        <div className="space-y-2">
                            <Label htmlFor="price">Price (PKR)</Label>
                            <Input id="price" type="number" placeholder="Enter price if for sale" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isListingLoading}/>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" className="px-10 py-7 text-lg" disabled={isListingLoading}>
                           {isListingLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Listing...</>
                            ) : (isEditMode ? 'Update Book' : 'List My Book')}
                        </Button>
                    </div>
                </form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

export default function SellBookPage() {
  return (
    <Suspense fallback={
      <div className="container py-12 md:py-16 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <SellBookForm />
    </Suspense>
  );
}
