<script lang="ts">
    import { ConsoleErrorReporter, Counter } from "$lib"
    import { provide } from "$lib/di";
    import ErrorBoundary from "$lib/ErrorBoundary.svelte";

    let { children } = $props()

    provide(
        new Counter(),
        new ConsoleErrorReporter(),
    );
</script>

{#snippet fallback(error)}
    <div>
        <h1>Something went wrong</h1>
    </div>
{/snippet}

{@render children()}

