import { inspect, state, Store, injectable } from "$lib/internal.svelte";
import { createLogger } from "elysiatech/logging";

/**************************************************
 * Global State
 **************************************************/
@injectable()
export class App extends Store {

    @inspect() @state() accessor colorMode = "light";

    destructor = () => {

    }
}

/**************************************************
    * Error Reporting
**************************************************/
export abstract class IErrorReporter {
    abstract report(error: Error, data: Record<string, unknown>): void;
}

@injectable(IErrorReporter)
export class ConsoleErrorReporter {
    report = (error: Error, data: Record<string, unknown> = {}) => {
        createLogger({ name: "ErrorReporter" }).error(`${error.message}`, data);
    }
}

@injectable(IErrorReporter)
export class SentryErrorReporter {
    report = (error: Error, data: Record<string, unknown> = {}) => {
        // todo: send error to sentry
    }
}