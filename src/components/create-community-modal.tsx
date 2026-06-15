
"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, UploadCloud, Users } from 'lucide-react';
import { AuthModal } from './auth-modal';
import { createCommunity } from '@/app/actions';
import { uploadImageFile } from '@/lib/upload-client';


export function CreateCommunityModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: session } = useSession();
  const user = session?.user;
  const { toast } = useToast();
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to create a community.' });
      return;
    }
    if (!name || !description) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in name and description.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      if (coverImage) {
        try {
          imageUrl = (await uploadImageFile(coverImage, 'communityImage', 'community', user.id)).url;
        } catch {
          toast({ variant: 'destructive', title: 'Image upload failed', description: 'Could not upload cover image. Creating community without one.' });
        }
      }
      
      const result = await createCommunity({
        name,
        description,
        imageUrl: imageUrl || undefined,
        createdBy: user.id,
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to create community');
      }
      if (!result.data?.communityId) {
        throw new Error('Failed to create community');
      }

      toast({
        title: 'Community Created!',
        description: `Your new community "${name}" is now live.`,
      });
      
      router.push(`/community/${result.data.communityId}`);
      setOpen(false);

    } catch (error) {
      console.error('Error creating community:', error);
      toast({ variant: 'destructive', title: 'Creation failed', description: 'Could not create the community.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
        <AuthModal>
            {children}
        </AuthModal>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline flex items-center gap-2"><Users />Create a New Community</DialogTitle>
          <DialogDescription>
            Build a space for fellow readers to connect. Fill in the details to get started.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
                <Label htmlFor="comm-name">Community Name</Label>
                <Input id="comm-name" placeholder="e.g., Karachi Book Worms" value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="comm-description">Description</Label>
                <Textarea id="comm-description" placeholder="A short description of what your community is about." value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="comm-cover">Cover Image</Label>
                <Label htmlFor="comm-cover" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary">
                        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground"/>
                        <p className="mt-2 text-sm text-muted-foreground">{coverImage ? coverImage.name : 'Click to upload a cover image'}</p>
                        <Input id="comm-cover" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" disabled={isSubmitting} />
                    </div>
                </Label>
            </div>
            <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSubmitting}>
                   {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                   Create Community
                </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
