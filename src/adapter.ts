import { Profile, Session } from 'next-auth/adapters';
import { User } from 'next-auth';
import {
  getUserByIdQuery,
  getUserByProviderAccountIdQuery,
  getUserByEmailQuery,
  getVerificationRequestQuery,
} from './queries';
import LRU from 'lru-cache';
import { SanityClient } from '@sanity/client';
import { uuid } from '@sanity/uuid';
import { createHash } from 'crypto';

type Options = {
  client: SanityClient;
};

const userCache = new LRU<string, User & { id: string }>({
  maxAge: 24 * 60 * 60 * 1000,
  max: 1000,
});

export const SanityAdapter = ({ client }: Options) => {
  const getAdapter = async ({
    secret = 'this-is-a-secret-value-with-at-least-32-characters',
    ...appOptions
  }) => {
    const hashToken = (token: string) => {
      return createHash('sha256').update(`${token}${secret}`).digest('hex');
    };

    async function createUser(profile: Profile): Promise<User> {
      const user = await client.create({
        _id: `user.${uuid()}`,
        _type: 'user',
        email: profile.email,
        name: profile.name,
        image: profile.image,
      });

      userCache.set(user._id, {
        id: user._id,
        ...user,
      });

      return {
        id: user._id,
        ...user,
      };
    }

    async function getUser(id: string): Promise<User> {
      const cachedUser = userCache.get(id);

      if (cachedUser) {
        (async () => {
          const user = await client.fetch(getUserByIdQuery, {
            id,
          });

          userCache.set(user._id, {
            id: user._id,
            ...user,
          });
        })();

        return cachedUser;
      }

      const user = await client.fetch(getUserByIdQuery, {
        id,
      });

      return {
        id: user._id,
        ...user,
      };
    }

    async function linkAccount(
      userId: string,
      providerId: string,
      providerType: string,
      providerAccountId: string,
      refreshToken: string,
      accessToken: string,
      accessTokenExpires: number
    ): Promise<void> {
      await client.create({
        _type: 'account',
        providerId,
        providerType,
        providerAccountId: `${providerAccountId}`,
        refreshToken,
        accessToken,
        accessTokenExpires,
        user: {
          _type: 'reference',
          _ref: userId,
        },
      });
    }

    async function getUserByProviderAccountId(
      providerId: string,
      providerAccountId: string
    ) {
      const account = await client
        .fetch(getUserByProviderAccountIdQuery, {
          providerId,
          providerAccountId: String(providerAccountId),
        })
        .then((res) => {
          if (!res) return res;
          return {
            ...res,
            user: {
              ...res.user,
              id: res?.user?._id,
            },
          };
        });

      return account?.user;
    }

    async function getUserByEmail(email: string) {
      const user = await client
        .fetch(getUserByEmailQuery, {
          email,
        })
        .then((res) => {
          if (!res) return res;
          return {
            ...res,
            id: res._id,
          };
        });

      return user;
    }

    async function createSession(): Promise<Session> {
      console.log('[createSession] method not implemented');

      return {} as any;
    }
    async function getSession(): Promise<Session> {
      console.log('[getSession] method not implemented');
      return {} as any;
    }
    async function updateSession(): Promise<Session> {
      console.log('[updateSession] method not implemented');
      return {} as any;
    }
    async function deleteSession() {
      console.log('[deleteSession] method not implemented');
    }

    async function updateUser(user: User & { id: string }): Promise<User> {
      const { id, name, email, image } = user;

      userCache.set(id, user);

      return await client
        .patch(id)
        .set({
          name,
          email,
          image,
        })
        .commit()
        .then((res) => {
          return {
            id: res._id,
            ...res,
          };
        });
    }

    async function createVerificationRequest(
      identifier: string,
      url: string,
      token: string,
      _: any,
      provider: any
    ) {
      await client.create({
        _type: 'verification-request',
        identifier,
        token: hashToken(token),
        expires: new Date(Date.now() + provider.maxAge * 1000),
      });

      await provider.sendVerificationRequest({
        identifier,
        url,
        token,
        baseUrl: appOptions.baseUrl,
        provider,
      });
    }

    async function getVerificationRequest(identifier = '', token = '') {
      const hashedToken = hashToken(token);

      const verificationRequest = await client.fetch(
        getVerificationRequestQuery,
        {
          identifier,
          token: hashedToken,
        }
      );

      if (verificationRequest && verificationRequest.expires < new Date()) {
        await client.delete(verificationRequest._id);
        return null;
      }

      return verificationRequest;
    }

    async function deleteVerificationRequest(identifier = '', token = '') {
      const hashedToken = hashToken(token);

      const verificationRequest = await client.fetch(
        getVerificationRequestQuery,
        {
          identifier,
          token: hashedToken,
        }
      );

      if (verificationRequest._id) {
        await client.delete(verificationRequest._id);
      }
    }

    return {
      createUser,
      getUser,
      linkAccount,
      getUserByProviderAccountId,
      getUserByEmail,
      createSession,
      getSession,
      updateSession,
      deleteSession,
      updateUser,
      createVerificationRequest,
      getVerificationRequest,
      deleteVerificationRequest,
    };
  };

  return {
    getAdapter,
  };
};
