import { Profile, Session } from "next-auth";
import { Adapter } from "next-auth/adapters";
import { User } from "next-auth";
import { SanityClient } from "@sanity/client";
/**
 * @option client - The Sanity client instance
 * @option newProfileDefaults - Default values for a new profile
 *
 **/
export declare const SanityAdapter: Adapter<{
    client: SanityClient;
    newProfileDefaults?: Record<string, any>;
}, never, User & {
    id: string;
}, Profile, Session>;
