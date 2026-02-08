<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useWallet } from "@/composables/useWallet";
import { useI18n } from "@/composables/useI18n";
import CreateForm from "@/components/CreateForm.vue";
import MyEnvelopes from "@/components/MyEnvelopes.vue";

const { t, lang, setLang } = useI18n();
const { address, connected, connect, autoConnect } = useWallet();

const activeTab = ref<"create" | "my">("create");

const toggleLang = () => setLang(lang.value === "en" ? "zh" : "en");

onMounted(autoConnect);
</script>

<template>
  <div class="app">
    <header class="app-header">
      <!-- Pure CSS envelope icon -->
      <div class="header-envelope-icon">
        <div class="envelope-body"></div>
      </div>

      <h1 class="app-title">{{ t("title") }}</h1>
      <p class="app-subtitle">{{ t("subtitle") }}</p>

      <button v-if="!connected" class="btn btn-primary" @click="connect">
        {{ t("connectWallet") }}
      </button>
      <div v-else class="wallet-pill">{{ address.slice(0, 8) }}...{{ address.slice(-6) }}</div>
    </header>

    <!-- Lang toggle (top-right) -->
    <button class="lang-toggle" @click="toggleLang">{{ t("langToggle") }}</button>

    <!-- Gold ornamental divider -->
    <div class="ornament-divider">
      <span class="ornament-dot"></span>
    </div>

    <nav class="tabs">
      <button :class="['tab', { active: activeTab === 'create' }]" @click="activeTab = 'create'">
        {{ t("createTab") }}
      </button>
      <button :class="['tab', { active: activeTab === 'my' }]" @click="activeTab = 'my'">
        {{ t("myTab") }}
      </button>
    </nav>

    <main class="app-content">
      <CreateForm v-if="activeTab === 'create'" />
      <MyEnvelopes v-else />
    </main>
  </div>
</template>
