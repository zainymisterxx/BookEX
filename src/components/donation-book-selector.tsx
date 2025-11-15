'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Book, Plus, Trash2, BookOpen } from 'lucide-react';
import type { Book as BookType } from '@/lib/types';

interface DonationBook {
    bookId?: string;
    title: string;
    author: string;
    condition: 'new' | 'like-new' | 'used' | 'worn';
    quantity: number;
    notes?: string;
}

interface DonationBookSelectorProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (books: DonationBook[]) => void;
    userBooks?: BookType[];  // User's listed books for quick selection
}

export function DonationBookSelector({ open, onClose, onConfirm, userBooks = [] }: DonationBookSelectorProps) {
    const [donationBooks, setDonationBooks] = useState<DonationBook[]>([]);
    const [currentBook, setCurrentBook] = useState<DonationBook>({
        title: '',
        author: '',
        condition: 'used',
        quantity: 1,
        notes: ''
    });

    const handleAddBook = () => {
        if (!currentBook.title || !currentBook.author) {
            return;
        }

        setDonationBooks([...donationBooks, { ...currentBook }]);
        setCurrentBook({
            title: '',
            author: '',
            condition: 'used',
            quantity: 1,
            notes: ''
        });
    };

    const handleRemoveBook = (index: number) => {
        setDonationBooks(donationBooks.filter((_, i) => i !== index));
    };

    const handleSelectFromListing = (book: BookType) => {
        setCurrentBook({
            bookId: book._id.toString(),
            title: book.title,
            author: book.author,
            condition: book.condition,
            quantity: 1,
            notes: ''
        });
    };

    const handleConfirm = () => {
        if (donationBooks.length === 0) {
            return;
        }
        onConfirm(donationBooks);
        setDonationBooks([]);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Select Books to Donate</DialogTitle>
                    <DialogDescription>
                        Add books you'd like to donate. You can select from your listings or enter manually.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Quick selection from user's books */}
                    {userBooks.length > 0 && (
                        <div>
                            <Label className="text-sm font-medium">Quick Select from Your Listings</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {userBooks.slice(0, 6).map((book) => (
                                    <button
                                        key={book._id.toString()}
                                        onClick={() => handleSelectFromListing(book)}
                                        className="flex items-start gap-2 p-3 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                                    >
                                        <BookOpen className="w-4 h-4 mt-1 text-blue-600 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm truncate">{book.title}</p>
                                            <p className="text-xs text-gray-500 truncate">{book.author}</p>
                                            <p className="text-xs text-gray-400 capitalize">{book.condition}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Manual book entry */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                        <h3 className="font-medium mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Book
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="title">Book Title *</Label>
                                <Input
                                    id="title"
                                    value={currentBook.title}
                                    onChange={(e) => setCurrentBook({ ...currentBook, title: e.target.value })}
                                    placeholder="Enter book title"
                                />
                            </div>
                            <div>
                                <Label htmlFor="author">Author *</Label>
                                <Input
                                    id="author"
                                    value={currentBook.author}
                                    onChange={(e) => setCurrentBook({ ...currentBook, author: e.target.value })}
                                    placeholder="Author name"
                                />
                            </div>
                            <div>
                                <Label htmlFor="condition">Condition</Label>
                                <Select
                                    value={currentBook.condition}
                                    onValueChange={(value: any) => setCurrentBook({ ...currentBook, condition: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">New</SelectItem>
                                        <SelectItem value="like-new">Like New</SelectItem>
                                        <SelectItem value="used">Used</SelectItem>
                                        <SelectItem value="worn">Worn</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min="1"
                                    value={currentBook.quantity}
                                    onChange={(e) => setCurrentBook({ ...currentBook, quantity: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="notes">Notes (optional)</Label>
                                <Textarea
                                    id="notes"
                                    value={currentBook.notes}
                                    onChange={(e) => setCurrentBook({ ...currentBook, notes: e.target.value })}
                                    placeholder="Any additional details..."
                                    rows={2}
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleAddBook}
                            disabled={!currentBook.title || !currentBook.author}
                            className="mt-4 w-full"
                            variant="outline"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add to Donation List
                        </Button>
                    </div>

                    {/* Selected books list */}
                    {donationBooks.length > 0 && (
                        <div>
                            <Label className="text-sm font-medium">Books to Donate ({donationBooks.length})</Label>
                            <div className="space-y-2 mt-2">
                                {donationBooks.map((book, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-white">
                                        <Book className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium">{book.title}</p>
                                            <p className="text-sm text-gray-600">{book.author}</p>
                                            <p className="text-xs text-gray-500">
                                                Condition: <span className="capitalize">{book.condition}</span> • 
                                                Quantity: {book.quantity}
                                                {book.notes && ` • ${book.notes}`}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => handleRemoveBook(index)}
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={donationBooks.length === 0}
                    >
                        Confirm Donation ({donationBooks.length} {donationBooks.length === 1 ? 'book' : 'books'})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
