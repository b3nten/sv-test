<script lang="ts">
    import { ConsoleErrorReporter, App } from "$lib"
    import { provide } from "$lib/internal.svelte";
    import ErrorBoundary from "$lib/ErrorBoundary.svelte";

    let { children } = $props()

    provide(
        new App({
            mode: "dev"
        }),
        new ConsoleErrorReporter
    );

    // svelte, wtf?
    type Unknown = unknown;
</script>

<!-- Root client side fallback. -->
{#snippet fallback(error: Unknown)}
    <div>
        <h1>Something went wrong</h1>
    </div>
{/snippet}

<ErrorBoundary {fallback}>
    {@render children()}
</ErrorBoundary>
