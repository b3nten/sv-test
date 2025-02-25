import { getContext, hasContext, setContext } from "svelte";

const registry = new Map<ProtocolOrConstructor<any>, Set<new () => any>>();
export const DI_CONTEXT_KEY = Symbol('DI_CONTAINER');

export type Protocol<T> = { _brand: T }

type ProtocolOrConstructor<T> = Protocol<T> | (new (...args: any[]) => T);

export let createProtocol = <T>(impl?: new () => T) => {
    return Symbol() as unknown as Protocol<T>
}

type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends
        ((k: infer I) => void) ? I : never;

type ExtractKeyType<K> = K extends Protocol<infer T>
    ? T
    : K extends new (...args: any[]) => infer T
        ? T
        : never;

// Updated InjectResult type to handle both StoreKey and constructors
type InjectResult<K extends readonly ProtocolOrConstructor<any>[]> =
    UnionToIntersection<{
        [P in keyof K]: ExtractKeyType<K[P]>;
    }[number]>;

// The injectable decorator function
export function injectable<
    Keys extends ProtocolOrConstructor<any>[],
    RequiredTypes = InjectResult<Keys>
>(
    ...keys: Keys
): <T extends new (...args: any[]) => RequiredTypes>(constructor: T) => T {
    return <T extends new (...args: any[]) => RequiredTypes>(constructor: T): T => {
        // If no keys provided, register the class with itself as key
        if (keys.length === 0) {
            registry.set(constructor, new Set([constructor]));
        } else {
            // Register the class with all provided keys
            for (const key of keys) {
                if (!registry.has(key)) {
                    registry.set(key, new Set());
                }
                registry.get(key)!.add(constructor);
            }
        }
        return constructor;
    };
}

let getContainer = (): Map<ProtocolOrConstructor<any>, any> => {
    if(!hasContext(DI_CONTEXT_KEY)) {
        setContext(DI_CONTEXT_KEY, new Map<ProtocolOrConstructor<any>, any>())
    }
    return getContext(DI_CONTEXT_KEY);
}

export let provide = (...instances: any[]) => {
    const container = getContainer();
    for(const instance of instances) {
        let constructor = instance.constructor;
        for(let [protocol, constructors] of registry.entries()) {
            if (constructors.has(constructor)) {
                container.set(protocol, instance);
            }
        }
    }
}

export let inject = <T>(key: ProtocolOrConstructor<T>): T => {
    const container = getContainer();
    if (!container.has(key)) {
        throw Error(`No provider found for ${key.toString()}`);
    }
    return container.get(key);
}
