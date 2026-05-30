/**
 * Application startup initialization
 * Validates critical configurations and services
 */

import { initializeEmailSystem } from './email';
import { initializeActivityLogsCollection } from './activity-logging';
import { initializeCitiesCollection } from './cities-database';

export interface StartupCheckResult {
  service: string;
  success: boolean;
  message: string;
  details?: any;
  critical: boolean;
}

export interface StartupValidationResult {
  success: boolean;
  results: StartupCheckResult[];
  criticalFailures: string[];
  warnings: string[];
}

/**
 * Validate all critical application configurations
 */
export const validateApplicationStartup = async (): Promise<StartupValidationResult> => {
  console.log('🚀 Starting BookEx application validation...');

  const results: StartupCheckResult[] = [];
  const criticalFailures: string[] = [];
  const warnings: string[] = [];

  // 1. Email Configuration Validation
  try {
    console.log('📧 Validating email configuration...');
    const emailResult = await initializeEmailSystem();

    results.push({
      service: 'Email System',
      success: emailResult.success,
      message: emailResult.message,
      details: emailResult.details,
      critical: true
    });

    if (!emailResult.success) {
      criticalFailures.push('Email configuration failed - password reset and notifications will not work');
    }

    // Check for warnings
    const emailDetails = emailResult.details as { validation?: { warnings?: string[] } } | undefined;
    if (emailDetails?.validation?.warnings?.length) {
      warnings.push(...emailDetails.validation.warnings.map((w: string) => `Email: ${w}`));
    }

  } catch (error: any) {
    results.push({
      service: 'Email System',
      success: false,
      message: `Email validation error: ${error.message}`,
      critical: true
    });
    criticalFailures.push('Email system initialization failed');
  }

  // 2. Database Collections Initialization
  try {
    console.log('🗄️ Initializing database collections...');

    // Initialize activity logs collection
    await initializeActivityLogsCollection();
    results.push({
      service: 'Activity Logs Collection',
      success: true,
      message: 'Activity logs collection initialized successfully',
      critical: false
    });

    // Initialize cities collection
    await initializeCitiesCollection();
    results.push({
      service: 'Cities Collection',
      success: true,
      message: 'Cities collection initialized successfully',
      critical: false
    });

  } catch (error: any) {
    results.push({
      service: 'Database Collections',
      success: false,
      message: `Database initialization error: ${error.message}`,
      critical: true
    });
    criticalFailures.push('Database collections initialization failed');
  }

  // 3. Environment Variables Validation
  try {
    console.log('🔧 Validating environment variables...');

    const requiredEnvVars = [
      'MONGODB_URI',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      results.push({
        service: 'Environment Variables',
        success: false,
        message: `Missing required environment variables: ${missingVars.join(', ')}`,
        critical: true
      });
      criticalFailures.push(`Missing environment variables: ${missingVars.join(', ')}`);
    } else {
      results.push({
        service: 'Environment Variables',
        success: true,
        message: 'All required environment variables are present',
        critical: true
      });
    }

    // Check for recommended variables
    const recommendedVars = [
      'REDIS_URL',
      'EMAIL_HOST',
      'EMAIL_USER',
      'EMAIL_PASSWORD'
    ];

    const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
    if (missingRecommended.length > 0) {
      warnings.push(`Recommended environment variables not set: ${missingRecommended.join(', ')}`);
    }

  } catch (error: any) {
    results.push({
      service: 'Environment Variables',
      success: false,
      message: `Environment validation error: ${error.message}`,
      critical: true
    });
  }

  // 4. Redis Connection Check (if configured)
  if (process.env.REDIS_URL) {
    try {
      console.log('🔄 Testing Redis connection...');

      // Dynamic import to avoid issues if Redis is not available
      const { createClient } = await import('redis');

      const redisClient = createClient({
        url: process.env.REDIS_URL
      });

      await redisClient.connect();
      await redisClient.ping();
      await redisClient.disconnect();

      results.push({
        service: 'Redis Connection',
        success: true,
        message: 'Redis connection successful',
        critical: false
      });

    } catch (error: any) {
      results.push({
        service: 'Redis Connection',
        success: false,
        message: `Redis connection failed: ${error.message}`,
        critical: false
      });
      warnings.push('Redis connection failed - caching will be disabled');
    }
  } else {
    warnings.push('REDIS_URL not configured - Redis features will be disabled');
  }

  // Summary
  const success = criticalFailures.length === 0;
  const totalServices = results.length;
  const successfulServices = results.filter(r => r.success).length;

  console.log(`✅ Startup validation complete: ${successfulServices}/${totalServices} services successful`);

  if (criticalFailures.length > 0) {
    console.error('❌ Critical failures detected:');
    criticalFailures.forEach(failure => console.error(`  - ${failure}`));
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return {
    success,
    results,
    criticalFailures,
    warnings
  };
};

/**
 * Get startup status summary
 */
export const getStartupStatus = (validationResult: StartupValidationResult): string => {
  const { success, results, criticalFailures, warnings } = validationResult;

  let status = `BookEx Startup Status: ${success ? '✅ READY' : '❌ ISSUES DETECTED'}\n\n`;

  status += 'Service Status:\n';
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const critical = result.critical ? ' (CRITICAL)' : '';
    status += `${icon} ${result.service}${critical}: ${result.message}\n`;
  });

  if (criticalFailures.length > 0) {
    status += '\n🚨 Critical Issues:\n';
    criticalFailures.forEach(failure => {
      status += `  • ${failure}\n`;
    });
  }

  if (warnings.length > 0) {
    status += '\n⚠️ Warnings:\n';
    warnings.forEach(warning => {
      status += `  • ${warning}\n`;
    });
  }

  return status;
};

/**
 * Quick health check for monitoring
 */
export const performHealthCheck = async (): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  timestamp: string;
}> => {
  const services: Record<string, boolean> = {};

  // Email health check
  try {
    const { testEmailConnection } = await import('./email');
    const emailTest = await testEmailConnection();
    services.email = emailTest.success;
  } catch {
    services.email = false;
  }

  // Database health check
  try {
    const { connectToMongoDB } = await import('./mongodb');
    const { db } = await connectToMongoDB();
    await db.admin().ping();
    services.database = true;
  } catch {
    services.database = false;
  }

  // Redis health check
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis');
      const redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      await redisClient.ping();
      await redisClient.disconnect();
      services.redis = true;
    } catch {
      services.redis = false;
    }
  } else {
    services.redis = false; // Not configured
  }

  const healthy = services.email && services.database;

  return {
    healthy,
    services,
    timestamp: new Date().toISOString()
  };
};
