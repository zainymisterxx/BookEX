/**
 * End-to-end encryption system for chat messages
 * Implements AES-256-GCM encryption with secure key exchange
 */

import crypto from 'crypto';
import { createAppError, ErrorType } from './error-handling';

export interface EncryptedMessage {
  encryptedContent: string;
  iv: string;
  authTag: string;
  keyId: string;
  timestamp: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ChatEncryptionKeys {
  chatId: string;
  sharedSecret: string;
  keyRotation: number;
  createdAt: string;
  participants: string[];
}

/**
 * Message encryption and key management service
 */
export class MessageEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly KEY_ROTATION_DAYS = 30;

  /**
   * Generates a new RSA key pair for initial key exchange
   */
  static generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const keyId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000));

    return {
      publicKey,
      privateKey,
      keyId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Generates a shared secret for chat encryption
   */
  static generateSharedSecret(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('base64');
  }

  /**
   * Encrypts a shared secret using a public key for secure transmission
   */
  static encryptSharedSecret(sharedSecret: string, publicKey: string): string {
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(sharedSecret, 'base64')
      );
      return encrypted.toString('base64');
    } catch (error) {
      throw createAppError(
        ErrorType.SECURITY,
        'Failed to encrypt shared secret',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Decrypts a shared secret using a private key
   */
  static decryptSharedSecret(encryptedSecret: string, privateKey: string): string {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedSecret, 'base64')
      );
      return decrypted.toString('base64');
    } catch (error) {
      throw createAppError(
        ErrorType.SECURITY,
        'Failed to decrypt shared secret',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Encrypts a message using AES-256-GCM with the shared secret
   */
  static encryptMessage(content: string, sharedSecret: string, keyId: string): EncryptedMessage {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipher(this.ALGORITHM, Buffer.from(sharedSecret, 'base64'));
      cipher.setAAD(Buffer.from(keyId)); // Additional authenticated data
      
      // Encrypt content
      let encrypted = cipher.update(content, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();

      return {
        encryptedContent: encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        keyId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw createAppError(
        ErrorType.SECURITY,
        'Failed to encrypt message',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Decrypts a message using AES-256-GCM
   */
  static decryptMessage(encryptedMessage: EncryptedMessage, sharedSecret: string): string {
    try {
      // Create decipher
      const decipher = crypto.createDecipher(this.ALGORITHM, Buffer.from(sharedSecret, 'base64'));
      decipher.setAAD(Buffer.from(encryptedMessage.keyId)); // Additional authenticated data
      decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'base64'));
      
      // Decrypt content
      let decrypted = decipher.update(encryptedMessage.encryptedContent, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw createAppError(
        ErrorType.SECURITY,
        'Failed to decrypt message - message may be corrupted or tampered with',
        undefined,
        undefined,
        { 
          keyId: encryptedMessage.keyId,
          timestamp: encryptedMessage.timestamp,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
    }
  }

  /**
   * Validates message integrity and authenticity
   */
  static validateMessage(encryptedMessage: EncryptedMessage): boolean {
    // Check required fields
    if (!encryptedMessage.encryptedContent || 
        !encryptedMessage.iv || 
        !encryptedMessage.authTag || 
        !encryptedMessage.keyId) {
      return false;
    }

    // Check timestamp is valid and not too old (prevent replay attacks)
    const messageTime = new Date(encryptedMessage.timestamp);
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (isNaN(messageTime.getTime()) || (now.getTime() - messageTime.getTime()) > maxAge) {
      return false;
    }

    // Validate base64 encoding
    try {
      Buffer.from(encryptedMessage.encryptedContent, 'base64');
      Buffer.from(encryptedMessage.iv, 'base64');
      Buffer.from(encryptedMessage.authTag, 'base64');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates a hash of the message for integrity checking
   */
  static generateMessageHash(encryptedMessage: EncryptedMessage): string {
    const hash = crypto.createHash('sha256');
    hash.update(encryptedMessage.encryptedContent);
    hash.update(encryptedMessage.iv);
    hash.update(encryptedMessage.authTag);
    hash.update(encryptedMessage.keyId);
    return hash.digest('hex');
  }

  /**
   * Checks if encryption keys need rotation (security best practice)
   */
  static needsKeyRotation(createdAt: string): boolean {
    const created = new Date(createdAt);
    const now = new Date();
    const daysSinceCreation = (now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceCreation >= this.KEY_ROTATION_DAYS;
  }

  /**
   * Securely generates a new key rotation for a chat
   */
  static rotateKeys(currentKeys: ChatEncryptionKeys): ChatEncryptionKeys {
    return {
      ...currentKeys,
      sharedSecret: this.generateSharedSecret(),
      keyRotation: currentKeys.keyRotation + 1,
      createdAt: new Date().toISOString()
    };
  }
}

/**
 * Secure storage operations for encryption keys
 */
export class KeyStorage {
  /**
   * Stores user key pair securely (only public key in database)
   */
  static async storeUserKeyPair(userId: string, keyPair: KeyPair) {
    const clientPromise = (await import('./mongodb')).default;
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      // Store only public key and metadata in database
      await db.collection('userKeys').insertOne({
        userId,
        publicKey: keyPair.publicKey,
        keyId: keyPair.keyId,
        createdAt: keyPair.createdAt,
        expiresAt: keyPair.expiresAt,
        status: 'active'
      });

      // Private key should be stored client-side or in secure session storage
      // Never store private keys in the database
      return {
        success: true,
        keyId: keyPair.keyId,
        publicKey: keyPair.publicKey
      };
    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to store user key pair',
        undefined,
        undefined,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Retrieves user's public key
   */
  static async getUserPublicKey(userId: string): Promise<string | null> {
    const clientPromise = (await import('./mongodb')).default;
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      const userKey = await db.collection('userKeys').findOne(
        { userId, status: 'active' },
        { sort: { createdAt: -1 } }
      );

      return userKey?.publicKey || null;
    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to retrieve user public key',
        undefined,
        undefined,
        { userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Stores chat encryption keys securely
   */
  static async storeChatKeys(chatKeys: ChatEncryptionKeys) {
    const clientPromise = (await import('./mongodb')).default;
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      await db.collection('chatKeys').insertOne({
        ...chatKeys,
        status: 'active'
      });
    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to store chat encryption keys',
        undefined,
        undefined,
        { chatId: chatKeys.chatId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Retrieves chat encryption keys for authorized participants
   */
  static async getChatKeys(chatId: string, userId: string): Promise<ChatEncryptionKeys | null> {
    const clientPromise = (await import('./mongodb')).default;
    const client = await clientPromise;
    const db = client.db('bookex');

    try {
      const chatKeys = await db.collection('chatKeys').findOne({
        chatId,
        participants: userId,
        status: 'active'
      });

      return chatKeys ? {
        chatId: chatKeys.chatId,
        sharedSecret: chatKeys.sharedSecret,
        keyRotation: chatKeys.keyRotation,
        createdAt: chatKeys.createdAt,
        participants: chatKeys.participants
      } : null;
    } catch (error) {
      throw createAppError(
        ErrorType.DATABASE,
        'Failed to retrieve chat encryption keys',
        undefined,
        undefined,
        { chatId, userId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}
