<template>
  <div id="parent" class="template-editor-page">
    <h1 class="whitespace-nowrap tracking-wider">Template Editor</h1>

    <!-- ===== ACCESS GATE ===== -->
    <template v-if="!entitlementStore.isValid('template_editor')">
      <div class="te-locked">
        <i class="mdi mdi-lock-outline te-lock-icon"></i>
        <h2>Template Editor Locked</h2>
        <p>A <strong>template_editor</strong> license is required to create and manage custom templates.</p>
        <p class="te-lock-subtext">Built-in templates are always available without a license.</p>
        <router-link :to="{ name: 'PremiumAccess', params: { target: 'template_editor' } }" class="pb-button p-5">
          <i class="mdi mdi-lock-open-outline"></i> Unlock Template Editor
        </router-link>
      </div>
    </template>

    <!-- ===== TEMPLATE LIST VIEW ===== -->
    <template v-else-if="!editForm">
      <div class="te-status">
        <span>Templates: {{ templateStore.allFrames.length }} / 8</span>
        <span>Active: {{ templateStore.activeIndices.length }} / 4</span>
      </div>

      <div class="te-grid">
        <div
          v-for="(frame, index) in templateStore.allFrames"
          :key="index"
          class="te-card"
          :class="{ active: templateStore.activeIndices.includes(index) }"
        >
          <div class="te-card-preview" :style="cardPreviewStyle(frame)">
            <div
              class="te-card-frame"
              :style="cardFrameStyle(frame)"
            ></div>
          </div>
          <div class="te-card-body">
            <h4>{{ frame.label }}</h4>
            <span class="te-card-meta">{{ frame.frameData.imageCount }} photos | {{ frame.variation.length }} variation{{ frame.variation.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="te-card-controls">
            <label class="te-toggle">
              <input
                type="checkbox"
                :checked="templateStore.activeIndices.includes(index)"
                @change="templateStore.toggleActive(index)"
                :disabled="!templateStore.activeIndices.includes(index) && !templateStore.canActivateMore"
              />
              <span>Active</span>
            </label>
            <button class="te-btn-icon" @click="startEdit(index)" title="Edit">
              <i class="mdi mdi-pencil"></i>
            </button>
            <button
              class="te-btn-icon te-btn-danger"
              @click="handleDelete(index)"
              :disabled="templateStore.allFrames.length <= 1"
              title="Delete"
            >
              <i class="mdi mdi-delete"></i>
            </button>
          </div>
        </div>
      </div>

      <button
        v-if="templateStore.canCreateMore"
        class="pb-button p-5 te-create-btn"
        @click="startCreate"
      >
        <i class="mdi mdi-plus-circle"></i> Create New Template
      </button>
      <p v-else class="te-limit-msg">Maximum 8 templates reached.</p>

      <router-link to="/setup" class="pb-button p-5 te-back-btn"><i class="mdi mdi-arrow-left"></i> Back to Setup</router-link>
    </template>

    <!-- ===== EDITOR VIEW ===== -->
    <template v-else>
      <div class="te-editor-layout">
        <!-- Preview Panel -->
        <div class="te-preview-panel">
          <h3>Preview</h3>
          <div
            class="te-preview-box"
            :style="{ width: previewWidth + 'px', height: previewHeight + 'px' }"
          >
            <!-- Frame outline -->
            <div class="te-prev-frame" :style="frameStyle"></div>
            <!-- Header -->
            <div
              v-if="currentVar"
              class="te-prev-header"
              :style="rectToStyle(currentVar.headerData)"
            >Header</div>
            <!-- Footer -->
            <div
              v-if="currentVar"
              class="te-prev-footer"
              :style="rectToStyle(currentVar.footerData)"
            >Footer</div>
            <!-- Image Slots -->
            <template v-if="currentVar">
              <div
                v-for="(img, idx) in currentVar.imagesData"
                :key="idx"
                class="te-prev-image"
                :style="rectToStyle(img)"
              >{{ idx + 1 }}</div>
            </template>
          </div>
          <div class="te-preview-legend">
            <span class="legend-header">Header</span>
            <span class="legend-footer">Footer</span>
            <span class="legend-image">Image</span>
          </div>
        </div>

        <!-- Form Panel -->
        <div class="te-form-panel">
          <h3>{{ editingIndex !== null ? 'Edit Template' : 'New Template' }}</h3>

          <!-- Basic Info -->
          <div class="te-section">
            <label class="te-label">Label</label>
            <input v-model="editForm.label" type="text" class="te-input te-input-full" placeholder="Template name" />
          </div>

          <!-- Base Data -->
          <div class="te-section">
            <h4>Base Data <span class="te-hint">(total print area)</span></h4>
            <div class="te-row">
              <div class="te-field">
                <label>Width</label>
                <input v-model.number="editForm.baseData.width" type="number" min="100" step="1" class="te-input" />
              </div>
              <div class="te-field">
                <label>Height</label>
                <input v-model.number="editForm.baseData.height" type="number" min="100" step="1" class="te-input" />
              </div>
            </div>
          </div>

          <!-- Frame Data -->
          <div class="te-section">
            <h4>Frame Data <span class="te-hint">(single copy area)</span></h4>
            <div class="te-row">
              <div class="te-field">
                <label>Width</label>
                <input v-model.number="editForm.frameData.width" type="number" min="1" step="1" class="te-input" />
              </div>
              <div class="te-field">
                <label>Height</label>
                <input v-model.number="editForm.frameData.height" type="number" min="1" step="1" class="te-input" />
              </div>
            </div>
            <div class="te-row">
              <div class="te-field">
                <label>Stroke</label>
                <input v-model.number="editForm.frameData.strokeSize" type="number" min="0" step="0.5" class="te-input" />
              </div>
              <div class="te-field">
                <label>Photos</label>
                <input v-model.number="editForm.frameData.imageCount" type="number" min="1" step="1" class="te-input" />
              </div>
            </div>
            <label class="te-checkbox">
              <input type="checkbox" v-model="editForm.frameData.rotate" />
              Rotate for print
            </label>
          </div>

          <!-- Variations -->
          <div class="te-section">
            <h4>Variations</h4>
            <div class="te-var-tabs">
              <button
                v-for="(_, vi) in editForm.variation"
                :key="vi"
                class="te-var-tab"
                :class="{ active: selectedVariation === vi }"
                @click="selectedVariation = vi"
              >V{{ vi + 1 }}</button>
              <button class="te-var-tab te-var-add" @click="addVariation">+</button>
              <button
                v-if="editForm.variation.length > 1"
                class="te-var-tab te-var-remove"
                @click="removeVariation(selectedVariation)"
              >-</button>
            </div>

            <template v-if="currentVar">
              <div class="te-row">
                <div class="te-field">
                  <label>Copy count</label>
                  <input v-model.number="currentVar.copy" type="number" min="1" step="1" class="te-input" />
                </div>
              </div>

              <!-- Header Rect -->
              <h5>Header Position</h5>
              <div class="te-rect-row">
                <div class="te-field"><label>X</label><input v-model.number="currentVar.headerData.x" type="number" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>Y</label><input v-model.number="currentVar.headerData.y" type="number" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>W</label><input v-model.number="currentVar.headerData.width" type="number" min="1" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>H</label><input v-model.number="currentVar.headerData.height" type="number" min="1" step="0.5" class="te-input" /></div>
              </div>

              <!-- Footer Rect -->
              <h5>Footer Position</h5>
              <div class="te-rect-row">
                <div class="te-field"><label>X</label><input v-model.number="currentVar.footerData.x" type="number" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>Y</label><input v-model.number="currentVar.footerData.y" type="number" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>W</label><input v-model.number="currentVar.footerData.width" type="number" min="1" step="0.5" class="te-input" /></div>
                <div class="te-field"><label>H</label><input v-model.number="currentVar.footerData.height" type="number" min="1" step="0.5" class="te-input" /></div>
              </div>

              <!-- Image Slots -->
              <h5>Image Slots</h5>
              <div
                v-for="(img, idx) in currentVar.imagesData"
                :key="idx"
                class="te-image-slot"
              >
                <div class="te-image-slot-header">
                  <span>Image {{ idx + 1 }}</span>
                  <button
                    v-if="currentVar.imagesData.length > 1"
                    class="te-btn-icon te-btn-danger te-btn-sm"
                    @click="removeImageSlot(idx)"
                  >
                    <i class="mdi mdi-close"></i>
                  </button>
                </div>
                <div class="te-rect-row">
                  <div class="te-field"><label>X</label><input v-model.number="img.x" type="number" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>Y</label><input v-model.number="img.y" type="number" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>W</label><input v-model.number="img.width" type="number" min="1" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>H</label><input v-model.number="img.height" type="number" min="1" step="0.5" class="te-input" /></div>
                </div>
              </div>
              <button class="te-add-slot-btn" @click="addImageSlot">+ Add Image Slot</button>
            </template>
          </div>

          <!-- Validation Errors -->
          <ul v-if="validationErrors.length" class="te-errors">
            <li v-for="err in validationErrors" :key="err">{{ err }}</li>
          </ul>

          <!-- Actions -->
          <div class="te-actions">
            <button class="pb-button p-5 te-cancel-btn" @click="cancelEdit">Cancel</button>
            <button class="pb-button p-5" @click="handleSave">Save Template</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTemplateStore } from '@/stores/templateStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import useTemplateEditor from '@/composables/useTemplateEditor';
import type { FrameTemplate } from '@/types';

const templateStore = useTemplateStore();
const entitlementStore = useEntitlementStore();

const {
  editingIndex,
  editForm,
  selectedVariation,
  validationErrors,
  previewScale,
  previewWidth,
  previewHeight,
  frameOffset,
  currentVar,
  startEdit,
  startCreate,
  cancelEdit,
  saveEdit,
  addVariation,
  removeVariation,
  addImageSlot,
  removeImageSlot,
  rectToStyle,
  frameStyle,
} = useTemplateEditor();

function cardPreviewStyle(frame: FrameTemplate): Record<string, string> {
  const maxW = 160;
  const maxH = 100;
  const s = Math.min(maxW / frame.baseData.width, maxH / frame.baseData.height, 1);
  return {
    width: frame.baseData.width * s + 'px',
    height: frame.baseData.height * s + 'px',
  };
}

function cardFrameStyle(frame: FrameTemplate): Record<string, string> {
  const maxW = 160;
  const maxH = 100;
  const s = Math.min(maxW / frame.baseData.width, maxH / frame.baseData.height, 1);
  const fd = frame.frameData;
  const bd = frame.baseData;
  return {
    left: (fd.strokeSize * s) / 2 + 'px',
    top: ((bd.height - fd.height) * s) / 2 + 'px',
    width: (fd.width - fd.strokeSize) * s + 'px',
    height: (fd.height - fd.strokeSize) * s + 'px',
  };
}

async function handleSave(): Promise<void> {
  await saveEdit();
}

async function handleDelete(index: number): Promise<void> {
  if (templateStore.allFrames.length <= 1) return;
  if (!confirm(`Delete "${templateStore.allFrames[index].label}"?`)) return;
  await templateStore.deleteTemplate(index);
}
</script>

<style lang="scss">
@use '@/assets/scss/frame-editor';
</style>

<style scoped lang="scss">
@use '@/assets/scss/variables' as *;

// ==================== LOCK SCREEN ====================
.te-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px 20px;
  text-align: center;
  color: $border-color;

  .te-lock-icon {
    font-size: 64px;
    color: #9ca3af;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    color: #374151;
  }

  p {
    font-size: 14px;
    max-width: 320px;
    color: #6b7280;
  }

  .te-lock-subtext {
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
  }
}

// ==================== STATUS BAR ====================
.te-status {
  display: flex;
  gap: 20px;
  justify-content: center;
  font-size: 13px;
  color: $border-color;
  margin-bottom: 10px;
}

// ==================== TEMPLATE GRID ====================
.te-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 15px;
  max-width: 960px;
  margin: 0 auto 20px;
  padding: 0 15px;
}

.te-card {
  background: $white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  transition: box-shadow 0.2s;

  &.active {
    box-shadow: 0 0 0 2px $secondary-color, 0 2px 8px rgba(0, 0, 0, 0.12);
  }
}

.te-card-preview {
  position: relative;
  background: #f5f5f5;
  margin: 12px auto 0;
  border: 1px solid #ddd;
}

.te-card-frame {
  position: absolute;
  border: 1px dashed #999;
  background: rgba(0, 0, 0, 0.04);
}

.te-card-body {
  padding: 8px 12px 4px;

  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.te-card-meta {
  font-size: 11px;
  color: $border-color;
}

.te-card-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 10px;
}

.te-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
  flex: 1;

  input {
    accent-color: $secondary-color;
  }

  input:disabled {
    cursor: not-allowed;
  }
}

.te-btn-icon {
  background: none;
  border: 1px solid $border-color;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  font-size: 16px;
  color: $dark;
  transition: background 0.15s;

  &:hover {
    background: #eee;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.te-btn-danger {
  color: $primary-color;
  border-color: $primary-color;

  &:hover:not(:disabled) {
    background: rgba($primary-color, 0.1);
  }
}

.te-btn-sm {
  padding: 1px 4px;
  font-size: 14px;
}

.te-create-btn {
  display: block;
  margin: 0 auto 10px;
}

.te-back-btn {
  display: inline-flex;
  margin: 0 auto;
  text-align: center;
  background: $secondary-color !important;
}

.te-limit-msg {
  text-align: center;
  color: $border-color;
  font-size: 13px;
  margin-bottom: 10px;
}

// ==================== EDITOR LAYOUT ====================
.te-editor-layout {
  display: flex;
  gap: 20px;
  max-width: 1000px;
  margin: 0 auto;
  align-items: flex-start;
  padding: 0 10px;
}

.te-preview-panel {
  flex-shrink: 0;
  position: sticky;
  top: 10px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
}

.te-preview-box {
  position: relative;
  background: $white;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}

.te-prev-frame {
  position: absolute;
  border: 1.5px dashed #666;
  background: rgba(0, 0, 0, 0.03);
}

.te-prev-header {
  position: absolute;
  background: rgba(66, 133, 244, 0.25);
  border: 1px dashed #4285f4;
  font-size: 9px;
  color: #4285f4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.te-prev-footer {
  position: absolute;
  background: rgba(52, 168, 83, 0.25);
  border: 1px dashed #34a853;
  font-size: 9px;
  color: #34a853;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}

.te-prev-image {
  position: absolute;
  background: rgba($primary-color, 0.2);
  border: 1px dashed $primary-color;
  font-size: 11px;
  font-weight: 700;
  color: $primary-color;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.te-preview-legend {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 10px;

  span {
    display: flex;
    align-items: center;
    gap: 3px;

    &::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
  }

  .legend-header::before {
    background: rgba(66, 133, 244, 0.4);
    border: 1px solid #4285f4;
  }

  .legend-footer::before {
    background: rgba(52, 168, 83, 0.4);
    border: 1px solid #34a853;
  }

  .legend-image::before {
    background: rgba($primary-color, 0.3);
    border: 1px solid $primary-color;
  }
}

// ==================== FORM PANEL ====================
.te-form-panel {
  flex: 1;
  max-height: 78vh;
  overflow-y: auto;
  padding-right: 6px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  h4 {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 6px;
  }

  h5 {
    font-size: 12px;
    font-weight: 600;
    margin: 8px 0 4px;
    color: #555;
  }
}

.te-hint {
  font-weight: 400;
  color: $border-color;
  font-size: 11px;
}

.te-section {
  background: $white;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  padding: 10px 12px;
  margin-bottom: 10px;
}

.te-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 3px;
}

.te-input {
  width: 100%;
  padding: 5px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: $secondary-color;
  }
}

.te-input-full {
  width: 100%;
}

.te-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}

.te-rect-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}

.te-field {
  label {
    display: block;
    font-size: 10px;
    color: $border-color;
    margin-bottom: 1px;
  }
}

.te-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-top: 4px;

  input {
    accent-color: $secondary-color;
  }
}

// ==================== VARIATIONS ====================
.te-var-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
}

.te-var-tab {
  padding: 4px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: $white;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;

  &.active {
    background: $secondary-color;
    color: $white;
    border-color: $secondary-color;
  }
}

.te-var-add {
  color: $secondary-color;
  border-color: $secondary-color;
}

.te-var-remove {
  color: $primary-color;
  border-color: $primary-color;
}

// ==================== IMAGE SLOTS ====================
.te-image-slot {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

.te-image-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;

  span {
    font-size: 12px;
    font-weight: 600;
    color: $primary-color;
  }
}

.te-add-slot-btn {
  width: 100%;
  padding: 5px;
  border: 1px dashed $secondary-color;
  border-radius: 4px;
  background: transparent;
  color: $secondary-color;
  font-size: 12px;
  cursor: pointer;
  margin-top: 4px;

  &:hover {
    background: rgba($secondary-color, 0.05);
  }
}

// ==================== ERRORS & ACTIONS ====================
.te-errors {
  background: rgba($primary-color, 0.08);
  border: 1px solid $primary-color;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 10px;
  list-style: none;

  li {
    font-size: 12px;
    color: $primary-color;
    padding: 2px 0;
  }
}

.te-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.te-cancel-btn {
  background: $border-color !important;
  
  &:hover {
    filter: brightness(1.15) !important;
    border-color: transparent !important;
  }
}
</style>
