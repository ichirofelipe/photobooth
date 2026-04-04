<template>
  <div id="parent" class="qr-page">
    <!-- Success header -->
    <div class="qr-header">
      <div class="success-icon">
        <i class="mdi mdi-check-circle"></i>
      </div>
      <h1>Printed!</h1>
      <p class="qr-subtitle">Your photo has been sent to the printer</p>
    </div>

    <!-- QR section -->
    <div class="qr-card">
      <template v-if="status === 'loading'">
        <div class="qr-placeholder">
          <i class="mdi mdi-loading mdi-spin"></i>
          <p>Preparing your download link...</p>
        </div>
      </template>

      <template v-else-if="status === 'ready'">
        <h2 class="qr-card-title">Scan to Download</h2>
        <p class="qr-card-subtitle">
          Connect to the Wi-Fi hotspot, then scan the QR&nbsp;code to save your photo
        </p>
        <div class="qr-image-wrapper">
          <img :src="qrDataUrl" alt="QR Code" class="qr-image" />
        </div>
      </template>

      <template v-else>
        <div class="qr-placeholder qr-error">
          <i class="mdi mdi-alert-circle-outline"></i>
          <p>Could not generate download link</p>
          <p class="qr-error-hint">Make sure the server is running and try again</p>
        </div>
      </template>
    </div>

    <!-- Dismiss -->
    <div class="qr-footer">
      <button class="pb-button qr-done-btn" @click="goHome()">
        <i class="mdi mdi-check-circle"></i> Done
      </button>
      <p class="qr-auto-close">This screen will close automatically</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/appStore';
import { PhotoServer } from '@/plugins/photo-server';
import QRCode from 'qrcode';

const router = useRouter();
const appStore = useAppStore();

const AUTO_DISMISS_SECONDS = 60;

const status = ref<'loading' | 'ready' | 'error'>('loading');
const qrDataUrl = ref('');
const countdown = ref(AUTO_DISMISS_SECONDS);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const goHome = (): void => {
  if (countdownTimer) clearInterval(countdownTimer);
  appStore.pendingQrBase64 = null;
  router.push('/');
};

const startCountdown = (): void => {
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      goHome();
    }
  }, 1000);
};

const uploadAndGenerateQr = async (): Promise<void> => {
  const base64 = appStore.pendingQrBase64;
  if (!base64) {
    status.value = 'error';
    return;
  }

  try {
    // Save the photo to the embedded server and get the download URL
    const result = await PhotoServer.savePhoto({ base64 });
    const downloadUrl = result.downloadUrl;

    if (!downloadUrl) {
      console.warn('PhotoServer returned no downloadUrl');
      status.value = 'error';
      return;
    }

    qrDataUrl.value = await QRCode.toDataURL(downloadUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    status.value = 'ready';
  } catch (err) {
    console.error('QR generation failed:', err);
    status.value = 'error';
  }
};

onMounted(async () => {
  await uploadAndGenerateQr();
  startCountdown();
});

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer);
  appStore.pendingQrBase64 = null;
});
</script>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

// Override #parent defaults to create a self-contained viewport layout.
// We use the .qr-page class so scoped styles win specificity over the
// global #parent rule without needing !important.
.qr-page.qr-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  min-height: 100vh;
  min-height: 100dvh; // accounts for mobile browser chrome
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

// --- Header ---
.qr-header {
  text-align: center;
  flex-shrink: 0;
  padding: 3vh 1rem 0;

  h1 {
    font-size: clamp(1.5rem, 5vmin, 3.5rem);
    line-height: 1.1;
    margin: 0;
    white-space: nowrap;
    letter-spacing: 0.05em;
  }
}

.success-icon {
  font-size: clamp(2rem, 6vmin, 3.5rem);
  color: #4caf50;
  line-height: 1;
  animation: popIn 0.4s ease-out;
}

.qr-subtitle {
  color: $border-color;
  font-size: clamp(0.75rem, 1.6vmin, 0.95rem);
  margin: 0;
}

// --- Card ---
.qr-card {
  flex: 0 1 auto;
  background: $white;
  border-radius: 16px;
  padding: clamp(0.75rem, 2vmin, 1.5rem) clamp(1rem, 3vw, 2rem);
  margin: 2vh 0;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  width: min(90%, 380px);
}

.qr-card-title {
  font-family: $font-primary;
  font-weight: 700;
  font-size: clamp(1rem, 2.2vmin, 1.35rem);
  color: $dark;
  margin: 0 0 2px;
}

.qr-card-subtitle {
  color: $border-color;
  font-size: clamp(0.68rem, 1.4vmin, 0.82rem);
  margin: 0 0 clamp(0.4rem, 1.2vmin, 0.8rem);
  line-height: 1.35;
}

.qr-image-wrapper {
  display: flex;
  justify-content: center;
}

.qr-image {
  // Size relative to the viewport so it always fits, capped at 220px
  width: clamp(120px, 28vmin, 220px);
  height: clamp(120px, 28vmin, 220px);
  border-radius: 8px;
  border: 3px solid $bg-color;
  display: block;
}

// --- Placeholder / Loading / Error ---
.qr-placeholder {
  padding: clamp(0.75rem, 2vmin, 1.5rem) 0;
  color: $border-color;

  .mdi {
    font-size: clamp(1.8rem, 4vmin, 3rem);
    display: block;
    margin-bottom: 0.4rem;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
  }
}

.qr-error .mdi {
  color: $primary-color;
}

.qr-error-hint {
  font-size: 0.75rem;
  margin-top: 4px;
  opacity: 0.7;
}

// --- Footer ---
.qr-footer {
  flex-shrink: 0;
  text-align: center;
  width: min(90%, 380px);
  padding: 0 0 3vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-done-btn {
  font-size: 22px;
  padding: 1rem 3rem;
  border-radius: 2rem;
}

.qr-auto-close {
  font-size: 0.75rem;
  color: $border-color;
  margin: 0;
  opacity: 0.6;
}

// --- Animation ---
@keyframes popIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  60% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
</style>
