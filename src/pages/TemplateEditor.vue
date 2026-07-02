<template>
  <div id="parent" class="template-editor-page" :class="{ 'te-is-dragging': dragState }">
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
          :key="frame.id"
          class="te-card"
          :class="{
            active: templateStore.activeIndices.includes(index),
            dragging: isDraggingTemplate(index),
            'drop-target': isTemplateDropTarget(index),
          }"
          :data-template-index="index"
          @pointerenter="handleTemplateDragEnter(index)"
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
            <button
              class="te-btn-icon te-drag-handle"
              type="button"
              title="Drag to reorder template"
              aria-label="Drag to reorder template"
              @pointerdown="startTemplateDrag($event, index)"
            >
              <i class="mdi mdi-drag-horizontal"></i>
            </button>
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
        @click="openCreateChooser"
      >
        <i class="mdi mdi-plus-circle"></i> Create New Template
      </button>
      <p v-else class="te-limit-msg">Maximum 8 templates reached.</p>

      <div
        v-if="createChooserMode"
        class="te-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create template"
        @click.self="closeCreateChooser"
      >
        <div class="te-create-dialog">
          <template v-if="createChooserMode === 'choice'">
            <h3>Create a Template</h3>
            <p class="te-create-intro">
              Start from a blank layout or use a default template as a friendly starting point.
            </p>
            <div class="te-create-options">
              <button class="te-create-option" @click="handleStartScratch">
                <i class="mdi mdi-shape-square-plus"></i>
                <span>Start from Scratch</span>
                <small>Use the current blank custom layout.</small>
              </button>
              <button class="te-create-option" @click="createChooserMode = 'starter'">
                <i class="mdi mdi-view-carousel-outline"></i>
                <span>Start from Default Template</span>
                <small>Clone a built-in layout, then customize it.</small>
              </button>
            </div>
            <button class="te-dialog-cancel" @click="closeCreateChooser">Cancel</button>
          </template>

          <template v-else>
            <div class="te-create-dialog-head">
              <div>
                <h3>Choose a Starter</h3>
                <p class="te-create-intro">The selected default will become a new custom template.</p>
              </div>
              <button class="te-dialog-cancel" @click="createChooserMode = 'choice'">Back</button>
            </div>
            <div class="te-starter-grid">
              <button
                v-for="frame in builtInStarterTemplates"
                :key="frame.id"
                class="te-starter-card"
                @click="handleStartFromStarter(frame)"
              >
                <div class="te-starter-preview">
                  <img v-if="frame.imgSrc" :src="frame.imgSrc" :alt="`${frame.label} preview`" />
                  <div v-else class="te-starter-fallback" :style="cardPreviewStyle(frame)">
                    <div class="te-card-frame" :style="cardFrameStyle(frame)"></div>
                  </div>
                </div>
                <strong>{{ frame.label }}</strong>
                <small>{{ frame.frameData.imageCount }} photos | {{ frame.variation.length }} variation{{ frame.variation.length > 1 ? 's' : '' }}</small>
              </button>
            </div>
            <button class="te-dialog-cancel te-dialog-bottom-cancel" @click="closeCreateChooser">Cancel</button>
          </template>
        </div>
      </div>

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
              v-if="currentVar && editForm.headerEnabled !== false"
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
            <span v-if="editForm.headerEnabled !== false" class="legend-header">Header</span>
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
                <input
                  v-model.number="editForm.frameData.imageCount"
                  type="number"
                  min="1"
                  step="1"
                  class="te-input"
                />
              </div>
            </div>
            <p class="te-inline-hint">Total photos can include copies. Each variation can use up to {{ MAX_TEMPLATE_IMAGES }} image slots.</p>
            <label class="te-checkbox">
              <input type="checkbox" v-model="editForm.frameData.rotate" />
              Rotate for print
            </label>
            <label class="te-checkbox">
              <input type="checkbox" v-model="editForm.headerEnabled" />
              Show header on this template
            </label>
            <p v-if="editForm.headerEnabled === false" class="te-inline-hint">
              Header position is kept, but the header will not appear in previews or output.
            </p>
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
              <template v-if="editForm.headerEnabled !== false">
                <h5>Header Position</h5>
                <div class="te-rect-row">
                  <div class="te-field"><label>X</label><input v-model.number="currentVar.headerData.x" type="number" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>Y</label><input v-model.number="currentVar.headerData.y" type="number" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>W</label><input v-model.number="currentVar.headerData.width" type="number" min="1" step="0.5" class="te-input" /></div>
                  <div class="te-field"><label>H</label><input v-model.number="currentVar.headerData.height" type="number" min="1" step="0.5" class="te-input" /></div>
                </div>
              </template>

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
              <p class="te-inline-hint">
                {{ currentVar.imagesData.length }} / {{ MAX_TEMPLATE_IMAGES }} image slots used.
              </p>
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
              <button
                v-if="currentVar.imagesData.length < MAX_TEMPLATE_IMAGES"
                class="te-add-slot-btn"
                @click="addImageSlot"
              >
                + Add Image Slot
              </button>
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
import { computed, onBeforeUnmount, ref } from 'vue';
import { useTemplateStore } from '@/stores/templateStore';
import { useEntitlementStore } from '@/stores/entitlementStore';
import { useAppStore } from '@/stores/appStore';
import { useDesignStore } from '@/stores/designStore';
import useTemplateEditor, { MAX_TEMPLATE_IMAGES } from '@/composables/useTemplateEditor';
import type { FrameTemplate } from '@/types';

const templateStore = useTemplateStore();
const entitlementStore = useEntitlementStore();
const appStore = useAppStore();
const designStore = useDesignStore();

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
  startCreateFromTemplate,
  cancelEdit,
  saveEdit,
  addVariation,
  removeVariation,
  addImageSlot,
  removeImageSlot,
  rectToStyle,
  frameStyle,
} = useTemplateEditor();

const createChooserMode = ref<'choice' | 'starter' | null>(null);
const dragState = ref<{ fromIndex: number; targetIndex: number; pointerId: number } | null>(null);
const builtInStarterTemplates = computed(() =>
  templateStore.allFrames.filter((frame) => frame.source === 'builtin')
);

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

function openCreateChooser(): void {
  if (!templateStore.canCreateMore) return;
  createChooserMode.value = 'choice';
}

function closeCreateChooser(): void {
  createChooserMode.value = null;
}

function handleStartScratch(): void {
  startCreate();
  closeCreateChooser();
}

function handleStartFromStarter(frame: FrameTemplate): void {
  startCreateFromTemplate(frame);
  closeCreateChooser();
}

function remapIndexAfterMove(index: number, fromIndex: number, toIndex: number): number {
  if (index === fromIndex) return toIndex;
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1;
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1;
  return index;
}

function isDraggingTemplate(index: number): boolean {
  return dragState.value?.fromIndex === index;
}

function isTemplateDropTarget(index: number): boolean {
  return dragState.value !== null && dragState.value.fromIndex !== index && dragState.value.targetIndex === index;
}

function startTemplateDrag(event: PointerEvent, index: number): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (templateStore.allFrames.length <= 1) return;

  event.preventDefault();
  event.stopPropagation();

  dragState.value = {
    fromIndex: index,
    targetIndex: index,
    pointerId: event.pointerId,
  };

  window.addEventListener('pointermove', handleTemplateDragMove);
  window.addEventListener('pointerup', handleTemplateDragEnd);
  window.addEventListener('pointercancel', cancelTemplateDrag);
}

function handleTemplateDragEnter(index: number): void {
  if (!dragState.value) return;
  dragState.value = { ...dragState.value, targetIndex: index };
}

function handleTemplateDragMove(event: PointerEvent): void {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;

  event.preventDefault();
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const card = element instanceof Element
    ? element.closest<HTMLElement>('[data-template-index]')
    : null;
  const targetIndex = Number(card?.dataset.templateIndex);

  if (Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < templateStore.allFrames.length) {
    dragState.value = { ...dragState.value, targetIndex };
  }
}

function handleTemplateDragEnd(event: PointerEvent): void {
  void finishTemplateDrag(event);
}

async function finishTemplateDrag(event: PointerEvent): Promise<void> {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;
  event.preventDefault();

  const { fromIndex, targetIndex } = dragState.value;
  cleanupTemplateDrag();

  if (fromIndex === targetIndex) return;
  await persistTemplateMove(fromIndex, targetIndex);
}

function cancelTemplateDrag(): void {
  cleanupTemplateDrag();
}

function cleanupTemplateDrag(): void {
  dragState.value = null;
  window.removeEventListener('pointermove', handleTemplateDragMove);
  window.removeEventListener('pointerup', handleTemplateDragEnd);
  window.removeEventListener('pointercancel', cancelTemplateDrag);
}

async function persistTemplateMove(fromIndex: number, toIndex: number): Promise<void> {
  const selectedTemplateIndex = appStore.selectedTemplate?.id ?? null;
  const currentSetupIndex = designStore.currentTemplateIndex;

  const moved = await templateStore.moveTemplate(fromIndex, toIndex);
  if (!moved) return;

  if (selectedTemplateIndex !== null) {
    const remappedSelectedIndex = remapIndexAfterMove(selectedTemplateIndex, fromIndex, toIndex);
    const selectedFrame = templateStore.allFrames[remappedSelectedIndex];
    if (selectedFrame) {
      appStore.setTemplate(remappedSelectedIndex, selectedFrame.frameData.imageCount);
    }
  }

  designStore.currentTemplateIndex = remapIndexAfterMove(currentSetupIndex, fromIndex, toIndex);
}

onBeforeUnmount(cleanupTemplateDrag);
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
  transition: box-shadow 0.2s, opacity 0.2s, transform 0.2s;

  &.active {
    box-shadow: 0 0 0 2px $secondary-color, 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  &.dragging {
    opacity: 0.55;
    transform: scale(0.98);
  }

  &.drop-target {
    box-shadow: 0 0 0 2px $primary-color, 0 8px 18px rgba($primary-color, 0.2);
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

.te-drag-handle {
  color: $secondary-color;
  border-color: rgba($secondary-color, 0.45);
  background: rgba($secondary-color, 0.08);
  cursor: grab;
  touch-action: none;

  &:hover {
    background: rgba($secondary-color, 0.14);
  }

  &:active {
    cursor: grabbing;
  }
}

.te-is-dragging {
  cursor: grabbing;
  user-select: none;
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

.te-create-modal {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(26, 26, 26, 0.45);
}

.te-create-dialog {
  width: min(720px, 92vw);
  max-height: 86vh;
  overflow-y: auto;
  background: $bg-color;
  border: 2px solid $white;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  padding: 20px;
  color: $text-color;

  h3 {
    margin: 0 0 6px;
    color: $primary-color;
    font-size: 20px;
    font-weight: 800;
  }
}

.te-create-intro {
  margin: 0 0 16px;
  color: $border-color;
  font-size: 13px;
}

.te-create-options,
.te-starter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
}

.te-create-option,
.te-starter-card {
  width: 100%;
  background: $white;
  border: 1px solid rgba($secondary-color, 0.25);
  border-radius: 10px;
  color: $dark;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

  &:hover {
    transform: translateY(-2px);
    border-color: $secondary-color;
    box-shadow: 0 8px 18px rgba(14, 173, 185, 0.18);
    filter: none;
  }

  span,
  strong,
  small {
    display: block;
  }

  small {
    color: $border-color;
    font-size: 11px;
    font-weight: 500;
  }
}

.te-create-option {
  padding: 16px;

  i {
    display: block;
    margin-bottom: 8px;
    color: $secondary-color;
    font-size: 28px;
  }

  span {
    margin-bottom: 4px;
    font-size: 15px;
    font-weight: 800;
  }
}

.te-dialog-cancel {
  margin-top: 14px;
  background: transparent;
  border: 1px solid $border-color;
  color: $border-color;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    filter: none;
  }
}

.te-create-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  .te-dialog-cancel {
    flex-shrink: 0;
    margin-top: 0;
  }
}

.te-dialog-bottom-cancel {
  display: block;
  margin-left: auto;
}

.te-starter-card {
  padding: 12px;
  text-align: center;

  strong {
    margin-top: 8px;
    font-size: 13px;
  }
}

.te-starter-preview {
  min-height: 145px;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 100%;
    max-height: 145px;
    object-fit: contain;
    filter: drop-shadow(2px 3px 4px rgba(0, 0, 0, 0.25));
  }
}

.te-starter-fallback {
  position: relative;
  background: #f5f5f5;
  border: 1px solid #ddd;
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

.te-inline-hint {
  margin: 2px 0 6px;
  color: $border-color;
  font-size: 11px;
  line-height: 1.4;
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
  color: $dark;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;

  &:hover {
    filter: none;
    background: rgba($secondary-color, 0.08);
  }

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

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: transparent;
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
