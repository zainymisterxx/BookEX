
"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';
import { AuthModal } from '@/components/auth-modal';
import { applyForOrganization } from '@/app/actions';
import { uploadImageFile } from '@/lib/upload-client';

export default function ApplyToDonatePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoImage, setLogoImage] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      setLogoImage(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
        toast({
            variant: 'destructive',
            title: 'Not logged in',
            description: 'You must be logged in to submit an application.',
        });
        return;
    }

    if (!name || !description || !location || !logoImage) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please fill in all the required fields, including the logo.',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const imageUrl = (await uploadImageFile(logoImage, 'organizationImage', 'community', session.user.id)).url;
      
      const result = await applyForOrganization({
        name,
        description,
        location,
        imageUrl,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        website: website.trim() || undefined,
        submittedBy: session.user.id,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: 'Application Submitted!',
        description: 'Thank you. Your application will be reviewed by our team shortly.',
      });
      router.push('/donate');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
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
            <p className="text-muted-foreground mt-2 mb-6">You need to be logged in to apply on behalf of an organization.</p>
            <AuthModal>
              <Button size="lg">Login to Continue</Button>
            </AuthModal>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-secondary">
        <div className="container py-12 md:py-16">
            <Card className="max-w-3xl mx-auto border-2 shadow-xl shadow-primary/10">
                <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold font-headline text-primary flex items-center justify-center gap-3"><Building />Organization Application</CardTitle>
                <CardDescription className="text-lg">Fill out the details below to apply to receive book donations.</CardDescription>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-2">
                        <Label htmlFor="name">Organization Name</Label>
                        <Input id="name" placeholder="e.g., The Readers Foundation" value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting}/>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="location">Location (City)</Label>
                        <Input id="location" placeholder="e.g., Karachi" value={location} onChange={(e) => setLocation(e.target.value)} disabled={isSubmitting}/>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="A brief description of your organization and how you use book donations." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} />
                    </div>

                    {/* Contact Information - Optional Fields */}
                    <div className="space-y-4 border-t pt-6">
                        <h3 className="text-lg font-semibold text-muted-foreground">Contact Information (Optional)</h3>
                        
                        <div className="space-y-2">
                            <Label htmlFor="contact-email">Contact Email</Label>
                            <Input 
                                id="contact-email" 
                                type="email" 
                                placeholder="contact@yourorganization.org" 
                                value={contactEmail} 
                                onChange={(e) => setContactEmail(e.target.value)} 
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact-phone">Contact Phone</Label>
                            <Input 
                                id="contact-phone" 
                                type="tel" 
                                placeholder="+92 300 1234567" 
                                value={contactPhone} 
                                onChange={(e) => setContactPhone(e.target.value)} 
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input 
                                id="website" 
                                type="url" 
                                placeholder="https://yourorganization.org" 
                                value={website} 
                                onChange={(e) => setWebsite(e.target.value)} 
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="logo-image">Organization Logo</Label>
                        <Label htmlFor="logo-image" className="cursor-pointer">
                            <div className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-8 text-center bg-background hover:border-primary transition-colors">
                                <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground"/>
                                <p className="mt-4 text-muted-foreground">{logoImage ? logoImage.name : 'Click to upload your logo'}</p>
                                <Input id="logo-image" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" disabled={isSubmitting} />
                            </div>
                        </Label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" className="px-10 py-7 text-lg" disabled={isSubmitting}>
                           {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                            ) : 'Submit Application'}
                        </Button>
                    </div>
                </form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
