<template>
  <StandardAppShell>
    <IndexPage />
  </StandardAppShell>
</template>

<script setup lang="ts">
import StandardAppShell from "@shared/templates/StandardAppShell.vue";
import IndexPage from "./pages/index/index.vue";
import AccountGenerator from "./components/AccountGenerator.vue";
import ConverterTool from "./components/ConverterTool.vue";
</script>
