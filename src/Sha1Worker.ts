import { SetWorkerObject, TransferTypedArray } from "./RemoteWorkerProxy";

type Ptr = number;
type WasmModule = WebAssembly.Exports & {
    getMemoryBuffer: () => Ptr;
    sha1: (sizeInBytes: number) => Ptr;
    _initialize: () => void;
    memory: WebAssembly.Memory;
};

export class Sha1WorkerObject {
    private module: WasmModule;
    private HEAPU8: Uint8Array;

    constructor(Module: WasmModule) {
        Module._initialize();
        this.HEAPU8 = new Uint8Array(Module.memory.buffer);

        this.module = Module;
    }

    public computeHashes(inputs: Uint8Array[]) {
        const ptr = this.module.getMemoryBuffer();

        const hashResultSize = 20; // 20 bytes per sha-1 hash

        const result = new Uint8Array(inputs.length * hashResultSize);
        for (let i = 0; i < inputs.length; ++i) {
            const bytes = inputs[i];
            this.HEAPU8.set(bytes, ptr);

            const resultPtr = this.module.sha1(bytes.length);

            const offset = i * hashResultSize;
            result.set(this.HEAPU8.subarray(resultPtr, resultPtr + hashResultSize), offset);
        }

        // Transfer back the original buffers to reuse memory
        // The result buffer is not transferred, because it's relatively small
        inputs.forEach(TransferTypedArray);

        return {
            result,
            originalInputs: inputs,
        };
    }
}

SetWorkerObject<Sha1WorkerObject, Uint8Array>(async initData => {
    const wasm = await WebAssembly.instantiate(initData as BufferSource);
    const Module = wasm.instance.exports as WasmModule;
    return new Sha1WorkerObject(Module);
});
