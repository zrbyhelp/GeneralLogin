<template>
  <div class="app-shell">
    <ClientOnly>
      <PortalField />
    </ClientOnly>
    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>
