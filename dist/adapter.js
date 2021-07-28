"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityAdapter = void 0;
const queries_1 = require("./queries");
const uuid_1 = require("@sanity/uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const saltRounds = 10;
/**
 * @option client - The Sanity client instance
 * @option newProfileDefaults - Default values for a new profile
 *
 **/
const SanityAdapter = ({ client, newProfileDefaults = {} }) => {
    return {
        async getAdapter({ secret, logger, ...appOptions }) {
            if (!appOptions.jwt) {
                logger.warn("this adapter only work with jwt");
            }
            const hashToken = (token) => bcrypt_1.default.hash(`${token}${secret}`, saltRounds);
            return {
                displayName: "Sanity",
                async createUser(profile) {
                    const user = await client.create({
                        _id: `user.${uuid_1.uuid()}`,
                        _type: "user",
                        email: profile.email,
                        name: profile.name,
                        image: profile.image,
                        ...newProfileDefaults,
                    });
                    return {
                        id: user._id,
                        ...user,
                    };
                },
                async getUser(id) {
                    const user = await client.fetch(queries_1.getUserByIdQuery, {
                        id,
                    });
                    if (!user)
                        return null;
                    return {
                        ...user,
                        id: user._id,
                    };
                },
                async linkAccount(userId, providerId, providerType, providerAccountId, refreshToken, accessToken, accessTokenExpires) {
                    await client.create({
                        _type: "account",
                        providerId,
                        providerType,
                        providerAccountId: `${providerAccountId}`,
                        refreshToken,
                        accessToken,
                        accessTokenExpires,
                        user: {
                            _type: "reference",
                            _ref: userId,
                        },
                    });
                },
                async getUserByProviderAccountId(providerId, providerAccountId) {
                    const account = await client.fetch(queries_1.getUserByProviderAccountIdQuery, {
                        providerId,
                        providerAccountId: String(providerAccountId),
                    });
                    if (!account)
                        return null;
                    return {
                        id: account === null || account === void 0 ? void 0 : account.user._id,
                        ...account === null || account === void 0 ? void 0 : account.user,
                    };
                },
                async getUserByEmail(email) {
                    if (!email)
                        return null;
                    const user = await client.fetch(queries_1.getUserByEmailQuery, {
                        email,
                    });
                    if (!user)
                        return null;
                    return {
                        id: user._id,
                        ...user,
                    };
                },
                async createSession() {
                    logger.warn("[createSession] method not implemented");
                    return {};
                },
                async getSession() {
                    logger.warn("[getSession] method not implemented");
                    return {};
                },
                async updateSession() {
                    logger.warn("[updateSession] method not implemented");
                    return {};
                },
                async deleteSession() {
                    logger.warn("[deleteSession] method not implemented");
                },
                async updateUser(user) {
                    const { id, name, email, image } = user;
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
                },
                async createVerificationRequest(identifier, url, token, _, provider) {
                    await client.create({
                        _type: "verification-request",
                        identifier,
                        token: await hashToken(token),
                        expires: new Date(Date.now() + provider.maxAge * 1000),
                    });
                    await provider.sendVerificationRequest({
                        identifier,
                        token,
                        url,
                        baseUrl: appOptions.baseUrl,
                        provider,
                    });
                },
                async deleteVerificationRequest(identifier, token) {
                    const verificationRequest = await client.fetch(queries_1.getVerificationRequestQuery, {
                        identifier,
                        token: await hashToken(token),
                    });
                    if (!verificationRequest)
                        return;
                    // REMOVED BECAUSE WE COMPARE THE HASHED TOKENS IN THE QUERY
                    // const checkToken = await bcrypt.compare(
                    //   `${token}${secret}`,
                    //   verificationRequest.token
                    // );
                    // if (!checkToken) return;
                    await client.delete(verificationRequest._id);
                },
                async getVerificationRequest(identifier, token) {
                    const verificationRequest = await client.fetch(queries_1.getVerificationRequestQuery, {
                        identifier,
                        token: await hashToken(token),
                    });
                    if (!verificationRequest)
                        return null;
                    // REMOVED BECAUSE WE COMPARE THE HASHED TOKENS IN THE QUERY
                    // const checkToken = await bcrypt.compare(
                    //   `${token}${secret}`,
                    //   verificationRequest.token
                    // );
                    // if (!checkToken) return null;
                    if (verificationRequest.expires < new Date()) {
                        await client.delete(verificationRequest._id);
                        return null;
                    }
                    return {
                        id: verificationRequest._id,
                        ...verificationRequest,
                    };
                },
            };
        },
    };
};
exports.SanityAdapter = SanityAdapter;
