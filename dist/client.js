"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUp = void 0;
const axios_1 = __importDefault(require("axios"));
const signUp = async (data) => {
    const res = await axios_1.default.post('/api/sanity/signUp', {
        ...data
    });
    return res.data;
};
exports.signUp = signUp;
