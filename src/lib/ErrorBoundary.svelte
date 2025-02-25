<script lang="ts">
	import type { Snippet } from "svelte"
    import { inject } from "$lib/di";
    import { ErrorReporterProtocol } from "$lib/index";

    let {
        onerror,
        fallback,
        children,
    }: {
        onerror?: (error: Error, retry: () => void, rawError: unknown) => void,
        fallback: Snippet<[error: unknown, reset: () => void]> | undefined
        children: Snippet
    } = $props();

    let errorReporter = inject(ErrorReporterProtocol);

	let onErrorImpl = (error: unknown, retry: () => void ) => {
        let resolvedError = error instanceof Error ? error : new Error(String(error));

        errorReporter.report(resolvedError, {
            rawError: error,
        });

		onerror?.(resolvedError, retry, error);
	}
</script>

<svelte:boundary onerror={onErrorImpl} failed={fallback}>
    {@render children()}
</svelte:boundary>
