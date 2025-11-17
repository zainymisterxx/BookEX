'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, FileText, File, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageAttachment } from '@/lib/types';

interface FileAttachmentUploadProps {
    onFilesSelected: (attachments: MessageAttachment[]) => void;
    onRemoveAttachment: (id: string) => void;
    attachments: MessageAttachment[];
    maxFiles?: number;
    maxFileSize?: number; // in MB
}

export function FileAttachmentUpload({
    onFilesSelected,
    onRemoveAttachment,
    attachments,
    maxFiles = 5,
    maxFileSize = 10
}: FileAttachmentUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) {
            return <Image className="w-4 h-4" />;
        } else if (mimeType.includes('pdf') || mimeType.includes('document')) {
            return <FileText className="w-4 h-4" />;
        } else {
            return <File className="w-4 h-4" />;
        }
    };

    const getFileType = (mimeType: string): MessageAttachment['type'] => {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('msword')) {
            return 'document';
        }
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
            return 'spreadsheet';
        }
        return 'other';
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        if (attachments.length + files.length > maxFiles) {
            alert(`Maximum ${maxFiles} files allowed`);
            return;
        }

        setIsProcessing(true);
        const newAttachments: MessageAttachment[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Check file size
                const fileSizeMB = file.size / (1024 * 1024);
                if (fileSizeMB > maxFileSize) {
                    alert(`File "${file.name}" exceeds ${maxFileSize}MB limit`);
                    continue;
                }

                // Convert to data URI for preview/storage
                const dataUrl = await readFileAsDataURL(file);

                const attachment: MessageAttachment = {
                    id: `${Date.now()}-${i}`,
                    type: getFileType(file.type),
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    url: dataUrl,
                    uploadedAt: new Date().toISOString()
                };

                // Generate thumbnail for images
                if (file.type.startsWith('image/')) {
                    attachment.thumbnailUrl = dataUrl; // Use same URL for now
                }

                newAttachments.push(attachment);
            }

            if (newAttachments.length > 0) {
                onFilesSelected(newAttachments);
            }
        } catch (error) {
            console.error('Error processing files:', error);
            alert('Failed to process some files');
        } finally {
            setIsProcessing(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const readFileAsDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    return (
        <div className="space-y-2">
            {/* Attachment Button */}
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || attachments.length >= maxFiles}
                    className="gap-2"
                >
                    <Paperclip className="w-4 h-4" />
                    {isProcessing ? 'Processing...' : 'Attach Files'}
                </Button>
                <span className="text-xs text-gray-500">
                    {attachments.length}/{maxFiles} files • Max {maxFileSize}MB each
                </span>
            </div>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg">
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg group hover:bg-gray-50 transition-colors"
                        >
                            {attachment.type === 'image' && attachment.thumbnailUrl ? (
                                <img
                                    src={attachment.thumbnailUrl}
                                    alt={attachment.fileName}
                                    className="w-10 h-10 object-cover rounded"
                                />
                            ) : (
                                <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded">
                                    {getFileIcon(attachment.mimeType)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate max-w-[150px]">
                                    {attachment.fileName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatFileSize(attachment.fileSize)}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemoveAttachment(attachment.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-4 h-4 text-red-600" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
