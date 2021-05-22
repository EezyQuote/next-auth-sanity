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
    const getAdapter = async ({ secret = 'this-is-a-secret-value-with-at-least-32-characters', ...appOptions }) => {
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
                id: user._id,
                ...user,
            });
            return {
                id: user._id,
                ...user,
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
                        id: user._id,
                        ...user,
                    });
                })();
                return cachedUser;
            }
            const user = await client.fetch(queries_1.getUserByIdQuery, {
                id,
            });
            return {
                id: user._id,
                ...user,
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
            const account = await client.fetch(queries_1.getUserByProviderAccountIdQuery, {
                providerId,
                providerAccountId: String(providerAccountId),
            });
            return account === null || account === void 0 ? void 0 : account.user;
        }
        async function getUserByEmail(email) {
            const user = await client.fetch(queries_1.getUserByEmailQuery, {
                email,
            });
            return user;
        }
        async function createSession() {
            console.log('[createSession] method not implemented');
            return {};
        }
        async function getSession() {
            console.log('[getSession] method not implemented');
            return {};
        }
        async function updateSession() {
            console.log('[updateSession] method not implemented');
            return {};
        }
        async function deleteSession() {
            console.log('[deleteSession] method not implemented');
        }
        async function updateUser(user) {
            const { id, name, email, image } = user;
            userCache.set(id, user);
            const newUser = await client
                .patch(id)
                .set({
                name,
                email,
                image,
            })
                .commit();
            return {
                id: newUser._id,
                ...newUser,
            };
        }
        async function createVerificationRequest(identifier, url, token, _, provider) {
            await client.create({
                _type: 'session-verification',
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
        async function getVerificationRequest(identifier, token) {
            const hashedToken = hashToken(token);
            const verificationRequest = await client.fetch(queries_1.getUserByEmailQuery, {
                identifier,
                token: hashedToken,
            });
            if (verificationRequest && verificationRequest.expires < new Date()) {
                await client.delete(verificationRequest._id);
                return null;
            }
            return verificationRequest;
        }
        async function deleteVerificationRequest(identifier, token) {
            const hashedToken = hashToken(token);
            const verificationRequest = await client.fetch(queries_1.getUserByEmailQuery, {
                identifier,
                token: hashedToken,
            });
            await client.delete(verificationRequest._id);
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
