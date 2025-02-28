import { getContext, hasContext, setContext } from "svelte";
import { createLogger, LogLevel } from "elysiatech/logging";

/**************************************************
 Reactive Store
***************************************************/
export function state(cfg: {} = {}) {
    return function <This extends Store, T>(
        _: ClassAccessorDecoratorTarget<This, T>,
        context: ClassAccessorDecoratorContext<This, T>,
    ): ClassAccessorDecoratorResult<This, T> {
        if (!context || context.kind !== "accessor")
            throw Error("Invalid decorator usage of @state!");
        return {
            get(): T {
                return this.__state_internal[context.name]
            },
            set(val: T) {
                this.__state_internal[context.name] = val;
            },
            init(initial: T) {
                this.__state_internal[context.name] = initial;
                return initial;
            }
        }
    }
}

export function inspect<This, T>() {
    return function<This, T>(
        target: any,
        ctx: any,
    ): any {
        if(ctx.kind === "method") {
            return function (...args: any[]) {
                this.logger.debug(
                    args.length > 0
                        ? `calling ${String(ctx.name)}() with args: ${args}`
                        : `calling ${String(ctx.name)}()`
                )
                let ret;
                try {
                    ret = (target as Function).call(this, ...args);
                } catch (e) {
                    this.logger.error(`Uncaught exception in ${String(ctx.name)}():`, e)
                    throw e
                }
                this.logger.debug(
                    `result of ${String(ctx.name)}(): ${ret}`
                )
                return ret;
            }
        } else if(
            ctx.kind === "getter" ||
            ctx.kind === "accessor" ||
            ctx.kind === "field"
        ) {
            let hasRun = false;
            let t = "init"
            ctx.addInitializer(function() {
                $inspect(this[ctx.name]).with((type, val) => {
                    if(ctx.kind === "getter" && !hasRun) {
                        hasRun = true;
                        return;
                    }
                    this.logger.debug(
                        `${String(ctx.name)} (${t}): ${val}`
                    )
                    hasRun = true;
                    t = "update"
                })
            })
            return target;
        } else if (ctx.kind === "setter") {
            return function(val: T) {
                this.logger.debug(
                    `setting ${String(ctx.name)} to: ${val}`
                )
                return target.call(this, val)
            }
        }

        return target;
    }
}

export function guard() {
    return function(value: any, ctx: any) {
        if(ctx.kind === "method") {
            return function (...args: unknown[]) {
                try {
                    return value.call(this, ...args)
                } catch (e) {
                    this.logger.error(
                        `(guard) Uncaught exception in ${ctx.name}():`, e
                    )
                }
            };
        }
        if(ctx.kind === "field") {
            return function (val: any) {
                let logger = this.logger
                if(typeof val === "function") {
                    return function (...args: unknown[]) {
                        try {
                            return val.call(this, ...args)
                        } catch (e) {
                            logger.error(
                                `(guard) Uncaught exception in ${ctx.name}():`, e
                            )
                        }
                    };
                } else {
                    return val;
                }
            }
        }
        return value;
    }
}

export class Store {

    protected destructor?: () => void;

    constructor() {
        $effect(() => () => {
            try {
                this.destructor?.()
            } catch(e) {
                this.logger.warn(`UNCAUGHT ERROR IN DESTRUCTOR:`, e)
            }
        })
    }

    protected logger = createLogger({
        level: LogLevel.Debug,
        name: this.constructor.name,
    })

    private __state_internal = $state({})
}

/**************************************************
 Dependency Injection
***************************************************/
type Constructor<T, Args = any[]> = new (...args: any[]) => T;
type AbstractConstructor<T> = abstract new () => T;

export const DI_CONTEXT_KEY = Symbol('DI_CONTAINER');

const registry = new Map<Constructor<unknown>, AbstractConstructor<unknown>>

let isCtor = <T>(ctor: unknown): ctor is Constructor<T> =>
    typeof ctor === 'function';

type InjectResult<T> = T extends abstract new () => infer R ? R : never;

export function injectable<
    Key extends AbstractConstructor<unknown>
    | Constructor<unknown>
>(
    key?: Key
): <T extends new (...args: any[]) => InjectResult<Key>>(constructor: T) => T {
    return <T extends new (...args: any[]) => InjectResult<Key>>(constructor: T): T => {
        if (!key) {
            registry.set(constructor, constructor);
        } else {
            registry.set(constructor, key);
        }
        return constructor;
    };
}

export class Container {
    /**
     * Provide constructors and instances to descendant components.
     * @param instances
     */
    static provide(...instances: unknown[]) {
        let container = new Container(Container.getParent());
        for (let instance of instances) {
            if(typeof instance === 'function') {
                let token = registry.get(instance as Constructor<unknown>);
                if(token) {
                    container.add(token, instance);
                } else {
                    throw new Error(
                        `No registered interface found for constructor: ${instance.toString()}. You probably forgot to use the @injectable decorator.`
                    );
                }
            } else {
                let i = instance as Object;
                let token = i?.constructor as Constructor<unknown>;
                if(!token) {
                    throw new Error(
                        `No constructor found for instance: ${i.toString()}`
                    );
                }
                if(!registry.has(token)) {
                    throw new Error(
                        `No registered interface found for constructor: ${token.toString()}. You probably forgot to use the @injectable decorator.`
                    );
                }
                container.add(registry.get(token)!, i);
            }
        }
        setContext(DI_CONTEXT_KEY, container);
    }

    /**
     * Inject a class instance provided from an ancestor component.
     * @param token
     */
    static inject<T extends Object>(token: AbstractConstructor<T> | Constructor<T>): T {
        return Container.getParent().retrieve(token);
    }

    /**
     * Inject a new instance of a class into the container.
     * The constructor must be provided in an ancestor component.
     * @param token
     */
    static injectNew<T extends Object>(token: AbstractConstructor<T> | Constructor<T>): T {
        let ctor = Container.getParent().retrieveCtor(token);
        if(ctor) {
            return new ctor() as T;
        }
        throw new Error(`No constructor found for token: ${token.toString()}`);
    }

    protected static getParent() {
        if(!hasContext(DI_CONTEXT_KEY)) {
            setContext(DI_CONTEXT_KEY, new Container());
        }
        return getContext(DI_CONTEXT_KEY) as Container;
    }

    protected constructor(
        protected _parent?: Container
    ) {}

    protected add<T>(token: AbstractConstructor<unknown>, instance: Constructor<T> | Object) {
        if(isCtor(instance)) {
            this._ctors.set(token, instance);
        } else {
            this._values.set(token, instance);
        }
    }

    protected retrieve<T extends Object>(token: AbstractConstructor<T>): T {
        let value =
            this._values.get(token)
            ?? this.recurseParent(token);

        if(value) {
            return value as T;
        }

        let ctor = this._ctors.get(token)
            ?? this.recurseParentCtor<T>(token);

        if(ctor) {
            let val = new ctor() as T;
            this.add(token, val);
            return val;
        }

        throw new Error(`No value found for token: ${String(token)}`);
    }

    protected retrieveCtor<T>(token: AbstractConstructor<T>): Constructor<T> | null {
        return this._ctors.get(token) as Constructor<T>
            ?? this.recurseParentCtor(token);
    }

    protected recurseParent<T extends Object>(token: AbstractConstructor<T>): T | null {
        if(this._parent) {
            return this._parent.retrieve<T>(token);
        }
        return null;
    }

    protected recurseParentCtor<T>(token: AbstractConstructor<T>): Constructor<T> | null {
        if(this._parent) {
            return this._parent.retrieveCtor(token);
        }
        return null;
    }

    protected _values = new Map<AbstractConstructor<unknown>, Object>;
    protected _ctors = new Map<AbstractConstructor<unknown>, Constructor<unknown>>;
}

export const provide = Container.provide.bind(Container);
export const inject = Container.inject.bind(Container);
export const injectNew = Container.injectNew.bind(Container);