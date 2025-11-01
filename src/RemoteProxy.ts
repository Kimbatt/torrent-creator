/**
This file is the base for the remote proxy implementation
Functions from this file should not be called directly, but through specific "remote" implementations (e.g. web worker)

To implement a specific remote, implement the {@link RemoteProxyCallbacks} interface,
then create a function which calls the {@link SetRemoteObject} function,
and another function which calls the {@link CreateRemoteProxy} function

Use the {@link SetRemoteObject} function on the remote side, and the {@link CreateRemoteProxy} function on the local side (only once)

Notes:
- Functions of the remote object will be made async
- Function parameter types must be clonable with the structured clone algorithm (so no functions, DOM nodes, etc. are allowed)
*/

// Common

export type RemoteProxy<T> = {
    [key in keyof T]: T[key] extends (...args: any[]) => any // Only keep functions
        ? (...args: Parameters<T[key]>) => Promise<ReturnType<T[key]>> // Forward parameters, and wrap the result in a promise
        : never; // Type is not a function
};

const enum MessageType {
    Initialize,
    FunctionCall,
}

export type RemoteProxyMessage =
    | {
          type: MessageType.FunctionCall;
          id: number;
          functionName: string | symbol;
          args: any[];
      }
    | {
          type: MessageType.Initialize;
          data: any;
      };

interface ResponseSuccessMessage {
    success: true;
    result: any;
}

interface ResponseErrorMessage {
    success: false;
    exception: Error;
}

type ResponseResult = ResponseSuccessMessage | ResponseErrorMessage;

export interface RemoteProxyResponse {
    id: number;
    result: ResponseResult;
}

export interface RemoteProxyCallbacks {
    // Should return true if the script is running on the remote side (e.g. in a web worker)
    isRemote: () => boolean;

    // Initializes the event listener on the local side, and when a response is received, the given callback will be called
    // Target is the specific remote object, e.g. a Worker instance
    initListenerOnLocal: (target: unknown, listenerCallback: (response: RemoteProxyResponse) => void) => void;
    // Initializes the event listener on the remote side, and when a message is received, the given callback will be called
    initListenerOnRemote: (listenerCallback: (message: RemoteProxyMessage) => void) => void;

    // This function will send a message from local to remote
    sendMessageToRemote: (target: unknown, message: RemoteProxyMessage) => void;
    // This function will send a response from remote to local
    sendResponseToLocal: (response: RemoteProxyResponse) => void;

    // Called when an error has occurred on the remote side
    onRemoteError: (error: any) => void;
}

// Remote part

let remoteObject: object | null = null;

let initResolver = (_: any) => {};
const initPromise = new Promise<any>(res => (initResolver = res));

let initDataReceived = false;
const pendingMessages: RemoteProxyMessage[] = [];

function ProcessMessage(message: RemoteProxyMessage, callbacks: RemoteProxyCallbacks) {
    if (message.type !== MessageType.FunctionCall) {
        return;
    }

    const result = ((): ResponseResult => {
        try {
            const result = (remoteObject as any)[message.functionName](...message.args);

            return {
                success: true,
                result,
            };
        } catch (ex: any) {
            callbacks.onRemoteError(ex);

            const error = (() => {
                if (ex instanceof Error) {
                    return ex;
                }

                const errorValue = (() => {
                    try {
                        return JSON.stringify(ex);
                    } catch {}

                    try {
                        return ex.toString();
                    } catch {}

                    return ex;
                })();

                return Error(errorValue, { cause: `Error in \`${message.functionName.toString()}\`` });
            })();

            return {
                success: false,
                exception: error,
            };
        }
    })();

    callbacks.sendResponseToLocal({
        id: message.id,
        result,
    });
}

export async function SetRemoteObject<T extends object, TInitData>(
    objectOrInitCallback: T | ((initData: TInitData) => T) | ((initData: TInitData) => Promise<T>),
    callbacks: RemoteProxyCallbacks,
) {
    if (!callbacks.isRemote()) {
        throw Error("This function should only be called on the remote side");
    }

    callbacks.initListenerOnRemote(message => {
        if (message.type === MessageType.Initialize) {
            initResolver(message.data);
        } else if (initDataReceived && remoteObject !== null) {
            ProcessMessage(message, callbacks);
        } else {
            pendingMessages.push(message);
        }
    });

    if (typeof objectOrInitCallback === "function") {
        const initData = await initPromise;
        remoteObject = await objectOrInitCallback(initData);
    } else {
        remoteObject = objectOrInitCallback;
    }

    initDataReceived = true;

    for (const msg of pendingMessages) {
        ProcessMessage(msg, callbacks);
    }

    pendingMessages.length = 0;
}

// Local part

export function CreateRemoteProxy<T extends object, TInitData = void>(
    target: object,
    callbacks: RemoteProxyCallbacks,
    initData?: TInitData | Promise<TInitData>,
): RemoteProxy<T> {
    if (callbacks.isRemote()) {
        throw Error("This function should not be called on the remote side");
    }

    const waitingMessages = new Map<number, (result: RemoteProxyResponse) => void>();

    callbacks.initListenerOnLocal(target, response => {
        const resolver = waitingMessages.get(response.id);
        waitingMessages.delete(response.id);

        resolver?.(response);
    });

    let messageId = 0;
    const proxy = new Proxy(target, {
        get: (target, prop) => {
            if (prop === "then") {
                // https://stackoverflow.com/a/53890904
                return null;
            }
            return async (...args: any[]) => {
                const currentId = messageId++;

                const msg: RemoteProxyMessage = {
                    type: MessageType.FunctionCall,
                    id: currentId,
                    functionName: prop,
                    args,
                };

                const response = await new Promise<RemoteProxyResponse>(res => {
                    waitingMessages.set(currentId, res);
                    callbacks.sendMessageToRemote(target, msg);
                });

                if (response.result.success) {
                    return response.result.result;
                } else {
                    throw Error("Worker proxy call threw an error", { cause: response.result.exception });
                }
            };
        },
    });

    (async () => {
        callbacks.sendMessageToRemote(target, {
            type: MessageType.Initialize,
            data: await initData,
        });
    })();

    return proxy as RemoteProxy<T>;
}
