export const responseMessages = {
    0: "Email added to group",
    1: "Email already in group",
    2: "Invalid email address",
    3: "Please fill in all fields",
    4: "CAPTCHA verification failed",
    5: "Error checking email",
    6: "Error inserting email",
    7: "Please complete the CAPTCHA",
    8: "Not Found",
} as const;

export type GroupResponse = {
    success: boolean;
    message: (typeof responseMessages)[keyof typeof responseMessages];
    code: keyof typeof responseMessages;
};