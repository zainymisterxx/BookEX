'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, FileText, File, X, Loader2 } from 'lucide-react';
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
    const [isUploading, setIsUploading] = useState(false);

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

        setIsUploading(true);
        const newAttachments: MessageAttachment[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                if (file.size / (1024 * 1024) > maxFileSize) {
                    alert(`File "${file.name}" exceeds ${maxFileSize}MB limit`);
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('uploadType', 'temp');

                const res = await fetch('/api/media/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                });

                const payload = await res.json().catch(() => null);
                if (!res.ok || !payload?.success) {
                    alert(`Failed to upload "${file.name}": ${payload?.message || 'Unknown error'}`);
                    continue;
                }

                const attachment: MessageAttachment = {
                    id: `${Date.now()}-${i}`,
                    type: getFileType(file.type),
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    url: payload.data.url,
                    uploadedAt: new Date().toISOString(),
                };

                if (file.type.startsWith('image/')) {
                    attachment.thumbnailUrl = payload.data.url;
                }

                newAttachments.push(attachment);
            }

            if (newAttachments.length > 0) {
                onFilesSelected(newAttachments);
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            alert('Failed to upload some files');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
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
                    disabled={isUploading || attachments.length >= maxFiles}
                    className="gap-2"
                >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {isUploading ? 'Uploading...' : 'Attach Files'}
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
