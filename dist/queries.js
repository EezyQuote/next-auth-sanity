"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionVerificationQuery = exports.getUserByEmailQuery = exports.getUserByProviderAccountIdQuery = exports.getUserByIdQuery = void 0;
const groq_1 = __importDefault(require("groq"));
exports.getUserByIdQuery = groq_1.default `
  *[_type == 'user' && _id == $id][0]
`;
exports.getUserByProviderAccountIdQuery = groq_1.default `
  *[_type == 'account' && providerId == $providerId && providerAccountId == $providerAccountId] {
    accessToken,
    accessTokenExpires,
    providerId,
    providerType,
    providerAccountId,
    user->
  }[0]
`;
exports.getUserByEmailQuery = groq_1.default `
  *[_type == 'user' && email == $email][0]
`;
exports.getSessionVerificationQuery = groq_1.default `
  *[_type == 'session-verification' && identifier == $identifier && token == $token][0]
`;
