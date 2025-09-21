import nodemailer from 'nodemailer';

// Email configuration validation types
export interface EmailConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    host: string;
    port: number;
    secure: boolean;
    hasAuth: boolean;
    fromAddress: string;
  };
}

export interface EmailTestResult {
  success: boolean;
  message: string;
  details?: any;
}

// Email configuration
const getEmailConfig = () => ({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true' || false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
});

const transporter = nodemailer.createTransport(getEmailConfig());

/**
 * Comprehensive email configuration validation
 */
export const validateEmailConfiguration = (): EmailConfigValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const config = getEmailConfig();

  // Required environment variables
  if (!config.host) {
    errors.push('EMAIL_HOST is required');
  }

  if (!config.auth.user) {
    errors.push('EMAIL_USER is required');
  }

  if (!config.auth.pass) {
    errors.push('EMAIL_PASSWORD is required');
  }

  if (!config.from) {
    errors.push('EMAIL_FROM is required (or EMAIL_USER will be used as fallback)');
  }

  // Port validation
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('EMAIL_PORT must be a valid port number (1-65535)');
  }

  // Security validation
  if (config.secure && config.port !== 465) {
    warnings.push('EMAIL_SECURE=true is typically used with port 465');
  }

  if (!config.secure && config.port === 465) {
    warnings.push('Port 465 is typically used with EMAIL_SECURE=true');
  }

  // Common SMTP provider validations
  if (config.host.includes('gmail.com') && config.auth.user) {
    if (config.port !== 587 && config.port !== 465) {
      warnings.push('Gmail typically uses ports 587 (TLS) or 465 (SSL)');
    }
    if (!config.auth.user.includes('@gmail.com')) {
      warnings.push('Gmail SMTP usually requires a Gmail address as EMAIL_USER');
    }
  }

  if (config.host.includes('outlook.com') || config.host.includes('office365.com')) {
    if (config.port !== 587) {
      warnings.push('Outlook/Office365 typically uses port 587');
    }
  }

  // Password security check
  if (config.auth.pass && config.auth.pass.length < 8) {
    warnings.push('EMAIL_PASSWORD seems short - ensure it\'s the correct app password');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      hasAuth: !!(config.auth.user && config.auth.pass),
      fromAddress: config.from || 'Not configured',
    }
  };
};

/**
 * Test email configuration by attempting to connect to SMTP server
 */
export const testEmailConnection = async (): Promise<EmailTestResult> => {
  try {
    // First validate configuration
    const validation = validateEmailConfiguration();
    if (!validation.isValid) {
      return {
        success: false,
        message: `Configuration validation failed: ${validation.errors.join(', ')}`,
        details: validation
      };
    }

    // Test the connection
    await transporter.verify();

    return {
      success: true,
      message: 'Email server connection successful',
      details: {
        host: validation.config.host,
        port: validation.config.port,
        secure: validation.config.secure
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Email server connection failed: ${error.message}`,
      details: {
        error: error.message,
        code: error.code,
        command: error.command
      }
    };
  }
};

/**
 * Send a test email to verify configuration
 */
export const sendTestEmail = async (to: string): Promise<EmailTestResult> => {
  try {
    const config = getEmailConfig();

    const mailOptions = {
      from: `"BookEx Test" <${config.from}>`,
      to,
      subject: 'BookEx Email Configuration Test',
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
            <p>Your BookEx email configuration is working correctly.</p>
            <div class="info">
              <strong>Test Details:</strong><br>
              • From: ${config.from}<br>
              • To: ${to}<br>
              • Host: ${config.host}:${config.port}<br>
              • Secure: ${config.secure ? 'Yes' : 'No'}<br>
              • Timestamp: ${new Date().toISOString()}
            </div>
            <p><em>This is an automated test email from BookEx.</em></p>
          </body>
        </html>
      `,
      text: `
        ✅ Email Configuration Test Successful!

        Your BookEx email configuration is working correctly.

        Test Details:
        • From: ${config.from}
        • To: ${to}
        • Host: ${config.host}:${config.port}
        • Secure: ${config.secure ? 'Yes' : 'No'}
        • Timestamp: ${new Date().toISOString()}

        This is an automated test email from BookEx.
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Test email sent successfully',
      details: {
        messageId: info.messageId,
        envelope: info.envelope,
        accepted: info.accepted,
        rejected: info.rejected
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to send test email: ${error.message}`,
      details: {
        error: error.message,
        code: error.code
      }
    };
  }
};

/**
 * Initialize email system with validation
 */
export const initializeEmailSystem = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  console.log('🔧 Initializing email system...');

  // Validate configuration
  const validation = validateEmailConfiguration();

  if (!validation.isValid) {
    const errorMsg = `❌ Email configuration invalid: ${validation.errors.join(', ')}`;
    console.error(errorMsg);
    return {
      success: false,
      message: errorMsg,
      details: validation
    };
  }

  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Email configuration warnings:', validation.warnings.join(', '));
  }

  // Test connection
  const connectionTest = await testEmailConnection();

  if (!connectionTest.success) {
    console.error('❌ Email connection test failed:', connectionTest.message);
    return {
      success: false,
      message: `Email connection test failed: ${connectionTest.message}`,
      details: connectionTest.details
    };
  }

  console.log('✅ Email system initialized successfully');
  console.log(`📧 Email server: ${validation.config.host}:${validation.config.port}`);
  console.log(`🔐 Secure connection: ${validation.config.secure ? 'Yes' : 'No'}`);
  console.log(`👤 From address: ${validation.config.fromAddress}`);

  return {
    success: true,
    message: 'Email system initialized successfully',
    details: {
      validation,
      connectionTest
    }
  };
};

// Legacy function for backward compatibility
export const verifyEmailConfig = async () => {
  const result = await testEmailConnection();
  return result.success;
};

// Send password reset email
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  resetToken: string
) => {
  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset Your BookEx Password',
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
            <h1>BookEx</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hello ${name},</p>
            <p>We received a request to reset your password for your BookEx account. If you didn't make this request, you can safely ignore this email.</p>
            <p>To reset your password, click the button below:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
            <div class="footer">
              <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
              <p>Best regards,<br>The BookEx Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hello ${name},
      
      We received a request to reset your password for your BookEx account.
      
      To reset your password, visit this link:
      ${resetUrl}
      
      This link will expire in 1 hour for security reasons.
      
      If you didn't request this password reset, you can safely ignore this email.
      
      Best regards,
      The BookEx Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: String(error) };
  }
};

// Send welcome email for new users
export const sendWelcomeEmail = async (to: string, name: string) => {
  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: 'Welcome to BookEx!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to BookEx</title>
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
            <h1>Welcome to BookEx!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Welcome to BookEx, your new favorite platform for buying, selling, and exchanging books with fellow readers in your community.</p>
            
            <div class="feature">
              <h3>📚 Buy & Sell Books</h3>
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
            
            <a href="${process.env.NEXTAUTH_URL || 'http://localhost:9002'}" class="button">Start Exploring</a>
            
            <p>Happy reading!</p>
            <p>The BookEx Team</p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
  exchangeId: string
) => {
  const exchangeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/exchange/history`;
  
  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
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
            <p>The BookEx Team</p>
          </div>
          
          <div class="footer">
            <p>You received this email because you have a book listed for exchange on BookEx.</p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Exchange proposal email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
  exchangeId: string
) => {
  const exchangeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/exchange/history`;
  
  const statusMessages = {
    accepted: {
      subject: '✅ Your Book Exchange was Accepted!',
      title: 'Exchange Accepted!',
      message: `Great news! ${otherUserName} has accepted your book exchange proposal for "${bookTitle}".`,
      action: 'You can now coordinate the book swap through your messages.'
    },
    in_progress: {
      subject: '📦 Your Book Exchange is Now in Progress',
      title: 'Exchange in Progress',
      message: `Your book exchange with ${otherUserName} for "${bookTitle}" is now in progress.`,
      action: 'Don\'t forget to coordinate the meetup and confirm completion when done.'
    },
    completed: {
      subject: '🎉 Book Exchange Completed Successfully!',
      title: 'Exchange Completed!',
      message: `Congratulations! Your book exchange with ${otherUserName} for "${bookTitle}" has been completed.`,
      action: 'We hope you enjoy your new book! Consider leaving a review.'
    },
    cancelled: {
      subject: '❌ Book Exchange Cancelled',
      title: 'Exchange Cancelled',
      message: `Your book exchange with ${otherUserName} for "${bookTitle}" has been cancelled.`,
      action: 'You can browse other available books for exchange.'
    }
  };

  const statusInfo = statusMessages[newStatus as keyof typeof statusMessages];
  if (!statusInfo) return { success: false, error: 'Unknown status' };

  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
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
            <p>The BookEx Team</p>
          </div>
          
          <div class="footer">
            <p>You received this email because you have an active book exchange on BookEx.</p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Exchange status update email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
  const chatUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/messages/${chatId}`;
  const actionType = bookType === 'exchange' ? 'exchange' : 'purchase';
  
  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
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
            <p>The BookEx Team</p>
          </div>
          
          <div class="footer">
            <p>You received this email because someone contacted you about your book listing on BookEx.</p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Book contact email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
  const reviewUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/admin`;
  
  const mailOptions = {
    from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: adminEmail,
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
            <p>A new organization has applied to join the BookEx donation program.</p>
            
            <div class="org-card">
              <h3>${organizationName}</h3>
              <p><strong>Description:</strong> ${organizationDescription}</p>
              <p><strong>Submitted by:</strong> ${submittedBy}</p>
              <p><strong>Application ID:</strong> ${organizationId}</p>
            </div>
            
            <p>Please review this application and approve or reject it.</p>
            
            <a href="${reviewUrl}" class="button">Review Application</a>
            
            <div class="footer">
              <p>Best regards,<br>The BookEx Team</p>
              <p><em>This is an automated notification from BookEx.</em></p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Organization application notification sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
    const chatUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/messages/${chatId}`;
    
    const mailOptions = {
      from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: userEmail,
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
                <p>Thank you for making a difference!<br>The BookEx Team</p>
                <p><em>Your kindness helps spread knowledge and literacy in the community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Donation chat confirmation sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  }, 'donation-chat-confirmation');
};// Send organization approval notification
export const sendOrganizationApprovalEmail = async (
  organizationEmail: string,
  organizationName: string,
  contactPersonName?: string
) => {
  const { withEmailRetry } = await import('@/lib/utils');
  
  return withEmailRetry(async () => {
    const donatePageUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/donate`;
    
    const mailOptions = {
      from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: organizationEmail,
      subject: `🎉 Welcome to BookEx - ${organizationName} Approved!`,
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
              <h1>🎉 Welcome to BookEx!</h1>
            </div>
            <div class="content">
              <p>Dear ${contactPersonName || 'Organization Representative'},</p>
              <p>Congratulations! <strong>${organizationName}</strong> has been approved as a BookEx donation partner.</p>
              
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
                <p>Thank you for joining our mission to spread literacy!<br>The BookEx Team</p>
                <p><em>Together, we're building a more literate and connected community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Organization approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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
    const applyUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:9002'}/donate/apply`;
    
    const mailOptions = {
      from: `"BookEx" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: organizationEmail,
      subject: `📋 BookEx Application Update - ${organizationName}`,
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
              <p>Thank you for your interest in joining BookEx as a donation partner. After careful review, we're unable to approve <strong>${organizationName}</strong> at this time.</p>
              
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
                <p>Best regards,<br>The BookEx Team</p>
                <p><em>We value your dedication to spreading knowledge in the community.</em></p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Organization rejection email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  }, 'organization-rejection');
};
