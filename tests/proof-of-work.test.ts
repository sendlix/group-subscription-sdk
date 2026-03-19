import { ProofOfWork, type PowStatus } from "../src/proof-of-work";



const FAKE_TOKEN = "a".repeat(64); // 32-byte hex string
const FAKE_EXPIRATION = Math.floor(Date.now() / 1000) + 3600;

/** Returns an ArrayBuffer of 32 bytes with firstByte at index 0. */
function makeDigest(firstByte: number): ArrayBuffer {
    const buf = new Uint8Array(32);
    buf[0] = firstByte;
    return buf.buffer;
}

/** Queues one mocked challenge response on global.fetch. */
function mockChallenge(difficulty = 1) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
            token: FAKE_TOKEN,
            expiration: FAKE_EXPIRATION,
            difficulty,
        }),
    });
}



let origCryptoDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
    // Force the CPU path by hiding navigator.gpu
    if (typeof global.navigator !== "undefined") {
        Object.defineProperty(global.navigator, "gpu", {
            value: undefined,
            configurable: true,
            writable: true,
        });
    }

    global.fetch = jest.fn();

    // Replace globalThis.crypto with a mock that always returns an immediate
    // SHA-256 match (0x00…) so the CPU solver finishes on nonce=0 instantly.
    origCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        get: () => ({
            subtle: {
                digest: jest.fn().mockResolvedValue(makeDigest(0x00)),
            },
        }),
    });
});

afterEach(() => {
    // Restore original crypto
    if (origCryptoDescriptor) {
        Object.defineProperty(globalThis, "crypto", origCryptoDescriptor);
    }
    jest.clearAllTimers();
    jest.useRealTimers();
});



describe("ProofOfWork.solve()", () => {
    it("resolves with token and nonce", async () => {
        mockChallenge(1);
        const pow = new ProofOfWork("test-group");
        const result = await pow.solve("user@example.com");
        pow.close();

        expect(result).toHaveProperty("token", FAKE_TOKEN);
        expect(result).toHaveProperty("nonce", "0"); // nonce=0 always matches with mock
    });

    it("calls onStatusChange with 'loading' then 'success'", async () => {
        mockChallenge(1);
        const statuses: PowStatus[] = [];
        const pow = new ProofOfWork("test-group", {
            onStatusChange: (s) => statuses.push(s),
        });
        await pow.solve("user@example.com");
        pow.close();

        expect(statuses[0]).toBe("loading");
        expect(statuses[statuses.length - 1]).toBe("success");
    });

    it("rejects and emits 'error' status when the challenge request fails", async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));
        const statuses: PowStatus[] = [];
        const pow = new ProofOfWork("test-group", {
            onStatusChange: (s) => statuses.push(s),
        });

        await expect(pow.solve("user@example.com")).rejects.toThrow("Network error");
        expect(statuses).toContain("error");
        pow.close();
    });

    it("rejects immediately for an invalid email (no @)", async () => {
        const pow = new ProofOfWork("test-group");
        await expect(pow.solve("not-an-email")).rejects.toThrow("Invalid email address");
        await expect(pow.solve("")).rejects.toThrow("Invalid email address");
        pow.close();
    });

    it("rejects when the server responds with a non-ok status", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 });
        const pow = new ProofOfWork("test-group");

        await expect(pow.solve("user@example.com")).rejects.toThrow("Challenge request failed: 429");
        pow.close();
    });

    it("POST-s the email address to the PoW endpoint", async () => {
        mockChallenge(1);
        const pow = new ProofOfWork("my-group");
        await pow.solve("hello@example.com");
        pow.close();

        expect(global.fetch).toHaveBeenCalledWith(
            "https://group.sendlix.com/my-group/pow",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ email: "hello@example.com" }),
            }),
        );
    });
});



describe("ProofOfWork.close()", () => {
    it("cancels the renewal timer so no further requests are made", async () => {
        jest.useFakeTimers();
        mockChallenge(1);

        const pow = new ProofOfWork("test-group");
        await pow.solve("user@example.com");

        pow.close(); // cancel renewal timer

        jest.runAllTimers();
        await Promise.resolve(); // flush microtasks

        // Only the initial challenge request should have been made
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});



describe("ProofOfWork.onRenew()", () => {
    it("is called when the renewal timer fires", async () => {
        jest.useFakeTimers();

        mockChallenge(1); // initial solve
        mockChallenge(1); // renewal solve

        const renewed = jest.fn();
        const pow = new ProofOfWork("test-group", {
            onRenew: (result) => {
                renewed(result);
                pow.close(); // cancel the next renewal to prevent cascading
            },
        });

        await pow.solve("user@example.com");

        // Advance past the renewal point (expiration - 60 s from now ≈ 3540 s)
        await jest.runAllTimersAsync();

        expect(renewed).toHaveBeenCalledTimes(1);
        expect(renewed).toHaveBeenCalledWith(
            expect.objectContaining({ token: FAKE_TOKEN, nonce: "0" }),
        );
    });
});
