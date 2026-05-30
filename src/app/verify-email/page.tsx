import Link from 'next/link';
import { verifyEmail } from '@/app/actions';

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Link</h1>
          <p className="text-gray-600 mb-6">This verification link is invalid. Please check your email for the correct link.</p>
          <Link href="/" className="text-blue-600 hover:underline">Go to homepage</Link>
        </div>
      </div>
    );
  }

  const result = await verifyEmail(token);

  if (result.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Email Verified!</h1>
          <p className="text-gray-600 mb-6">{result.message}</p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const isExpired =
    result.message.includes('expired') || result.message.includes('already been used');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        <div className="text-red-500 text-5xl mb-4">&#x2717;</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {isExpired ? 'Link Expired' : 'Verification Failed'}
        </h1>
        <p className="text-gray-600 mb-6">{result.message}</p>
        {isExpired && (
          <Link
            href="/resend-verification"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Resend Verification Email
          </Link>
        )}
        <div className="mt-4">
          <Link href="/" className="text-blue-600 hover:underline text-sm">
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
