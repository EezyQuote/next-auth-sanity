import { Profile, Session } from 'next-auth/adapters';
import { User } from 'next-auth';
import {
  getUserByIdQuery,
  getUserByProviderAccountIdQuery,
  getUserByEmailQuery,
  getVerificationRequestQuery,
  getAllIdentifierVerificationRequestQuery,
  getSessionBySessionToken,
} from './queries';
import LRU from 'lru-cache';
import { SanityClient } from '@sanity/client';
import { uuid } from '@sanity/uuid';
import { createHash, randomBytes } from 'crypto';

type Options = {
  client: SanityClient;
};

const userCache = new LRU<string, User & { id: string }>({
  maxAge: 24 * 60 * 60 * 1000,
  max: 1000,
});

export const SanityAdapter = ({ client }: Options) => {
  const getAdapter = async ({
    session,
    secret = 'this-is-a-secret-value-with-at-least-32-characters',
    ...appOptions
  }) => {
    const sessionMaxAge = session.maxAge * 1000; // default is 30 days
    const sessionUpdateAge = session.updateAge * 1000; // default is 1 day

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
        ...user,
        id: user._id,
      });

      return {
        ...user,
        id: user._id,
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
            ...user,
            id: user._id,
          });
        })();

        return cachedUser;
      }

      const user = await client.fetch(getUserByIdQuery, {
        id,
      });

      return {
        ...user,
        id: user._id,
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

    function createSession(user): Promise<Session> {
      return client
        .create({
          _type: 'session',
          userId: user.id,
          expires: new Date(Date.now() + sessionMaxAge),
          sessionToken: randomBytes(32).toString('hex'),
          accessToken: randomBytes(32).toString('hex'),
        })
        .then((res) => ({ ...res, id: res._id }));
    }

    async function getSession(sessionToken): Promise<Session | null> {
      const session = await client
        .fetch(getSessionBySessionToken, {
          sessionToken,
        })
        .then((res) => ({ ...res, id: res?._id }));
      if (session && session.expires < new Date()) {
        await client.delete(session.id);
        return null;
      }
      return session;
    }

    async function updateSession(session, force): Promise<Session | null> {
      if (
        !force &&
        Number(session.expires) - sessionMaxAge + sessionUpdateAge > Date.now()
      ) {
        return null;
      }

      return client
        .patch(session.id)
        .set({ expires: new Date(Date.now() + sessionMaxAge) })
        .commit()
        .then((res) => {
          return {
            ...res,
            id: res?._id,
          } as any;
        });
    }

    async function deleteSession(sessionToken) {
      await client
        .fetch(getSessionBySessionToken, { sessionToken })
        .then(async (res) => {
          await client.delete(res?._id);
        });
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
            ...res,
            id: res._id,
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

    async function deleteVerificationRequest(identifier = '', _token = '') {
      //? IF you do not want to invalidate previous requests, then you would use this commented code:
      // const hashedToken = hashToken(token);

      // const verificationRequest = await client.fetch(
      //   getVerificationRequestQuery,
      //   {
      //     identifier,
      //     token: hashedToken,
      //   }
      // );

      // if (verificationRequest._id) {
      //   await client.delete(verificationRequest._id);
      // }

      // We want to invalidate all verification requests if successfully logged in:
      await deleteAllVerificationRequests(identifier);
    }

    async function deleteAllVerificationRequests(identifier = '') {
      const config = client.config();
      if (config) {
        // INVALIDATES PREVIOUS REQUESTS
        await fetch(
          `https://${config.projectId}.api.sanity.io/v2021-03-25/data/mutate/${config.dataset}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + config.token,
            },
            method: 'post',
            body: JSON.stringify({
              mutations: [
                {
                  delete: {
                    query: `*[_type == 'verification-request' && identifier == "${identifier}"]`,
                  },
                },
              ],
            }),
          }
        );
      } else {
        throw new Error('Sanity config is not set');
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
