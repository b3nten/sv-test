<script lang="ts">
    import { inject } from "$lib/di";
    import { Counter } from "$lib";

    let test = inject(Counter);
    test.incrementCountMightThrow();
</script>

<p>the count is {test.count}, doubled is {test.double}</p>
<button onclick={test.incrementCountMightThrow}>increment</button>
