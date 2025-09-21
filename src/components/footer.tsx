
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function Footer() {
  return (
    <footer className="border-t bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 flex flex-col">
             <Link href="/" className="flex items-center gap-2 mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
                <span className="font-bold font-headline text-2xl text-primary">BookEx</span>
            </Link>
            <p className="text-muted-foreground text-base max-w-sm">
                Your community for buying, selling, and exchanging pre-loved books. Give your stories a new home.
            </p>
          </div>
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-4 text-lg">BookEx</h3>
            <ul className="space-y-3">
              <li><Link href="/books" className="text-base text-muted-foreground hover:text-primary transition-colors">Buy</Link></li>
              <li><Link href="/exchange" className="text-base text-muted-foreground hover:text-primary transition-colors">Exchange</Link></li>
              <li><Link href="/donate" className="text-base text-muted-foreground hover:text-primary transition-colors">Donate</Link></li>
            </ul>
          </div>
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-4 text-lg">Community</h3>
            <ul className="space-y-3">
              <li><Link href="/community" className="text-base text-muted-foreground hover:text-primary transition-colors">Discussions</Link></li>
              <li><Link href="/profile/me" className="text-base text-muted-foreground hover:text-primary transition-colors">My Profile</Link></li>
            </ul>
          </div>
          <div className="lg:col-span-4">
             <h3 className="font-semibold mb-4 text-lg">Join Our Newsletter</h3>
             <p className="text-muted-foreground mb-4">Get the latest updates on new listings and community events.</p>
             <div className="flex w-full max-w-sm items-center space-x-2">
                <Input type="email" placeholder="Email" className="h-11" />
                <Button type="submit" className="h-11">Subscribe</Button>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-base text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} BookEx. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
