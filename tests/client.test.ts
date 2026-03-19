import { subscribeToGroup, subscribeToGroupWithFormData } from "../src/client";

const mockSuccessResponse = {
    success: true,
    message: "Email added to group",
    code: 0,
};

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockSuccessResponse),
    });
});



describe("subscribeToGroup", () => {
    it("throws when email is missing", async () => {
        await expect(subscribeToGroup({ id: "abc", email: "" }))
            .rejects.toThrow("Please fill in all fields");
    });

    it("throws when id is missing", async () => {
        await expect(subscribeToGroup({ id: "", email: "user@example.com" }))
            .rejects.toThrow("Please fill in all fields");
    });

    it("calls the correct URL with POST", async () => {
        await subscribeToGroup({ id: "my-group", email: "user@example.com" });

        expect(global.fetch).toHaveBeenCalledWith(
            "https://group.sendlix.com/my-group?json=true",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("returns a GroupResponse on success", async () => {
        const result = await subscribeToGroup({ id: "my-group", email: "user@example.com" });

        expect(result.success).toBe(true);
        expect(result.code).toBe(0);
        expect(result.message).toBe("Email added to group");
    });

    it("includes token and nonce in FormData when botProtection is provided", async () => {
        await subscribeToGroup({
            id: "my-group",
            email: "user@example.com",
            botProtection: { type: "proofOfWork", token: "tok123", nonce: "42" },
        });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(body.get("token")).toBe("tok123");
        expect(body.get("nonce")).toBe("42");
        expect(body.get("email")).toBe("user@example.com");
    });

    it("does not include token/nonce when botProtection is omitted", async () => {
        await subscribeToGroup({ id: "my-group", email: "user@example.com" });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(body.get("token")).toBeNull();
        expect(body.get("nonce")).toBeNull();
    });

    it("appends substitute fields with sanitised keys", async () => {
        await subscribeToGroup({
            id: "my-group",
            email: "user@example.com",
            substitute: { "##First Name##": "Alice", "##Last Name##": "Smith" },
        });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(body.get("First_Name")).toBe("Alice");
        expect(body.get("Last_Name")).toBe("Smith");
    });

    it("propagates fetch errors", async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

        await expect(subscribeToGroup({ id: "my-group", email: "user@example.com" }))
            .rejects.toThrow("Network error");
    });
});



describe("subscribeToGroupWithFormData", () => {
    it("throws when email is not in FormData", async () => {
        await expect(subscribeToGroupWithFormData(new FormData(), "my-group"))
            .rejects.toThrow("Please fill in all fields");
    });

    it("calls fetch when email field is present", async () => {
        const fd = new FormData();
        fd.append("email", "user@example.com");

        await subscribeToGroupWithFormData(fd, "my-group");

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("appends substitute keys to FormData", async () => {
        const fd = new FormData();
        fd.append("email", "user@example.com");

        await subscribeToGroupWithFormData(fd, "my-group", { "##City##": "Berlin" });

        const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(body.get("City")).toBe("Berlin");
    });
});
