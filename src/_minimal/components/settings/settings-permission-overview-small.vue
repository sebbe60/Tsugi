<template>
  <div v-if="perm && supportsPermissions && !perm.hasRequiredPermissions()" class="error-section">
    <FormButton color="primary" padding="mini" :disabled="requesting" @click="requestAccess">
      {{ lang('Add') }}
    </FormButton>
    <div class="text">
      {{ lang('settings_custom_domains_missing_permissions_header') }}
      <p v-if="requestMessage" role="status">{{ requestMessage }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, Ref } from 'vue';
import FormButton from '../form/form-button.vue';

import { PermissionsHandler } from '../../../utils/permissions';
import { sessionSupportsPermissions } from '../../../utils/customDomains';

const supportsPermissions = sessionSupportsPermissions();
const mode = $('html').attr('mode');

const perm: Ref<null | PermissionsHandler> = ref(null);
let disposed = false;
const requesting = ref(false);
const requestMessage = ref('');
async function refreshPermissions() {
  if (!supportsPermissions || mode === 'install') return;
  const handler = await new PermissionsHandler().init();
  if (!disposed) perm.value = handler;
}
async function requestAccess() {
  if (!perm.value || requesting.value) return;
  requesting.value = true;
  requestMessage.value = '';
  try {
    const granted = await perm.value.requestPermissions();
    if (!granted) requestMessage.value = 'Website access was not granted. Click Add to try again.';
    await refreshPermissions();
  } catch (error) {
    con.error('Website access request failed', error);
    requestMessage.value = `Firefox could not grant access: ${error instanceof Error ? error.message : String(error)}. You can also check Tsugi’s Permissions in Firefox’s Add-ons Manager.`;
  } finally {
    requesting.value = false;
  }
}

onMounted(() => {
  refreshPermissions();
  if (supportsPermissions) {
    chrome.permissions.onAdded.addListener(refreshPermissions);
    chrome.permissions.onRemoved.addListener(refreshPermissions);
  }
});
onUnmounted(() => {
  disposed = true;
  if (supportsPermissions) {
    chrome.permissions.onAdded.removeListener(refreshPermissions);
    chrome.permissions.onRemoved.removeListener(refreshPermissions);
  }
});
</script>

<style lang="less" scoped>
.error-section {
  background-color: var(--cl-state-4);
  position: sticky;
  bottom: 0;
  padding: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  .text {
    color: white;
    p {
      margin: 5px 0 0;
      font-size: 13px;
    }
  }
}
</style>
