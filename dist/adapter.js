"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityAdapter = void 0;
const queries_1 = require("./queries");
const lru_cache_1 = __importDefault(require("lru-cache"));
const uuid_1 = require("@sanity/uuid");
const crypto_1 = require("crypto");
const userCache = new lru_cache_1.default({
    maxAge: 24 * 60 * 60 * 1000,
    max: 1000,
});
const SanityAdapter = ({ client }) => {
    const getAdapter = async ({ session, secret = 'this-is-a-secret-value-with-at-least-32-characters', ...appOptions }) => {
        const sessionMaxAge = session.maxAge * 1000; // default is 30 days
        const sessionUpdateAge = session.updateAge * 1000; // default is 1 day
        const hashToken = (token) => {
            return crypto_1.createHash('sha256').update(`${token}${secret}`).digest('hex');
        };
        async function createUser(profile) {
            const user = await client.create({
                _id: `user.${uuid_1.uuid()}`,
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
        async function getUser(id) {
            const cachedUser = userCache.get(id);
            if (cachedUser) {
                (async () => {
                    const user = await client.fetch(queries_1.getUserByIdQuery, {
                        id,
                    });
                    userCache.set(user._id, {
                        ...user,
                        id: user._id,
                    });
                })();
                return cachedUser;
            }
            const user = await client.fetch(queries_1.getUserByIdQuery, {
                id,
            });
            return {
                ...user,
                id: user._id,
            };
        }
        async function linkAccount(userId, providerId, providerType, providerAccountId, refreshToken, accessToken, accessTokenExpires) {
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
        async function getUserByProviderAccountId(providerId, providerAccountId) {
            const account = await client
                .fetch(queries_1.getUserByProviderAccountIdQuery, {
                providerId,
                providerAccountId: String(providerAccountId),
            })
                .then((res) => {
                var _a;
                if (!res)
                    return res;
                return {
                    ...res,
                    user: {
                        ...res.user,
                        id: (_a = res === null || res === void 0 ? void 0 : res.user) === null || _a === void 0 ? void 0 : _a._id,
                    },
                };
            });
            return account === null || account === void 0 ? void 0 : account.user;
        }
        async function getUserByEmail(email) {
            const user = await client
                .fetch(queries_1.getUserByEmailQuery, {
                email,
            })
                .then((res) => {
                if (!res)
                    return res;
                return {
                    ...res,
                    id: res._id,
                };
            });
            return user;
        }
        function createSession(user) {
            return client
                .create({
                _type: 'session',
                userId: user.id,
                expires: new Date(Date.now() + sessionMaxAge),
                sessionToken: crypto_1.randomBytes(32).toString('hex'),
                accessToken: crypto_1.randomBytes(32).toString('hex'),
            })
                .then((res) => ({ ...res, id: res._id }));
        }
        async function getSession(sessionToken) {
            const session = await client
                .fetch(queries_1.getSessionBySessionToken, {
                sessionToken,
            })
                .then((res) => ({ ...res, id: res === null || res === void 0 ? void 0 : res._id }));
            if (session && session.expires < new Date()) {
                await client.delete(session.id);
                return null;
            }
            return session;
        }
        async function updateSession(session, force) {
            if (!force &&
                Number(session.expires) - sessionMaxAge + sessionUpdateAge > Date.now()) {
                return null;
            }
            return client
                .patch(session.id)
                .set({ expires: new Date(Date.now() + sessionMaxAge) })
                .commit()
                .then((res) => {
                return {
                    ...res,
                    id: res === null || res === void 0 ? void 0 : res._id,
                };
            });
        }
        async function deleteSession(sessionToken) {
            await client
                .fetch(queries_1.getSessionBySessionToken, { sessionToken })
                .then(async (res) => {
                await client.delete(res === null || res === void 0 ? void 0 : res._id);
            });
        }
        async function updateUser(user) {
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
        async function createVerificationRequest(identifier, url, token, _, provider) {
            if (client.clientConfig) {
                // INVALIDATES PREVIOUS REQUESTS
                await fetch(`https://${client.clientConfig.projectId}.api.sanity.io/v2021-03-25/data/mutate/${client.clientConfig.dataset}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + client.clientConfig.token,
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
                });
            }
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
            const verificationRequest = await client.fetch(queries_1.getVerificationRequestQuery, {
                identifier,
                token: hashedToken,
            });
            if (verificationRequest && verificationRequest.expires < new Date()) {
                await client.delete(verificationRequest._id);
                return null;
            }
            return verificationRequest;
        }
        async function deleteVerificationRequest(identifier = '', token = '') {
            const hashedToken = hashToken(token);
            const verificationRequest = await client.fetch(queries_1.getVerificationRequestQuery, {
                identifier,
                token: hashedToken,
            });
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
exports.SanityAdapter = SanityAdapter;
