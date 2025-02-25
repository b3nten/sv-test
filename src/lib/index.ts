import { guard, inspect, state, Store } from "$lib/store.svelte";
import { createProtocol, injectable } from "$lib/di";
import {createLogger} from "elysiatech/logging";

export const ErrorReporterProtocol = createProtocol<{
    report(error: Error, data?: Record<string, unknown>): void;
}>()

@injectable(ErrorReporterProtocol)
export class ConsoleErrorReporter {
    report(error: Error, data: Record<string, unknown> = {}) {
        this.logger.error(`${error.message}`, data);
    }

    logger = createLogger({
        name: "ConsoleErrorReporter"
    })
}

@injectable(ErrorReporterProtocol)
export class SentryErrorReporter {
    report(error: Error, data: Record<string, unknown> = {}) {
        // send error to sentry
    }
}

@injectable()
export class Counter extends Store {

    // @state creates a reactive state variable
    // @inspect logs changes to count
    @state() @inspect() accessor count = 0;

    @inspect() // logs changes to count
    get double() {
        return this.count * 2;
    }

    // guard catches the error
    // useful if this method is called during component initialization / in an effect
    @guard() incrementCountMightThrow = () => {
        if (Math.random() > 0.5) {
            throw new Error("Random error")
        }
        this.count++;
    }

    destructor = () => {
        console.log("bye")
    }
}