<script setup lang="ts">
const route = useRoute();

await navigateTo({
  path: "/login",
  query: route.query
});
</script>
