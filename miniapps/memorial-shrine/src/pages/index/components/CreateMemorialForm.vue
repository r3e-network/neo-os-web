<template>
  <view class="create-form">
    <text class="title">✨ {{ t("createTitle") }}</text>
    <text class="desc">{{ t("createDesc") }}</text>
    
    <view class="form-group">
      <text class="label">{{ t("labelName") }} *</text>
      <input v-model="form.name" :placeholder="t('placeholderName')" class="input" />
    </view>
    
    <view class="form-group">
      <text class="label">{{ t("labelPhoto") }}</text>
      <view class="photo-upload" @click="uploadPhoto">
        <view class="photo-preview" v-if="photoPreview">
          <image :src="photoPreview" mode="aspectFill" :alt="t('photoPreview')" />
        </view>
        <view class="photo-placeholder" v-else>
          <text class="icon">📷</text>
          <text class="text">{{ t("uploadPhoto") }}</text>
        </view>
      </view>
    </view>
    
    <view class="form-row">
      <view class="form-group half">
        <text class="label">{{ t("labelBirth") }}</text>
        <input v-model.number="form.birthYear" type="number" placeholder="1940" class="input" />
      </view>
      <view class="form-group half">
        <text class="label">{{ t("labelDeath") }}</text>
        <input v-model.number="form.deathYear" type="number" placeholder="2024" class="input" />
      </view>
    </view>
    
    <view class="form-group">
      <text class="label">{{ t("labelRelation") }}</text>
      <input v-model="form.relationship" :placeholder="t('placeholderRelation')" class="input" />
    </view>
    
    <view class="form-group">
      <text class="label">{{ t("labelBio") }}</text>
      <textarea v-model="form.biography" :placeholder="t('placeholderBio')" class="textarea" :maxlength="2000" />
    </view>
    
    <view class="form-group">
      <text class="label">{{ t("labelObituary") }}</text>
      <textarea v-model="form.obituary" :placeholder="t('placeholderObituary')" class="textarea" :maxlength="1000" />
    </view>
    
    <view class="submit-btn" @click="submit" :class="{ disabled: isSubmitting }">
      <text>{{ isSubmitting ? t("creating") : t("createBtn") }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { useI18n } from "@/composables/useI18n";
import { requireNeoChain } from "@shared/utils/chain";

const { t } = useI18n();

const props = defineProps<{
// t removed
}>();

const emit = defineEmits<{
  created: [data: any];
}>();

const { address, connect, invokeContract, getContractAddress, chainType } = useWallet() as any;

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
const isSubmitting = ref(false);

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
  } catch {
    // Ignore user cancellation.
  }
};

const submit = async () => {
  if (isSubmitting.value) return;
  if (!requireNeoChain(chainType, t)) return;
  if (!form.name.trim()) {
    uni.showToast({ title: t("nameRequired"), icon: "none" });
    return;
  }
  
  isSubmitting.value = true;
  
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(t("connectWallet"));
    
    const contract = await getContractAddress();
    
    await invokeContract({
      contractAddress: contract,
      operation: "createMemorial",
      args: [
        { type: "Hash160", value: address.value },
        { type: "String", value: form.name },
        { type: "String", value: form.photoHash },
        { type: "String", value: form.relationship },
        { type: "Integer", value: String(form.birthYear || 0) },
        { type: "Integer", value: String(form.deathYear || 0) },
        { type: "String", value: form.biography },
        { type: "String", value: form.obituary },
      ],
    });
    
    uni.showToast({ title: t("createSuccess"), icon: "success" });
    emit("created", { ...form });
    
    // Reset form
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
    
  } catch (e: any) {
    uni.showToast({ title: e?.message || t("error"), icon: "error" });
  } finally {
    isSubmitting.value = false;
  }
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

.input, .textarea {
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
  
  .icon { font-size: 24px; }
  .text { font-size: 11px; color: var(--shrine-muted); }
}

.submit-btn {
  padding: 14px;
  background: var(--shrine-button-bg);
  border-radius: 10px;
  text-align: center;
  margin-top: 8px;
  
  text {
    font-size: 15px;
    font-weight: 600;
    color: var(--shrine-button-text);
  }
  
  &.disabled {
    opacity: 0.6;
  }
}
</style>
