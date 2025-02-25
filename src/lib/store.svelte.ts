import { createLogger, LogLevel } from "elysiatech/logging";

export function state(cfg: { } = {}) {
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
