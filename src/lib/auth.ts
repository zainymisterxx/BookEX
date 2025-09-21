import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

export const getSession = async () => {
    return await getServerSession(authOptions);
};
