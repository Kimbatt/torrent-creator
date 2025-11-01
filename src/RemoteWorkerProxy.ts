/**
Usage:
On the worker thread, specify a type that will be used for communication
On the worker thread, call {@link SetWorkerObject} with an object instance of that type, or a function that returns such an object
On the main thread, call {@link CreateWorkerProxy} with a web worker instance, and pass the above type in a type parameter (use `import type`)
  If needed, pass an initialization parameter to this function, which will be received on the worker thread
Use the returned object from {@link CreateWorkerProxy} to call functions directly on the worker object

Use {@link Transfer} and {@link TransferTypedArray} to transfer objects instead of copying
(this can be used in both the main thread and the worker thread)
These functions will transfer the objects in the next proxy call (globally), so make sure to
call the transfer functions directly before that
*/

/// <reference lib="webworker" />

import {
    CreateRemoteProxy,
    SetRemoteObject,
    type RemoteProxyCallbacks,
    type RemoteProxyMessage,
    type RemoteProxyResponse,
} from "./RemoteProxy";

const isWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;

let transferList: Transferable[] = [];
export function Transfer<T>(value: T, ...transferables: Transferable[]) {
    transferList.push(...transferables);
    return value;
}

export function TransferTypedArray<T extends { buffer: ArrayBufferLike }>(arr: T) {
    return Transfer(arr, arr.buffer);
}

function GetAndClearTransferList() {
    const list = transferList;
    transferList = [];
    return list;
}

const workerCallbacks: RemoteProxyCallbacks = {
    isRemote: () => isWorker,

    initListenerOnLocal: (target, listenerCallback) => {
        const worker = target as Worker;

        worker.addEventListener("message", msg => {
            const response: RemoteProxyResponse = msg.data;
            listenerCallback(response);
        });
    },

    initListenerOnRemote: listenerCallback => {
        self.addEventListener("message", msg => {
            const message: RemoteProxyMessage = msg.data;
            listenerCallback(message);
        });
    },

    sendMessageToRemote: (target, message) => {
        const worker = target as Worker;
        worker.postMessage(message, GetAndClearTransferList());
    },

    sendResponseToLocal: response => {
        postMessage(response, GetAndClearTransferList());
    },

    onRemoteError: () => {
        transferList = [];
    },
};

export async function SetWorkerObject<T extends object, TInitData>(
    objectOrInitCallback: T | ((initData: TInitData) => T) | ((initData: TInitData) => Promise<T>),
) {
    SetRemoteObject<T, TInitData>(objectOrInitCallback, workerCallbacks);
}

export function CreateWorkerProxy<T extends object, TInitData = void>(
    worker: Worker,
    initData?: TInitData | Promise<TInitData>,
) {
    return CreateRemoteProxy<T, TInitData>(worker, workerCallbacks, initData);
}
