
const SHADER_CODE = /* wgsl */ `
const K = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
  0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
  0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
  0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
  0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
  0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
  0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
  0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
  0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

struct Params    { nonce_base : u32, difficulty : u32, _p0 : u32, _p1 : u32 }
struct TokenData { w : array<vec4<u32>, 2>                                   }
struct Result    { found : atomic<u32>                                        }

@group(0) @binding(0) var<uniform>             params : Params;
@group(0) @binding(1) var<uniform>             tok    : TokenData;
@group(0) @binding(2) var<storage, read_write> res    : Result;

fn rotr(x : u32, n : u32) -> u32 { return (x >> n) | (x << (32u - n)); }

fn sha256_h0(nonce : u32) -> u32 {
  var w : array<u32, 64>;
  w[0] = tok.w[0].x; w[1] = tok.w[0].y; w[2] = tok.w[0].z; w[3] = tok.w[0].w;
  w[4] = tok.w[1].x; w[5] = tok.w[1].y; w[6] = tok.w[1].z; w[7] = tok.w[1].w;
  w[8]  = nonce;
  w[9]  = 0x80000000u;
  w[14] = 0u;
  w[15] = 288u;

  for (var i = 16u; i < 64u; i++) {
    let s0 = rotr(w[i-15u],  7u) ^ rotr(w[i-15u], 18u) ^ (w[i-15u] >>  3u);
    let s1 = rotr(w[i - 2u],17u) ^ rotr(w[i - 2u], 19u) ^ (w[i - 2u] >> 10u);
    w[i]   = w[i-16u] + s0 + w[i-7u] + s1;
  }

  var a = 0x6a09e667u; var b = 0xbb67ae85u;
  var c = 0x3c6ef372u; var d = 0xa54ff53au;
  var e = 0x510e527fu; var f = 0x9b05688cu;
  var g = 0x1f83d9abu; var h = 0x5be0cd19u;

  for (var i = 0u; i < 64u; i++) {
    let S1  = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let ch  = (e & f) ^ (~e & g);
    let t1  = h + S1 + ch + K[i] + w[i];
    let S0  = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let maj = (a & b) ^ (a & c) ^ (b & c);
    h = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + S0 + maj;
  }

  return 0x6a09e667u + a;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let nonce = params.nonce_base + gid.x;
  let h0    = sha256_h0(nonce);
  let shift = 32u - params.difficulty * 4u;
  if ((h0 >> shift) == 0u) {
    atomicMin(&res.found, nonce);
  }
}
`;



type GpuResources = {
    device: GPUDevice;
    pipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;
    paramsBuf: GPUBuffer;
    tokenBuf: GPUBuffer;
    resultBuf: GPUBuffer;
    stagingBuf: GPUBuffer;
};

export type PowStatus = "loading" | "processing" | "success" | "error";

export type PowOptions = {
    /** Called whenever the solving status changes. */
    onStatusChange?: (status: PowStatus) => void;
    /**
     * Called automatically when the PoW token is renewed before it expires.
     * Use this to keep hidden form fields up-to-date without user interaction.
     */
    onRenew?: (result: { token: string; nonce: string }) => void;
};

export type PowResult = { token: string; nonce: string };



function hexToTokenWords(hex: string): ArrayBuffer {
    const u32 = new Uint32Array(8);
    for (let i = 0; i < 8; i++)
        u32[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
    return u32.buffer;
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++)
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}



export class ProofOfWork {
    private expiration: number | null = null;
    private _solving = false;
    private renewTimer: ReturnType<typeof setTimeout> | null = null;
    private _gpu: GpuResources | false | null = null;
    private _gpuSupported: boolean | null = null;
    private readonly id: string;
    private readonly onStatusChange: PowOptions["onStatusChange"];
    private readonly onRenew: PowOptions["onRenew"];

    constructor(id: string, options: PowOptions = {}) {
        this.id = id;
        this.onStatusChange = options.onStatusChange;
        this.onRenew = options.onRenew;
    }



    private static async _checkGpuSupport(): Promise<boolean> {
        try {
            if (!navigator.gpu) return false;
            return !!(await navigator.gpu.requestAdapter());
        } catch {
            return false;
        }
    }

    private async _initGpu(): Promise<GpuResources | false> {
        if (this._gpu !== null) return this._gpu;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                this._gpu = false;
                return false;
            }
            const device = await adapter.requestDevice();
            device.lost.then(() => { this._gpu = null; });

            const shaderModule = device.createShaderModule({ code: SHADER_CODE });
            const info = await shaderModule.getCompilationInfo();
            if (info.messages.some((m) => m.type === "error")) {
                console.warn("PoW WGSL errors:", info.messages);
                this._gpu = false;
                return false;
            }

            const pipeline = await device.createComputePipelineAsync({
                layout: "auto",
                compute: { module: shaderModule, entryPoint: "main" },
            });

            const U = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
            const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
            const R = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST;

            const paramsBuf = device.createBuffer({ size: 16, usage: U });
            const tokenBuf = device.createBuffer({ size: 32, usage: U });
            const resultBuf = device.createBuffer({ size: 16, usage: S });
            const stagingBuf = device.createBuffer({ size: 4, usage: R });

            const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: paramsBuf } },
                    { binding: 1, resource: { buffer: tokenBuf } },
                    { binding: 2, resource: { buffer: resultBuf } },
                ],
            });

            this._gpu = { device, pipeline, bindGroup, paramsBuf, tokenBuf, resultBuf, stagingBuf };
            return this._gpu;
        } catch (e) {
            console.warn("WebGPU init failed, using CPU fallback:", e);
            this._gpu = false;
            return false;
        }
    }



    private async _solveGpu(tokenHex: string, difficulty: number): Promise<number | null> {
        const gpu = await this._initGpu();
        if (!gpu) return null;

        const { device, pipeline, bindGroup, paramsBuf, tokenBuf, resultBuf, stagingBuf } = gpu;
        const NOT_FOUND = 0xffffffff;
        const WORKGROUPS = 4096;
        const BATCH = WORKGROUPS * 256;

        try {
            device.queue.writeBuffer(tokenBuf, 0, hexToTokenWords(tokenHex));

            for (let base = 0; base + BATCH <= NOT_FOUND; base += BATCH) {
                device.queue.writeBuffer(paramsBuf, 0, new Uint32Array([base, difficulty, 0, 0]));
                device.queue.writeBuffer(resultBuf, 0, new Uint32Array([NOT_FOUND, 0, 0, 0]));

                const enc = device.createCommandEncoder();
                const pass = enc.beginComputePass();
                pass.setPipeline(pipeline);
                pass.setBindGroup(0, bindGroup);
                pass.dispatchWorkgroups(WORKGROUPS);
                pass.end();
                enc.copyBufferToBuffer(resultBuf, 0, stagingBuf, 0, 4);
                device.queue.submit([enc.finish()]);

                await stagingBuf.mapAsync(GPUMapMode.READ, 0, 4);
                const found = new Uint32Array(stagingBuf.getMappedRange(0, 4))[0];
                stagingBuf.unmap();

                if (found !== NOT_FOUND) return found || null;
                await new Promise((r) => setTimeout(r, 0));
            }
            return null;
        } catch (e) {
            console.warn("GPU solve error, falling back to CPU:", e);
            this._gpu = null;
            return null;
        }
    }



    private async _solveCpu(tokenHex: string, difficulty: number): Promise<number> {
        const prefix = "0".repeat(difficulty);
        const tokenBytes = hexToBytes(tokenHex);
        const input = new Uint8Array(36);
        input.set(tokenBytes);

        for (let nonce = 0; nonce <= 0xffffffff; nonce++) {
            input[32] = (nonce >>> 24) & 0xff;
            input[33] = (nonce >>> 16) & 0xff;
            input[34] = (nonce >>> 8) & 0xff;
            input[35] = nonce & 0xff;

            const buf = await crypto.subtle.digest("SHA-256", input);
            const hex = [...new Uint8Array(buf)]
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            if (hex.startsWith(prefix)) return nonce;
            if (nonce > 0 && nonce % 5000 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        throw new Error("Nonce space exhausted");
    }



    private _setStatus(status: PowStatus): void {
        this.onStatusChange?.(status);
    }



    private async _requestChallenge(
        email: string,
    ): Promise<{ token: string; expiration: number; difficulty: number }> {
        const res = await fetch(`https://group.sendlix.com/${this.id}/pow`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(`Challenge request failed: ${res.status}`);
        return res.json() as Promise<{ token: string; expiration: number; difficulty: number }>;
    }



    private _scheduleRenew(email: string): void {
        if (this.renewTimer) clearTimeout(this.renewTimer);
        const now = Math.floor(Date.now() / 1000);
        const renewIn = Math.max((this.expiration! - now - 60) * 1000, 0);
        this.renewTimer = setTimeout(() => void this._renewInternal(email), renewIn);
    }

    private async _renewInternal(email: string): Promise<void> {
        if (this._solving) return;
        try {
            const result = await this._solveInternal(email, true);
            this._scheduleRenew(email);
            this.onRenew?.(result);
        } catch (err) {
            console.error("PoW renewal error:", err);
        }
    }



    private async _solveInternal(email: string, isRenew = false): Promise<PowResult> {
        this._solving = true;
        this._setStatus(isRenew ? "processing" : "loading");

        try {
            if (this._gpuSupported === null) {
                this._gpuSupported = await ProofOfWork._checkGpuSupport();
            }

            const { token, expiration, difficulty } = await this._requestChallenge(email);
            this.expiration = expiration;

            let nonce: number | null = null;
            if (this._gpuSupported) {
                nonce = await this._solveGpu(token, difficulty);
            }
            if (nonce === null) {
                nonce = await this._solveCpu(token, difficulty);
            }

            this._setStatus("success");
            return { token, nonce: nonce.toString() };
        } catch (err) {
            this._setStatus("error");
            throw err;
        } finally {
            this._solving = false;
        }
    }



    /**
     * Solves the Proof-of-Work challenge for the given email address.
     * Returns `{ token, nonce }` which must be submitted alongside the form.
     * Automatically schedules a silent token renewal before expiry.
     *
     * @example
     * ```ts
     * const pow = new ProofOfWork(groupId);
     * const { token, nonce } = await pow.solve("user@example.com");
     * await subscribeToGroup({ id: groupId, email, botProtection: { type: "proofOfWork", token, nonce } });
     * ```
     */
    async solve(email: string): Promise<PowResult> {
        if (!email || !email.includes("@")) {
            throw new Error("Invalid email address");
        }
        const result = await this._solveInternal(email);
        this._scheduleRenew(email);
        return result;
    }

    /**
     * Pre-warms the WebGPU pipeline so the first `solve()` call is faster.
     * Safe to call on component mount; does nothing if WebGPU is unavailable.
     */
    init(): void {
        if (typeof navigator !== "undefined" && navigator.gpu) {
            this._initGpu().catch(() => { });
        }
    }

    /** Cancels any pending renewal timer and releases GPU resources. */
    close(): void {
        if (this.renewTimer) clearTimeout(this.renewTimer);
        this.renewTimer = null;
        this._gpu = null;
    }
}
