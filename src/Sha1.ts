import type { Sha1WorkerObject } from "./Sha1Worker";
import Sha1Worker from "./Sha1Worker?worker";
import Sha1Wasm from "./wasm/Sha1.wasm?url";
import Sha1SimdWasm from "./wasm/Sha1Simd.wasm?url";
import SimdDetectionWasm from "./wasm/SimdDetection.wasm?url";
import { CreateWorkerProxy, TransferTypedArray } from "./RemoteWorkerProxy";
import type { RemoteProxy } from "./RemoteProxy";

// Use 8 workers max, reading from disk will be the slowest anyways
const maxWorkerCount = Math.min(navigator.hardwareConcurrency || 1, 8);

type WorkerObject = RemoteProxy<Sha1WorkerObject>;

function createWorkerPool(workers: WorkerObject[]) {
    const waitingResolvers: ((worker: WorkerObject) => void)[] = [];

    let activeCreationId = -1;

    const computeHashes = async (data: Uint8Array[], creationId: number | null) => {
        let worker: WorkerObject;

        if (workers.length !== 0) {
            worker = workers.pop()!;
        } else {
            worker = await new Promise<WorkerObject>(res => waitingResolvers.push(res));
        }

        const isCancelled = creationId !== null && creationId !== activeCreationId;

        if (!isCancelled) {
            data.forEach(TransferTypedArray);
        }

        const result = isCancelled ? null : await worker.computeHashes(data);

        const waitingResolver = waitingResolvers.pop();
        if (waitingResolver === undefined) {
            workers.push(worker);
        } else {
            waitingResolver(worker);
        }

        return result;
    };

    const setCreationId = async (id: number) => {
        activeCreationId = id;
    };

    return {
        computeHashes,
        setCreationId,
    };
}

declare var workerScriptSource: string | undefined; // Value will be set by the build script if needed
let workerScriptBlobUrl: string | null = null;
if (import.meta.env.MODE === "singlefile" && typeof workerScriptSource !== "undefined") {
    const blob = new Blob([workerScriptSource], { type: "text/javascript" });
    workerScriptBlobUrl = URL.createObjectURL(blob);
}

function createWorker(): Worker {
    if (import.meta.env.MODE === "singlefile") {
        // Must use import.meta.env.MODE, so the bundler can remove unreachable code
        // (which would use import.meta.url during runtime, which is not available in single file mode)

        if (workerScriptBlobUrl === null) {
            // Shouldn't happen
            throw Error("Worker script url is missing");
        }

        return new Worker(workerScriptBlobUrl, { name: "Sha-1 worker" });
    } else {
        return new Sha1Worker();
    }
}

async function initializeWorkers() {
    let simdSupported = true;
    try {
        // https://github.com/GoogleChromeLabs/wasm-feature-detect/blob/main/src/detectors/simd/module.wat
        await WebAssembly.instantiateStreaming(fetch(SimdDetectionWasm));
    } catch {
        simdSupported = false;
    }

    const sha1WasmBytesBase64 = simdSupported ? Sha1SimdWasm : Sha1Wasm;
    const sha1WasmBytes = new Uint8Array(await (await fetch(sha1WasmBytesBase64)).arrayBuffer());

    const workers: WorkerObject[] = [];

    for (let i = 0; i < maxWorkerCount; ++i) {
        const worker = createWorker();
        const proxy = CreateWorkerProxy<Sha1WorkerObject, Uint8Array>(worker, sha1WasmBytes);
        workers.push(proxy);
    }

    return createWorkerPool(workers);
}

export const workerPoolPromise = initializeWorkers();
