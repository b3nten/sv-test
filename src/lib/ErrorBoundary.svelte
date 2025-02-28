<script lang="ts">
    import type {Snippet} from "svelte"
    import { IErrorReporter } from "$lib/index";
    import { inject } from "$lib/internal.svelte";

    let {
        onerror,
        fallback,
        children,
    }: {
        onerror?: (error: Error, retry: () => void, rawError: unknown) => void,
        fallback?: Snippet<[error: unknown, reset: () => void]> | undefined
        children?: Snippet
    } = $props();

    let errorReporter = inject(IErrorReporter);

    let onErrorImpl = (error: unknown, retry: () => void) => {
    	let resolvedError = error instanceof Error ? error : new Error(String(error));
    	errorReporter.report(resolvedError, {
    		rawError: error,
    	});
    	onerror?.(resolvedError, retry, error);
    }
</script>

<svelte:boundary failed={fallback}>
	{@render children?.()}
</svelte:boundary>
