"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanityCredentials = exports.signUpHandler = void 0;
const providers_1 = __importDefault(require("next-auth/providers"));
const queries_1 = require("./queries");
const argon2_1 = __importDefault(require("argon2"));
const uuid_1 = require("@sanity/uuid");
const signUpHandler = async ({ req, client, res }) => {
    const { email, password, name, image } = req.body;
    const user = await client.fetch(queries_1.getUserByEmailQuery, {
        email
    });
    if (user) {
        res.json({ error: 'User already exist' });
        return;
    }
    const newUser = await client.create({
        _id: `user.${uuid_1.uuid()}`,
        _type: 'user',
        email,
        password: await argon2_1.default.hash(password),
        name,
        image
    });
    res.json({
        email: newUser.email,
        name: newUser.name,
        image: newUser.image
    });
};
exports.signUpHandler = signUpHandler;
const SanityCredentials = ({ client }) => providers_1.default.Credentials({
    credentials: {
        name: 'Credentials',
        email: {
            label: 'Email',
            type: 'text'
        },
        password: {
            label: 'Password',
            type: 'password'
        }
    },
    async authorize({ email, password }) {
        const user = await client.fetch(queries_1.getUserByEmailQuery, {
            email
        });
        if (!user)
            throw new Error('Email does not exist');
        if (await argon2_1.default.verify(user.password, password)) {
            return {
                email: user.email,
                name: user.name,
                image: user.image,
                id: user.id
            };
        }
        throw new Error('Password Invalid');
    }
});
exports.SanityCredentials = SanityCredentials;
