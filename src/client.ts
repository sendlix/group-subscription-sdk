import type { GroupResponse } from "./types";
import { toValidVarName } from "./utils";

type BotProtection = {
    type: "proofOfWork";
    token: string;
    nonce: string;
};

type SubscribeOptions = {
    /** Group ID */
    id: string;
    email: string;
    /** Key/value pairs that replace placeholders in the email template. */
    substitute?: Record<string, string>;
    botProtection?: BotProtection;
};

/**
 * Submits a pre-built `FormData` object directly to the group endpoint.
 * Use this when you already control the form (e.g. a native `<form>`).
 */
export async function subscribeToGroupWithFormData(
    data: FormData,
    id: string,
    substitute: Record<string, string> = {},
): Promise<GroupResponse> {
    if (!data.get("email")) {
        throw new Error("Please fill in all fields");
    }

    for (const [key, value] of Object.entries(substitute)) {
        data.append(toValidVarName(key), value);
    }

    return fetch(`https://group.sendlix.com/${id}?json=true`, {
        method: "POST",
        body: data,
    }).then((res) => res.json() as Promise<GroupResponse>);
}

/**
 * Subscribes an email address to a Sendlix group.
 * Optionally includes a Proof-of-Work token to prevent bot submissions.
 */
export async function subscribeToGroup(options: SubscribeOptions): Promise<GroupResponse> {
    if (!options.id || !options.email) {
        throw new Error("Please fill in all fields");
    }

    const formData = new FormData();
    formData.append("email", options.email);

    if (options.botProtection?.type === "proofOfWork") {
        formData.append("token", options.botProtection.token);
        formData.append("nonce", options.botProtection.nonce);
    }

    return subscribeToGroupWithFormData(formData, options.id, options.substitute ?? {});
}
