import { Profile, Session } from 'next-auth/adapters';
import { User } from 'next-auth';
import { SanityClient } from '@sanity/client';
declare type Options = {
    client: SanityClient;
};
export declare const SanityAdapter: ({ client }: Options) => {
    getAdapter: ({ secret, ...appOptions }: {
        [x: string]: any;
        secret?: string | undefined;
    }) => Promise<{
        createUser: (profile: Profile) => Promise<User>;
        getUser: (id: string) => Promise<User>;
        linkAccount: (userId: string, providerId: string, providerType: string, providerAccountId: string, refreshToken: string, accessToken: string, accessTokenExpires: number) => Promise<void>;
        getUserByProviderAccountId: (providerId: string, providerAccountId: string) => Promise<any>;
        getUserByEmail: (email: string) => Promise<any>;
        createSession: () => Promise<Session>;
        getSession: () => Promise<Session>;
        updateSession: () => Promise<Session>;
        deleteSession: () => Promise<void>;
        updateUser: (user: User & {
            id: string;
        }) => Promise<User>;
        createVerificationRequest: (identifier: string, url: string, token: string, _: any, provider: any) => Promise<void>;
        getVerificationRequest: (identifier?: string, token?: string) => Promise<any>;
        deleteVerificationRequest: (identifier?: string, token?: string) => Promise<void>;
    }>;
};
export {};
