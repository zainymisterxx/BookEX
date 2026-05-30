import { Resend } from 'resend';
import { getBaseUrl } from './url-utils';

const FROM_ADDRESS = 'BookEX <noreply@bookex.app>';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration validation types
export interface EmailConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    hasApiKey: boolean;
    fromAddress: string;
  };
}

export interface EmailTestResult {
  success: boolean;
  message: string;
  details?: unknown;
}

/**
 * Comprehensive email configuration validation
 */
export const validateEmailConfiguration = (): EmailConfigValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.RESEND_API_KEY) {
    errors.push('RESEND_API_KEY is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: {
      hasApiKey: !!process.env.RESEND_API_KEY,
      fromAddress: FROM_ADDRESS,
    },
  };
};

/**
 * Test email configuration by verifying the API key is present
 */
export const testEmailConnection = async (): Promise<EmailTestResult> => {
  const validation = validateEmailConfiguration();
  if (!validation.isValid) {
    return {
      success: false,
      message: `Configuration validation failed: ${validation.errors.join(', ')}`,
      details: validation,
    };
  }

  return {
    success: true,
    message: 'Resend configuration is valid',
    details: { fromAddress: FROM_ADDRESS },
  };
};

/**
 * Send a test email to verify configuration
 */
export const sendTestEmail = async (to: string): Promise<EmailTestResult> => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'BookEX Email Configuration Test',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Email Test</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .success { color: #22c55e; }
              .info { background: #f0f9ff; padding: 15px; border-radius: 6px; }
            </style>
          </head>
          <body>
            <h2 class="success">✅ Email Configuration Test Successful!</h2>
            <p>Your BookEX email configuration is working correctly.</p>
            <div class="info">
              <strong>Test Details:</strong><br>
              • From: ${FROM_ADDRESS}<br>
              • To: ${to}<br>
              • Timestamp: ${new Date().toISOString()}
            </div>
            <p><em>This is an automated test email from BookEX.</em></p>
          </body>
        </html>
      `,
    });

    if (error) {
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
        details: { error },
      };
    }

    return {
      success: true,
      message: 'Test email sent successfully',
      details: { id: data?.id },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to send test email: ${message}`,
      details: { error: message },
    };
  }
};

/**
 * Initialize email system with validation
 */
export const initializeEmailSystem = async (): Promise<{
  success: boolean;
  message: string;
  details?: unknown;
}> => {
  console.log('Initializing email system...');

  const validation = validateEmailConfiguration();

  if (!validation.isValid) {
    const errorMsg = `Email configuration invalid: ${validation.errors.join(', ')}`;
    console.error(errorMsg);
    return { success: false, message: errorMsg, details: validation };
  }

  if (validation.warnings.length > 0) {
    console.warn('Email configuration warnings:', validation.warnings.join(', '));
  }

  console.log('Email system initialized successfully');
  console.log(`From address: ${validation.config.fromAddress}`);

  return {
    success: true,
    message: 'Email system initialized successfully',
    details: { validation },
  };
};

// Legacy function for backward compatibility
export const verifyEmailConfig = async () => {
  const result = await testEmailConnection();
  return result.success;
};

// Send email verification email
export const sendEmailVerificationEmail = async (
  to: string,
  name: string,
  verificationUrl: string
) => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Verify your BookEX email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BookEX</h1>
            </div>
            <div class="content">
              <h2>Verify your email address</h2>
              <p>Hello ${name},</p>
              <p>Thanks for signing up! Please confirm your email address by clicking the button below.</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p><strong>This link expires in 24 hours.</strong></p>
              <div class="footer">
                <p>If you didn't create an account on BookEX, you can safely ignore this email.</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending email verification email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email verification email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending email verification email:', error);
    return { success: false, error: String(error) };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetToken: string
) => {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${resetToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Reset Your BookEX Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BookEX</h1>
            </div>
            <div class="content">
              <h2>Reset Your Password</h2>
              <p>Hello ${name},</p>
              <p>We received a request to reset your password for your BookEX account. If you didn't make this request, you can safely ignore this email.</p>
              <p>To reset your password, click the button below:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              <div class="footer">
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }

    console.log('Password reset email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: String(error) };
  }
};

// Send welcome email for new users
export const sendWelcomeEmail = async (to: string, name: string) => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Welcome to BookEX!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to BookEX</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .feature { background: white; padding: 20px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #2563eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Welcome to BookEX!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name}!</h2>
              <p>Welcome to BookEX, your new favorite platform for buying, selling, and exchanging books with fellow readers in your community.</p>

              <div class="feature">
                <h3>📚 Buy &amp; Sell Books</h3>
                <p>Discover great books at affordable prices or sell books you've finished reading.</p>
              </div>

              <div class="feature">
                <h3>🔄 Exchange Books</h3>
                <p>Trade books with other readers in your city - perfect for expanding your library without spending money!</p>
              </div>

              <div class="feature">
                <h3>👥 Join Communities</h3>
                <p>Connect with like-minded readers, share recommendations, and discuss your favorite books.</p>
              </div>

              <div class="feature">
                <h3>💝 Donate Books</h3>
                <p>Give back to your community by donating books to local organizations and charities.</p>
              </div>

              <a href="${getBaseUrl()}" class="button">Start Exploring</a>

              <p>Happy reading!</p>
              <p>The BookEX Team</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }

    console.log('Welcome email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: String(error) };
  }
};

// Send exchange proposal notification email
export const sendExchangeProposalEmail = async (
  to: string,
  recipientName: string,
  proposerName: string,
  proposerBook: { title: string; author: string; imageUrl?: string },
  recipientBook: { title: string; author: string; imageUrl?: string },
  proposalMessage: string,
  _exchangeId: string
) => {
  const exchangeUrl = `${getBaseUrl()}/exchange/history`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: `📚 New Book Exchange Proposal from ${proposerName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Exchange Proposal</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .exchange-preview { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; display: flex; align-items: center; gap: 20px; }
              .book-info { flex: 1; text-align: center; }
              .book-title { font-weight: bold; color: #2563eb; margin-bottom: 5px; }
              .book-author { color: #666; font-size: 14px; }
              .arrow { color: #2563eb; font-size: 24px; font-weight: bold; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .message-box { background: #f1f5f9; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📚 New Book Exchange Proposal!</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>

              <p><strong>${proposerName}</strong> has proposed a book exchange with you!</p>

              <div class="exchange-preview">
                <div class="book-info">
                  <div class="book-title">${proposerBook.title}</div>
                  <div class="book-author">by ${proposerBook.author}</div>
                  <small style="color: #2563eb;">Their Book</small>
                </div>
                <div class="arrow">⇄</div>
                <div class="book-info">
                  <div class="book-title">${recipientBook.title}</div>
                  <div class="book-author">by ${recipientBook.author}</div>
                  <small style="color: #2563eb;">Your Book</small>
                </div>
              </div>

              <div class="message-box">
                <strong>Their message:</strong><br>
                "${proposalMessage}"
              </div>

              <p>You can review this proposal and respond directly in your exchange history.</p>

              <a href="${exchangeUrl}" class="button">View Exchange Proposal</a>

              <p>Happy exchanging!</p>
              <p>The BookEX Team</p>
            </div>

            <div class="footer">
              <p>You received this email because you have a book listed for exchange on BookEX.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending exchange proposal email:', error);
      return { success: false, error: error.message };
    }

    console.log('Exchange proposal email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending exchange proposal email:', error);
    return { success: false, error: String(error) };
  }
};

// Send exchange status update email
export const sendExchangeStatusUpdateEmail = async (
  to: string,
  recipientName: string,
  otherUserName: string,
  bookTitle: string,
  newStatus: string,
  _exchangeId: string
) => {
  const exchangeUrl = `${getBaseUrl()}/exchange/history`;

  const statusMessages = {
    accepted: {
      subject: '✅ Your Book Exchange was Accepted!',
      title: 'Exchange Accepted!',
      message: `Great news! ${otherUserName} has accepted your book exchange proposal for "${bookTitle}".`,
      action: 'You can now coordinate the book swap through your messages.',
    },
    in_progress: {
      subject: '📦 Your Book Exchange is Now in Progress',
      title: 'Exchange in Progress',
      message: `Your book exchange with ${otherUserName} for "${bookTitle}" is now in progress.`,
      action: "Don't forget to coordinate the meetup and confirm completion when done.",
    },
    completed: {
      subject: '🎉 Book Exchange Completed Successfully!',
      title: 'Exchange Completed!',
      message: `Congratulations! Your book exchange with ${otherUserName} for "${bookTitle}" has been completed.`,
      action: 'We hope you enjoy your new book! Consider leaving a review.',
    },
    cancelled: {
      subject: '❌ Book Exchange Cancelled',
      title: 'Exchange Cancelled',
      message: `Your book exchange with ${otherUserName} for "${bookTitle}" has been cancelled.`,
      action: 'You can browse other available books for exchange.',
    },
  };

  const statusInfo = statusMessages[newStatus as keyof typeof statusMessages];
  if (!statusInfo) return { success: false, error: 'Unknown status' };

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: statusInfo.subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${statusInfo.title}</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${statusInfo.title}</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>

              <p>${statusInfo.message}</p>

              <p>${statusInfo.action}</p>

              <a href="${exchangeUrl}" class="button">View Exchange Details</a>

              <p>Happy reading!</p>
              <p>The BookEX Team</p>
            </div>

            <div class="footer">
              <p>You received this email because you have an active book exchange on BookEX.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending exchange status update email:', error);
      return { success: false, error: error.message };
    }

    console.log('Exchange status update email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending exchange status update email:', error);
    return { success: false, error: String(error) };
  }
};

// Send book contact notification email
export const sendBookContactEmail = async (
  to: string,
  sellerName: string,
  buyerName: string,
  bookTitle: string,
  bookType: 'sell' | 'exchange',
  chatId: string
) => {
  const chatUrl = `${getBaseUrl()}/messages/${chatId}`;
  const actionType = bookType === 'exchange' ? 'exchange' : 'purchase';

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: `💬 Someone is interested in your book "${bookTitle}"`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Book Inquiry</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .book-highlight { background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>💬 New Book Inquiry!</h1>
            </div>
            <div class="content">
              <p>Hi ${sellerName},</p>

              <p><strong>${buyerName}</strong> is interested in your book and has started a conversation with you!</p>

              <div class="book-highlight">
                <h3 style="color: #2563eb; margin: 0;">"${bookTitle}"</h3>
                <p style="margin: 5px 0 0 0; color: #666;">Available for ${actionType}</p>
              </div>

              <p>Respond quickly to increase your chances of making a successful ${actionType}!</p>

              <a href="${chatUrl}" class="button">View Conversation</a>

              <p>Happy ${bookType === 'exchange' ? 'exchanging' : 'selling'}!</p>
              <p>The BookEX Team</p>
            </div>

            <div class="footer">
              <p>You received this email because someone contacted you about your book listing on BookEX.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending book contact email:', error);
      return { success: false, error: error.message };
    }

    console.log('Book contact email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending book contact email:', error);
    return { success: false, error: String(error) };
  }
};

// Send admin notification when organization applies
export const sendOrgApplicationNotificationEmail = async (
  adminEmail: string,
  organizationName: string,
  organizationDescription: string,
  submittedBy: string,
  organizationId: string
) => {
  const reviewUrl = `${getBaseUrl()}/admin`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [adminEmail],
      subject: `📋 New Organization Application: ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Organization Application</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .org-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 New Organization Application</h1>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A new organization has applied to join the BookEX donation program.</p>

              <div class="org-card">
                <h3>${organizationName}</h3>
                <p><strong>Description:</strong> ${organizationDescription}</p>
                <p><strong>Submitted by:</strong> ${submittedBy}</p>
                <p><strong>Application ID:</strong> ${organizationId}</p>
              </div>

              <p>Please review this application and approve or reject it.</p>

              <a href="${reviewUrl}" class="button">Review Application</a>

              <div class="footer">
                <p>Best regards,<br>The BookEX Team</p>
                <p><em>This is an automated notification from BookEX.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending organization application notification:', error);
      return { success: false, error: error.message };
    }

    console.log('Organization application notification sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Error sending organization application notification:', error);
    return { success: false, error: String(error) };
  }
};

// Send donation chat confirmation to user
export const sendDonationChatConfirmationEmail = async (
  userEmail: string,
  userName: string,
  organizationName: string,
  chatId: string
) => {
  const { withEmailRetry } = await import('@/lib/utils');

  return withEmailRetry(async () => {
    const chatUrl = `${getBaseUrl()}/messages/${chatId}`;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [userEmail],
      subject: `💝 Donation Chat Started with ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Donation Chat Started</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
              .donation-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669; }
              .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>💝 Donation Chat Started</h1>
            </div>
            <div class="content">
              <p>Hi ${userName || 'there'}!</p>
              <p>Thank you for your generous intention to donate books! You've successfully started a conversation with <strong>${organizationName}</strong>.</p>

              <div class="donation-card">
                <h3>What happens next?</h3>
                <ul>
                  <li>📚 Discuss which books you'd like to donate</li>
                  <li>📍 Coordinate pickup or drop-off location</li>
                  <li>📅 Schedule a convenient time</li>
                  <li>💝 Make a positive impact in your community!</li>
                </ul>
              </div>

              <p>You can continue your conversation with ${organizationName} in your messages.</p>

              <a href="${chatUrl}" class="button">Continue Conversation</a>

              <div class="footer">
                <p>Thank you for making a difference!<br>The BookEX Team</p>
                <p><em>Your kindness helps spread knowledge and literacy in the community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Donation chat confirmation sent:', data?.id);
    return { success: true, messageId: data?.id };
  }, 'donation-chat-confirmation');
};

// Send organization approval notification
export const sendOrganizationApprovalEmail = async (
  organizationEmail: string,
  organizationName: string,
  contactPersonName?: string
) => {
  const { withEmailRetry } = await import('@/lib/utils');

  return withEmailRetry(async () => {
    const donatePageUrl = `${getBaseUrl()}/donate`;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [organizationEmail],
      subject: `🎉 Welcome to BookEX - ${organizationName} Approved!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Organization Approved</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
              .success-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669; }
              .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Welcome to BookEX!</h1>
            </div>
            <div class="content">
              <p>Dear ${contactPersonName || 'Organization Representative'},</p>
              <p>Congratulations! <strong>${organizationName}</strong> has been approved as a BookEX donation partner.</p>

              <div class="success-card">
                <h3>🌟 You're Now Live!</h3>
                <p>Your organization is now visible on our donations page, and community members can start donating books to you.</p>

                <h4>What to expect:</h4>
                <ul>
                  <li>📚 Book donors will initiate conversations with you</li>
                  <li>💬 You'll receive messages about book donations</li>
                  <li>📍 Coordinate pickup/drop-off with donors</li>
                  <li>🤝 Build relationships with your community</li>
                </ul>
              </div>

              <p>Check out your organization profile on our donations page:</p>

              <a href="${donatePageUrl}" class="button">View Donations Page</a>

              <div class="footer">
                <p>Thank you for joining our mission to spread literacy!<br>The BookEX Team</p>
                <p><em>Together, we're building a more literate and connected community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Organization approval email sent:', data?.id);
    return { success: true, messageId: data?.id };
  }, 'organization-approval');
};

// Send organization rejection notification
export const sendOrganizationRejectionEmail = async (
  organizationEmail: string,
  organizationName: string,
  contactPersonName?: string,
  rejectionReason?: string
) => {
  const { withEmailRetry } = await import('@/lib/utils');

  return withEmailRetry(async () => {
    const applyUrl = `${getBaseUrl()}/donate/apply`;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [organizationEmail],
      subject: `📋 BookEX Application Update - ${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Application Update</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #fef2f2; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-card { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 Application Update</h1>
            </div>
            <div class="content">
              <p>Dear ${contactPersonName || 'Organization Representative'},</p>
              <p>Thank you for your interest in joining BookEX as a donation partner. After careful review, we're unable to approve <strong>${organizationName}</strong> at this time.</p>

              ${rejectionReason ? `
              <div class="info-card">
                <h3>Feedback:</h3>
                <p>${rejectionReason}</p>
              </div>
              ` : ''}

              <div class="info-card">
                <h3>What's Next?</h3>
                <p>If you believe this decision was made in error or if you've addressed any concerns, you're welcome to submit a new application.</p>
                <p>We appreciate your commitment to literacy and community service.</p>
              </div>

              <a href="${applyUrl}" class="button">Submit New Application</a>

              <div class="footer">
                <p>Best regards,<br>The BookEX Team</p>
                <p><em>We value your dedication to spreading knowledge in the community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Organization rejection email sent:', data?.id);
    return { success: true, messageId: data?.id };
  }, 'organization-rejection');
};

/**
 * Send donation status update email
 */
export const sendDonationStatusUpdateEmail = async (
  recipientEmail: string,
  recipientName: string,
  organizationName: string,
  status: string,
  notes?: string,
  pickupDate?: string,
  chatId?: string
) => {
  try {
    const baseUrl = getBaseUrl();
    const chatUrl = chatId ? `${baseUrl}/messages/${chatId}` : `${baseUrl}/messages`;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [recipientEmail],
      subject: `Donation Status Update: ${status}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Donation Status Updated</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-card { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📚 BookEX</h1>
            </div>
            <div class="content">
              <h2>Donation Status Update</h2>
              <p>Hi ${recipientName},</p>
              <p>The donation to <strong>${organizationName}</strong> has been updated.</p>

              <div class="info-card">
                <p><strong>New Status:</strong> ${status}</p>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                ${pickupDate ? `<p><strong>Pickup Date:</strong> ${pickupDate}</p>` : ''}
              </div>

              <a href="${chatUrl}" class="button">View Details</a>

              <div class="footer">
                <p>Thank you for your contribution to literacy and education!</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending donation status update email:', error);
      return { success: false, error: error.message };
    }

    console.log('Donation status update email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending donation status update email:', error);
    return { success: false, error: message };
  }
};

/**
 * Send donation completion confirmation email
 */
export const sendDonationCompletionEmail = async (
  donorEmail: string,
  donorName: string,
  organizationName: string,
  receivedDate: string,
  condition: string,
  notes?: string,
  chatId?: string
) => {
  try {
    const baseUrl = getBaseUrl();
    const chatUrl = chatId ? `${baseUrl}/messages/${chatId}` : `${baseUrl}/messages`;

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [donorEmail],
      subject: `Thank You for Your Donation to ${organizationName}!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Donation Confirmed</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
              .info-card { background: white; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
              .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
              .highlight { font-size: 18px; color: #059669; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Donation Confirmed!</h1>
            </div>
            <div class="content">
              <h2>Thank You, ${donorName}!</h2>
              <p class="highlight">Your generous donation has been received by ${organizationName}.</p>

              <div class="info-card">
                <h3>Donation Details:</h3>
                <p><strong>Received Date:</strong> ${receivedDate}</p>
                <p><strong>Condition:</strong> ${condition}</p>
                ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              </div>

              <p>Your contribution makes a real difference in promoting literacy and education in our community. Thank you for your generosity!</p>

              <a href="${chatUrl}" class="button">View Donation Details</a>

              <div class="footer">
                <p>Your kindness helps spread knowledge and creates opportunities for others. We're grateful for community members like you!</p>
                <p>With gratitude,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending donation completion email:', error);
      return { success: false, error: error.message };
    }

    console.log('Donation completion email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending donation completion email:', error);
    return { success: false, error: message };
  }
};

/**
 * Send inactivity warning email — account will be reviewed if no login within 14 days.
 */
export const sendInactivityWarningEmail = async (
  to: string,
  name: string,
  lastLoginAt: string | null
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  const baseUrl = getBaseUrl();
  const lastLoginText = lastLoginAt
    ? `Your last login was on ${new Date(lastLoginAt).toLocaleDateString('en-US', { dateStyle: 'long' })}.`
    : 'We have not seen you log in since you created your account.';

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Action required: Your BookEX account will be reviewed for inactivity',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Inactivity Notice</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #d97706; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #fffbeb; padding: 30px; border-radius: 0 0 8px 8px; }
              .notice { background: white; border-left: 4px solid #d97706; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Account Inactivity Notice</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>We miss you at BookEX! ${lastLoginText}</p>
              <div class="notice">
                <p><strong>Your account will be flagged for review if you do not log in within the next 14 days.</strong></p>
                <p>Simply sign in to keep your account active — no other action is needed.</p>
              </div>
              <a href="${baseUrl}/auth/signin" class="button">Sign In to BookEX</a>
              <div class="footer">
                <p>If you no longer wish to use BookEX, you can ignore this email and your account will be reviewed by our team.</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending inactivity warning email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error sending inactivity warning email:', err);
    return { success: false, error: message };
  }
};

/**
 * Send donation follow-up reminder to the organization representative.
 */
export const sendDonationReminderEmail = async (
  to: string,
  recipientName: string,
  donorName: string,
  donationId: string
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  const baseUrl = getBaseUrl();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Reminder: Pending donation awaiting your response',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Donation Reminder</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 8px 8px; }
              .notice { background: white; border-left: 4px solid #059669; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Donation Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${recipientName},</p>
              <p>This is a friendly reminder that <strong>${donorName}</strong> has a pending book donation waiting for your response.</p>
              <div class="notice">
                <p>The donation has been pending for more than 3 days. Please respond to keep the donor informed and coordinate the handoff.</p>
              </div>
              <a href="${baseUrl}/messages" class="button">View Donation Details</a>
              <div class="footer">
                <p>Donation ID: ${donationId}</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending donation reminder email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error sending donation reminder email:', err);
    return { success: false, error: message };
  }
};

export interface DigestBook {
  title: string;
  author: string;
  condition: string;
  id: string;
}

// Send email change verification email
export const sendEmailChangeVerificationEmail = async (
  to: string,
  name: string,
  verificationUrl: string
): Promise<{ success: boolean; error?: string; messageId?: string }> => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Confirm your new BookEX email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Email Change</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BookEX</h1>
            </div>
            <div class="content">
              <h2>Confirm your new email address</h2>
              <p>Hello ${name},</p>
              <p>We received a request to change your BookEX account email to this address. Click the button below to confirm.</p>
              <a href="${verificationUrl}" class="button">Confirm Email Change</a>
              <p>Or copy and paste this link into your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p><strong>This link expires in 24 hours.</strong></p>
              <div class="footer">
                <p>If you did not request this change, you can safely ignore this email. Your current email address will remain unchanged.</p>
                <p>Best regards,<br>The BookEX Team</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Error sending email change verification email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email change verification email sent:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error sending email change verification email:', err);
    return { success: false, error: message };
  }
};

export const sendWeeklyDigestEmail = async (
  to: string,
  name: string,
  books: DigestBook[]
): Promise<{ success: true; messageId?: string } | { success: false; error: string }> => {
  const baseUrl = getBaseUrl();

  const bookRows = books
    .slice(0, 5)
    .map(
      (b) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">
            <a href="${baseUrl}/books/${b.id}" style="color:#2563eb;text-decoration:none;font-weight:500;">${b.title}</a>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${b.author}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">${b.condition}</td>
        </tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Weekly BookEX Digest</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; background: white; border-radius: 6px; overflow: hidden; }
          th { background: #eff6ff; text-align: left; padding: 10px 8px; font-size: 13px; color: #1e40af; }
          .footer { margin-top: 24px; font-size: 13px; color: #6b7280; }
          .cta { display: inline-block; background: #2563eb; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header"><h1>BookEX Weekly Digest</h1></div>
        <div class="content">
          <p>Hello ${name},</p>
          <p>Here are the new books listed in your area this week:</p>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              ${bookRows}
            </tbody>
          </table>
          <a href="${baseUrl}/books" class="cta">Browse All Books</a>
          <div class="footer">
            <p>You're receiving this because you have weekly digest enabled in your BookEX preferences.</p>
            <p>To unsubscribe, update your <a href="${baseUrl}/profile/settings">email preferences</a>.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: 'Your Weekly BookEX Digest',
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
};
