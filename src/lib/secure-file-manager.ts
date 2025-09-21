/**
 * Secure file upload system with malware scanning and access control
 * Implements comprehensive file security for BookEx platform
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { createAppError, ErrorType } from './error-handling';
import { ResourceAuthority, type AuthorizedUser } from './resource-authorization';

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  quarantineDays: number;
  virusScanEnabled: boolean;
}

export interface SecureFileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  uploadedBy: string;
  uploadedAt: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'error';
  scanResult?: any;
  accessLevel: 'public' | 'private' | 'restricted';
  associatedResource?: {
    type: 'book' | 'user' | 'community';
    id: string;
  };
  storageLocation: string;
  expiresAt?: string;
}

export interface VirusScanResult {
  isClean: boolean;
  threats: string[];
  scanEngine: string;
  scanTime: string;
  confidence: number;
}

/**
 * File upload configurations for different contexts
 */
export const FILE_CONFIGS: Record<string, FileUploadConfig> = {
  userAvatar: {
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    quarantineDays: 3,
    virusScanEnabled: true
  },
  bookImage: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    quarantineDays: 7,
    virusScanEnabled: true
  },
  document: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['application/pdf', 'text/plain'],
    allowedExtensions: ['.pdf', '.txt'],
    quarantineDays: 14,
    virusScanEnabled: true
  },
  chatAttachment: {
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.doc', '.docx'],
    quarantineDays: 30,
    virusScanEnabled: true
  }
};

/**
 * Secure file upload and management system
 */
export class SecureFileManager {
  private static readonly UPLOAD_DIR = process.env.SECURE_UPLOAD_DIR || './secure-uploads';
  private static readonly QUARANTINE_DIR = process.env.QUARANTINE_DIR || './quarantine';
  private static readonly MAX_FILENAME_LENGTH = 255;
  
  /**
   * Validates file against security policies
   */
  static async validateFile(
    fileBuffer: Buffer, 
    originalName: string, 
    config: FileUploadConfig
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 1. File size validation
    if (fileBuffer.length > config.maxFileSize) {
      errors.push(`File size exceeds limit (${Math.round(config.maxFileSize / 1024 / 1024)}MB)`);
    }

    // 2. Filename validation
    if (originalName.length > this.MAX_FILENAME_LENGTH) {
      errors.push('Filename too long');
    }

    // 3. Extension validation
    const extension = path.extname(originalName).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      errors.push(`File extension not allowed. Allowed: ${config.allowedExtensions.join(', ')}`);
    }

    // 4. MIME type validation (check actual file content)
    const detectedMimeType = await this.detectMimeType(fileBuffer);
    if (!config.allowedMimeTypes.includes(detectedMimeType)) {
      errors.push(`File type not allowed. Detected: ${detectedMimeType}`);
    }

    // 5. Filename security check
    if (this.hasInsecureFilename(originalName)) {
      errors.push('Filename contains unsafe characters');
    }

    // 6. File header validation (magic number check)
    if (!this.validateFileHeader(fileBuffer, detectedMimeType)) {
      errors.push('File header validation failed - file may be corrupted or malicious');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Detects actual MIME type from file content
   */
  private static async detectMimeType(buffer: Buffer): Promise<string> {
    // Check magic numbers for common file types
    const signatures: Record<string, string> = {
      'image/jpeg': 'ffd8ff',
      'image/png': '89504e47',
      'image/webp': '52494646',
      'application/pdf': '25504446',
      'text/plain': '', // Text files don't have a consistent magic number
    };

    const header = buffer.subarray(0, 12).toString('hex');
    
    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (signature && header.startsWith(signature)) {
        return mimeType;
      }
    }

    // Default fallback - attempt to detect if it's text
    try {
      const sample = buffer.subarray(0, 1024).toString('utf8');
      if (sample.length > 0 && /^[\x09\x0A\x0D\x20-\x7E]*$/.test(sample)) {
        return 'text/plain';
      }
    } catch {
      // Not valid UTF-8
    }

    return 'application/octet-stream';
  }

  /**
   * Validates file header against expected MIME type
   */
  private static validateFileHeader(buffer: Buffer, mimeType: string): boolean {
    const header = buffer.subarray(0, 12).toString('hex');
    
    switch (mimeType) {
      case 'image/jpeg':
        return header.startsWith('ffd8ff');
      case 'image/png':
        return header.startsWith('89504e47');
      case 'image/webp':
        return header.startsWith('52494646');
      case 'application/pdf':
        return header.startsWith('25504446');
      case 'text/plain':
        return true; // Text validation is done in MIME detection
      default:
        return false;
    }
  }

  /**
   * Checks for unsafe filename patterns
   */
  private static hasInsecureFilename(filename: string): boolean {
    // Check for directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return true;
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      return true;
    }

    // Check for unsafe characters
    const unsafeChars = /[<>:"|?*\x00-\x1f]/;
    if (unsafeChars.test(filename)) {
      return true;
    }

    // Check for reserved Windows names
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const nameWithoutExt = path.parse(filename).name.toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      return true;
    }

    return false;
  }

  /**
   * Performs virus scan on uploaded file
   */
  static async performVirusScan(fileBuffer: Buffer, filename: string): Promise<VirusScanResult> {
    // In a production environment, this would integrate with:
    // - ClamAV
    // - Windows Defender API
    // - Third-party antivirus APIs (VirusTotal, etc.)
    
    try {
      // Simulate virus scanning logic
      const scanStartTime = new Date().toISOString();
      
      // Basic heuristic checks
      const threats: string[] = [];
      
      // 1. Check for suspicious file patterns
      if (this.hasSuspiciousPatterns(fileBuffer)) {
        threats.push('Suspicious file patterns detected');
      }

      // 2. Check file entropy (high entropy might indicate encryption/packing)
      const entropy = this.calculateEntropy(fileBuffer);
      if (entropy > 7.5) {
        threats.push('High entropy detected - possible packed/encrypted content');
      }

      // 3. Check for embedded executables
      if (this.hasEmbeddedExecutables(fileBuffer)) {
        threats.push('Embedded executable content detected');
      }

      // In production, integrate with real antivirus engine here
      // Example: await clamAV.scanBuffer(fileBuffer);
      
      return {
        isClean: threats.length === 0,
        threats,
        scanEngine: 'BookEx-Heuristic-Scanner',
        scanTime: scanStartTime,
        confidence: threats.length === 0 ? 0.85 : 0.95
      };

    } catch (error) {
      throw createAppError(
        ErrorType.SECURITY,
        'Virus scan failed',
        undefined,
        undefined,
        { filename, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Checks for suspicious patterns in file content
   */
  private static hasSuspiciousPatterns(buffer: Buffer): boolean {
    const content = buffer.toString('binary');
    
    // Check for suspicious strings that might indicate malware
    const suspiciousPatterns = [
      /eval\s*\(/gi,
      /document\.write/gi,
      /script\s*>/gi,
      /<\s*iframe/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Calculates Shannon entropy of file content
   */
  private static calculateEntropy(buffer: Buffer): number {
    const freq: Record<number, number> = {};
    
    // Count byte frequencies
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      freq[byte] = (freq[byte] || 0) + 1;
    }

    // Calculate entropy
    let entropy = 0;
    const length = buffer.length;
    
    for (const count of Object.values(freq)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Checks for embedded executable content
   */
  private static hasEmbeddedExecutables(buffer: Buffer): boolean {
    const content = buffer.toString('binary');
    
    // Check for PE header (Windows executables)
    if (content.includes('MZ') && content.includes('PE')) {
      return true;
    }

    // Check for ELF header (Linux executables)
    if (content.startsWith('\x7fELF')) {
      return true;
    }

    // Check for Mach-O header (macOS executables)
    if (content.includes('\xfe\xed\xfa\xce') || content.includes('\xfe\xed\xfa\xcf')) {
      return true;
    }

    return false;
  }

  /**
   * Securely stores uploaded file
   */
  static async secureStore(
    fileBuffer: Buffer,
    metadata: Omit<SecureFileMetadata, 'id' | 'hash' | 'uploadedAt' | 'storageLocation'>
  ): Promise<SecureFileMetadata> {
    try {
      // Generate secure file ID and hash
      const fileId = crypto.randomUUID();
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Create secure filename
      const extension = path.extname(metadata.originalName);
      const secureFilename = `${fileId}${extension}`;
      
      // Determine storage directory based on scan status
      const storageDir = metadata.scanStatus === 'clean' ? this.UPLOAD_DIR : this.QUARANTINE_DIR;
      const storagePath = path.join(storageDir, secureFilename);
      
      // Ensure storage directory exists
      await fs.mkdir(storageDir, { recursive: true });
      
      // Write file to secure location
      await fs.writeFile(storagePath, fileBuffer, { mode: 0o600 }); // Owner read/write only
      
      const completeMetadata: SecureFileMetadata = {
        ...metadata,
        id: fileId,
        hash: fileHash,
        uploadedAt: new Date().toISOString(),
        storageLocation: storagePath
      };

      // Store metadata in database
      await this.storeFileMetadata(completeMetadata);
      
      return completeMetadata;

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to store file securely',
        undefined,
        undefined,
        { 
          originalName: metadata.originalName,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Stores file metadata in database
   */
  private static async storeFileMetadata(metadata: SecureFileMetadata): Promise<void> {
    const clientPromise = (await import('./mongodb')).default;
    const client = await clientPromise;
    const db = client.db('bookex');

    await db.collection('secureFiles').insertOne(metadata);
  }

  /**
   * Retrieves file with access control
   */
  static async getSecureFile(
    fileId: string, 
    user: AuthorizedUser
  ): Promise<{ buffer: Buffer; metadata: SecureFileMetadata } | null> {
    try {
      const clientPromise = (await import('./mongodb')).default;
      const client = await clientPromise;
      const db = client.db('bookex');

      // Get file metadata
      const metadata = await db.collection('secureFiles').findOne({ id: fileId }) as SecureFileMetadata | null;
      
      if (!metadata) {
        return null;
      }

      // Check access permissions
      if (!await this.canAccessFile(user, metadata)) {
        throw createAppError(
          ErrorType.AUTHORIZATION,
          'Access denied to file',
          undefined,
          undefined,
          { fileId, userId: user.id }
        );
      }

      // Check if file is quarantined
      if (metadata.scanStatus !== 'clean') {
        throw createAppError(
          ErrorType.SECURITY,
          'File is not available - security scan pending or failed',
          undefined,
          undefined,
          { fileId, scanStatus: metadata.scanStatus }
        );
      }

      // Read file from storage
      const buffer = await fs.readFile(metadata.storageLocation);
      
      return { buffer, metadata };

    } catch (error) {
      if (error instanceof Error && error.name === 'AppError') {
        throw error;
      }
      
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to retrieve file',
        undefined,
        undefined,
        { fileId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Checks if user can access a file
   */
  private static async canAccessFile(user: AuthorizedUser, metadata: SecureFileMetadata): Promise<boolean> {
    // 1. Admin can access everything
    if (user.role === 'admin') {
      return true;
    }

    // 2. Owner can access their own files
    if (metadata.uploadedBy === user.id) {
      return true;
    }

    // 3. Public files are accessible to everyone
    if (metadata.accessLevel === 'public') {
      return true;
    }

    // 4. For private/restricted files, check resource ownership
    if (metadata.associatedResource) {
      try {
        switch (metadata.associatedResource.type) {
          case 'book':
            return await ResourceAuthority.canAccessBook(user, metadata.associatedResource.id, 'read');
          case 'user':
            return await ResourceAuthority.canAccessUser(user, metadata.associatedResource.id, 'read');
          case 'community':
            return await ResourceAuthority.canAccessCommunity(user, metadata.associatedResource.id, 'read');
          default:
            return false;
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Deletes file securely
   */
  static async deleteSecureFile(fileId: string, user: AuthorizedUser): Promise<void> {
    try {
      const clientPromise = (await import('./mongodb')).default;
      const client = await clientPromise;
      const db = client.db('bookex');

      // Get file metadata
      const metadata = await db.collection('secureFiles').findOne({ id: fileId }) as SecureFileMetadata | null;
      
      if (!metadata) {
        throw createAppError(ErrorType.NOT_FOUND, 'File not found');
      }

      // Check deletion permissions (only owner or admin)
      if (metadata.uploadedBy !== user.id && user.role !== 'admin') {
        throw createAppError(ErrorType.AUTHORIZATION, 'Access denied - cannot delete file');
      }

      // Delete file from storage
      try {
        await fs.unlink(metadata.storageLocation);
      } catch (error) {
        // File might already be deleted - log but don't fail
        console.warn(`Could not delete file from storage: ${metadata.storageLocation}`);
      }

      // Remove metadata from database
      await db.collection('secureFiles').deleteOne({ id: fileId });

    } catch (error) {
      if (error instanceof Error && error.name === 'AppError') {
        throw error;
      }
      
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to delete file',
        undefined,
        undefined,
        { fileId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Cleans up quarantined files older than retention period
   */
  static async cleanupQuarantinedFiles(): Promise<{ cleaned: number; errors: string[] }> {
    let cleaned = 0;
    const errors: string[] = [];

    try {
      const clientPromise = (await import('./mongodb')).default;
      const client = await clientPromise;
      const db = client.db('bookex');

      // Find old quarantined files
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days retention

      const oldFiles = await db.collection('secureFiles').find({
        scanStatus: { $in: ['infected', 'error'] },
        uploadedAt: { $lt: cutoffDate.toISOString() }
      }).toArray() as unknown as SecureFileMetadata[];

      for (const file of oldFiles) {
        try {
          // Delete from storage
          await fs.unlink(file.storageLocation);
          
          // Remove from database
          await db.collection('secureFiles').deleteOne({ id: file.id });
          
          cleaned++;
        } catch (error) {
          errors.push(`Failed to clean ${file.id}: ${error}`);
        }
      }

      return { cleaned, errors };

    } catch (error) {
      throw createAppError(
        ErrorType.INTERNAL,
        'Failed to cleanup quarantined files',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}
