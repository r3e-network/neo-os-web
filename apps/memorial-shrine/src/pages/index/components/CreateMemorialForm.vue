<template>
  <div class="create-form">
    <span class="title"><AppIcon name="sparkle" :size="20" :aria-label="t('createTitleIcon')" /> {{ t("createTitle") }}</span>
    <span class="desc">{{ t("createDesc") }}</span>

    <div class="form-group">
      <span class="label">{{ t("labelName") }} *</span>
      <input v-model="form.name" :placeholder="t('placeholderName')" class="input" :aria-label="t('labelName')" />
    </div>

    <div class="form-group">
      <span class="label">{{ t("labelPhoto") }}</span>
      <button type="button" class="photo-upload" :aria-label="t('uploadPhoto')" @click="uploadPhoto">
        <div class="photo-preview" v-if="photoPreview">
          <img :src="photoPreview" mode="aspectFill" :alt="t('photoPreview')" />
        </div>
        <div class="photo-placeholder" v-else>
          <AppIcon name="camera" :size="24" :aria-label="t('photoUploadIcon')" />
          <span class="text">{{ t("uploadPhoto") }}</span>
        </div>
      </button>
    </div>

    <div class="form-row">
      <div class="form-group half">
        <span class="label">{{ t("labelBirth") }}</span>
        <input v-model.number="form.birthYear" type="number" :placeholder="t('placeholderBirthYear')" class="input" :aria-label="t('labelBirth')" />
      </div>
      <div class="form-group half">
        <span class="label">{{ t("labelDeath") }}</span>
        <input v-model.number="form.deathYear" type="number" :placeholder="t('placeholderDeathYear')" class="input" :aria-label="t('labelDeath')" />
      </div>
    </div>

    <div class="form-group">
      <span class="label">{{ t("labelRelation") }}</span>
      <input v-model="form.relationship" :placeholder="t('placeholderRelation')" class="input" :aria-label="t('labelRelation')" />
    </div>

    <div class="form-group">
      <span class="label">{{ t("labelBio") }}</span>
      <textarea v-model="form.biography" :placeholder="t('placeholderBio')" class="textarea" :maxlength="2000" :aria-label="t('labelBio')" />
    </div>

    <div class="form-group">
      <span class="label">{{ t("labelObituary") }}</span>
      <textarea v-model="form.obituary" :placeholder="t('placeholderObituary')" class="textarea" :maxlength="1000" :aria-label="t('labelObituary')" />
    </div>

    <div v-if="status" class="status-bar" :class="status.type">
      <span class="status-text">{{ status.msg }}</span>
    </div>

    <button
      type="button"
      class="submit-btn"
      :aria-label="isSubmitting ? t('creating') : t('createBtn')"
      @click="submit"
      :disabled="isSubmitting"
    >
      <span>{{ isSubmitting ? t("creating") : t("createBtn") }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useMemorialContract } from "@/composables/useMemorialContract";

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  created: [data: Record<string, unknown>];
}>();

const memorial = useMemorialContract(t);
const { isSubmitting } = memorial;
const { status, setStatus } = useStatusMessage(5000);

const form = reactive({
  name: "",
  photoHash: "",
  birthYear: 0,
  deathYear: 0,
  relationship: "",
  biography: "",
  obituary: "",
});

const photoPreview = ref("");

const uploadPhoto = async () => {
  try {
    const res = await uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
    });

    if (res.tempFilePaths?.[0]) {
      photoPreview.value = res.tempFilePaths[0];
      // In production, upload to IPFS and get hash
      form.photoHash = "demo-" + Date.now();
    }
  } catch (_e: unknown) {
    console.warn("[memorial-shrine] image picker failed:", _e instanceof Error ? _e.message : String(_e));
  }
};

const submit = async () => {
  if (!form.name.trim()) {
    setStatus(t("nameRequired"), "error");
    return;
  }

  await memorial.createMemorial(
    form,
    () => {
      emit("created", { ...form });
      Object.assign(form, {
        name: "",
        photoHash: "",
        birthYear: 0,
        deathYear: 0,
        relationship: "",
        biography: "",
        obituary: "",
      });
      photoPreview.value = "";
    },
    setStatus
  );
};
</script>

<style lang="scss" scoped>
.create-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 24px 16px;
  background: var(--shrine-form-bg);
  border-radius: 16px;
  border: 1px solid var(--shrine-form-border);
}

.title {
  display: block;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: var(--shrine-gold);
  margin-bottom: 8px;
}

.desc {
  display: block;
  text-align: center;
  font-size: 13px;
  color: var(--shrine-muted);
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;

  &.half {
    flex: 1;
  }
}

.form-row {
  display: flex;
  gap: 12px;
}

.label {
  display: block;
  font-size: 13px;
  color: var(--shrine-muted);
  margin-bottom: 6px;
}

.input,
.textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--shrine-input-bg);
  border: 1px solid var(--shrine-input-border);
  border-radius: 8px;
  color: var(--shrine-input-text);
  font-size: 14px;
}

.textarea {
  min-height: 80px;
}

.photo-upload {
  width: 100px;
  height: 100px;
  border: 2px dashed var(--shrine-gold-border-soft);
  border-radius: 50%;
  overflow: hidden;
  appearance: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.photo-preview image {
  width: 100%;
  height: 100%;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;

  .icon {
    font-size: 24px;
  }
  .text {
    font-size: 11px;
    color: var(--shrine-muted);
  }
}

.submit-btn {
  padding: 14px;
  background: var(--shrine-button-bg);
  border-radius: 10px;
  text-align: center;
  margin-top: 8px;
  border: none;
  appearance: none;
  cursor: pointer;
  width: 100%;

  text {
    font-size: 15px;
    font-weight: 600;
    color: var(--shrine-button-text);
  }

  &.disabled,
  &:disabled {
    opacity: 0.6;
  }
}

.status-bar {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  text-align: center;

  &.success {
    background: var(--shrine-gold-soft);
    border: 1px solid var(--shrine-gold);
  }
  &.error {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid rgba(220, 38, 38, 0.4);
  }

  .status-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--shrine-text);
  }
}
</style>
