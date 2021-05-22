/// <reference types="node" />
import { CredentialsProvider } from 'next-auth/providers';
import { SanityClient } from '@sanity/client';
import { IncomingMessage, ServerResponse } from 'node:http';
interface Options {
    client: SanityClient;
}
declare type CredentialsConfig = ReturnType<CredentialsProvider>;
export interface Handler {
    req: IncomingMessage & {
        body: any;
    };
    res: ServerResponse & {
        json: (body: any) => void;
    };
    client: SanityClient;
}
export declare const signUpHandler: ({ req, client, res }: Handler) => Promise<void>;
export declare const SanityCredentials: ({ client }: Options) => CredentialsConfig;
export {};
