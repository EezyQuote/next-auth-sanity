"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationRequest = exports.account = exports.user = void 0;
exports.user = {
    name: 'user',
    title: 'User',
    type: 'document',
    fields: [
        {
            name: 'name',
            title: 'Name',
            type: 'string'
        },
        {
            name: 'email',
            title: 'Email',
            type: 'string'
        },
        {
            name: 'image',
            title: 'Image',
            type: 'url'
        },
        {
            name: 'password',
            type: 'string',
            hidden: true
        }
    ]
};
exports.account = {
    name: 'account',
    title: 'Account',
    type: 'document',
    fields: [
        {
            name: 'providerType',
            type: 'string'
        },
        {
            name: 'providerId',
            type: 'string'
        },
        {
            name: 'providerAccountId',
            type: 'string'
        },
        {
            name: 'refreshToken',
            type: 'string'
        },
        {
            name: 'accessToken',
            type: 'string'
        },
        {
            name: 'accessTokenExpires',
            type: 'string'
        },
        {
            name: 'user',
            title: 'User',
            type: 'reference',
            to: { type: 'user' }
        }
    ]
};
exports.verificationRequest = {
    name: 'verification-request',
    title: 'Verification Request',
    type: 'document',
    fields: [
        {
            name: 'identifier',
            title: 'Identifier',
            type: 'string'
        },
        {
            name: 'token',
            title: 'Token',
            type: 'string'
        },
        {
            name: 'expires',
            title: 'Expires',
            type: 'date'
        }
    ]
};
