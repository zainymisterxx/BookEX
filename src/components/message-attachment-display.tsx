'use client';

import { useState } from 'react';
import { Image, FileText, File, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { MessageAttachment } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MessageAttachmentDisplayProps {
    attachments: MessageAttachment[];
    className?: string;
}

export function MessageAttachmentDisplay({ attachments, className }: MessageAttachmentDisplayProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    if (!attachments || attachments.length === 0) return null;

    const getFileIcon = (type: MessageAttachment['type']) => {
        switch (type) {
            case 'image':
                return <Image className="w-5 h-5" />;
            case 'document':
                return <FileText className="w-5 h-5" />;
            case 'spreadsheet':
                return <FileText className="w-5 h-5 text-green-600" />;
            default:
                return <File className="w-5 h-5" />;
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleDownload = (attachment: MessageAttachment) => {
        const link = document.createElement('a');
        link.href = attachment.url;
        link.download = attachment.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const imageAttachments = attachments.filter(a => a.type === 'image');
    const fileAttachments = attachments.filter(a => a.type !== 'image');

    return (
        <div className={cn("space-y-2", className)}>
            {/* Image Gallery */}
            {imageAttachments.length > 0 && (
                <div className={cn(
                    "grid gap-2",
                    imageAttachments.length === 1 && "grid-cols-1",
                    imageAttachments.length === 2 && "grid-cols-2",
                    imageAttachments.length >= 3 && "grid-cols-2 sm:grid-cols-3"
                )}>
                    {imageAttachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="relative group cursor-pointer overflow-hidden rounded-lg border"
                            onClick={() => setSelectedImage(attachment.url)}
                        >
                            <img
                                src={attachment.thumbnailUrl || attachment.url}
                                alt={attachment.fileName}
                                className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* File Attachments */}
            {fileAttachments.length > 0 && (
                <div className="space-y-1">
                    {fileAttachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded">
                                {getFileIcon(attachment.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {attachment.fileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(attachment.fileSize)}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(attachment)}
                                className="flex-shrink-0"
                            >
                                <Download className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Viewer Dialog */}
            <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
                <DialogContent className="max-w-4xl">
                    {selectedImage && (
                        <img
                            src={selectedImage}
                            alt="Full size"
                            className="w-full h-auto max-h-[80vh] object-contain"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
