<script setup>
import { computed, ref, watch, onUnmounted, toRaw } from 'vue'
import { saveRecipe } from '../api'
import { ingredientMeasure, mealTypeOptions } from '../recipes'
const props = defineProps({
  modelValue: Boolean,
  duplicate: Boolean,
  recipe: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])
const draft = ref(null)
const busy = ref(false)
const error = ref('')
const file = ref(null)
const removeImage = ref(false)
const preview = ref('')
const form = ref(null)
const modes = mealTypeOptions.filter((option) => option.value !== null)
const nutrientLabels = {
  calories: 'Kalorier (kcal)',
  protein: 'Protein (g)',
  carbs: 'Karbohydrat (g)',
  fat: 'Fett (g)',
  fibre: 'Fiber (g)'
}
const required = (value) => !!String(value ?? '').trim() || 'Fyll ut feltet'
const nonnegative = (value) =>
  (value !== '' &&
    value !== null &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0) ||
  'Oppgi et tall på minst 0'
const portionsRule = (value) =>
  (Number.isInteger(Number(value)) &&
    Number(value) >= 1 &&
    Number(value) <= 100) ||
  'Velg 1–100 porsjoner'
const ingredient = () => ({ name: '', amount: 0, unit: 'g', grams: 0 })
const imagePreview = computed(
  () => preview.value || (removeImage.value ? null : props.recipe?.image)
)
function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
}
watch(file, (value) => {
  clearPreview()
  const upload = Array.isArray(value) ? value[0] : value
  if (upload) preview.value = URL.createObjectURL(upload)
})
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    clearPreview()
    draft.value = props.recipe
      ? structuredClone(toRaw(props.recipe))
      : {
          name: '',
          portions: 1,
          duration_minutes: null,
          meal_types: [2],
          rating: null,
          protein_powder: false,
          heatable: null,
          must_be_heated: false,
          category_icon: null,
          ingredients: [ingredient()],
          protein_addons: [],
          steps: [''],
          nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
        }
    for (const field of ['ingredients', 'protein_addons'])
      draft.value[field] = draft.value[field].map((item) => ({
        ...item,
        ...ingredientMeasure(item)
      }))
    if (props.duplicate) {
      delete draft.value.id
      delete draft.value.version
      draft.value.name = `${draft.value.name} (kopi)`
    }
    file.value = null
    removeImage.value = false
    error.value = ''
  }
)
onUnmounted(clearPreview)
async function save() {
  if (!(await form.value.validate()).valid) return
  busy.value = true
  error.value = ''
  try {
    const payload = structuredClone(toRaw(draft.value))
    payload.portions = Number(payload.portions)
    payload.duration_minutes =
      payload.duration_minutes == null || payload.duration_minutes === ''
        ? null
        : Number(payload.duration_minutes)
    payload.steps = payload.steps.map((step) => step.trim()).filter(Boolean)
    for (const field of ['ingredients', 'protein_addons'])
      payload[field] = payload[field].map((item) => ({
        name: item.name.trim(),
        amount: Number(item.amount),
        unit: 'g',
        grams: Number(item.amount)
      }))
    for (const key of Object.keys(nutrientLabels))
      payload.nutrients[key] = Number(payload.nutrients[key])
    const upload = Array.isArray(file.value) ? file.value[0] : file.value
    if (
      upload &&
      (!['image/jpeg', 'image/png', 'image/webp'].includes(upload.type) ||
        upload.size > 6 * 1024 * 1024)
    )
      throw new Error('Velg et JPEG-, PNG- eller WebP-bilde under 6 MB.')
    const saved = await saveRecipe(
      payload,
      upload,
      removeImage.value,
      props.duplicate ? props.recipe.id : null
    )
    emit('saved', saved)
    emit('update:modelValue', false)
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    scrollable
    :persistent="busy"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="draft" rounded="xl" class="detail-card">
      <div class="detail-toolbar">
        <span>{{
          duplicate
            ? 'DUPLISER OPPSKRIFT'
            : recipe
              ? 'REDIGER OPPSKRIFT'
              : 'NY OPPSKRIFT'
        }}</span>
        ><v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Lukk redigering"
          :disabled="busy"
          @click="emit('update:modelValue', false)"
        />
      </div>
      <v-card-text class="detail-body">
        <p v-if="duplicate" class="nutrition-note">
          Kopien får eget navn og bilde. Originalen beholdes uendret. Trykk
          Lagre oppskrift når kopien er klar.
        </p>
        <v-form ref="form" @submit.prevent="save">
          <fieldset class="editor-fields" :disabled="busy">
            <v-text-field
              v-model="draft.name"
              label="Navn"
              variant="outlined"
              :rules="[required]"
            />
            <div class="editor-columns">
              <v-text-field
                v-model="draft.portions"
                label="Porsjoner"
                type="number"
                min="1"
                max="100"
                variant="outlined"
                :rules="[portionsRule]"
              /><v-select
                v-model="draft.meal_types"
                :items="modes"
                label="Måltider"
                multiple
                variant="outlined"
              />
            </div>
            <v-text-field
              v-model="draft.duration_minutes"
              label="Total tid (minutter)"
              hint="Inkluder steking og ventetid. Brukes i Fort gjort (maks 20 minutter)."
              persistent-hint
              type="number"
              min="1"
              max="10080"
              step="1"
              variant="outlined"
              :rules="[
                (value) =>
                  value == null ||
                  value === '' ||
                  (Number.isInteger(Number(value)) &&
                    Number(value) >= 1 &&
                    Number(value) <= 10080) ||
                  'Oppgi 1?10080 minutter'
              ]"
            />
            <img
              v-if="imagePreview"
              :src="imagePreview"
              alt="Forhåndsvisning"
              class="editor-image"
            />
            <v-file-input
              v-model="file"
              label="Oppskriftsbilde"
              accept="image/jpeg,image/png,image/webp"
              variant="outlined"
              show-size
              hint="JPEG, PNG eller WebP, maks 6 MB"
              persistent-hint
            />
            <v-checkbox
              v-if="recipe?.image || recipe?.has_uploaded_image"
              v-model="removeImage"
              label="Fjern nåværende bilde"
              hide-details
            />
            <template
              v-for="section in [
                { key: 'ingredients', title: 'Ingredienser' },
                { key: 'protein_addons', title: 'Valgfrie proteintillegg' }
              ]"
              :key="section.key"
            >
              <h3 class="cart-subheading">{{ section.title }}</h3>
              <div
                v-for="(item, index) in draft[section.key]"
                :key="index"
                class="editor-ingredient"
              >
                <v-text-field
                  v-model="item.name"
                  label="Ingrediens"
                  variant="outlined"
                  density="compact"
                  :rules="[required]"
                />
                <v-text-field
                  v-model="item.amount"
                  label="Mengde (g)"
                  type="number"
                  min="0"
                  step="any"
                  variant="outlined"
                  density="compact"
                  :rules="[nonnegative]"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  :disabled="
                    section.key === 'ingredients' &&
                    draft.ingredients.length === 1
                  "
                  :aria-label="`Fjern ingrediens ${index + 1}`"
                  @click="draft[section.key].splice(index, 1)"
                />
              </div>
              <v-btn
                variant="text"
                prepend-icon="mdi-plus"
                @click="draft[section.key].push(ingredient())"
                >Legg til ingrediens</v-btn
              >
            </template>
            <h3 class="cart-subheading">Fremgangsmåte</h3>
            <div
              v-for="(_, index) in draft.steps"
              :key="index"
              class="editor-step"
            >
              <v-textarea
                v-model="draft.steps[index]"
                :label="`Steg ${index + 1}`"
                auto-grow
                rows="2"
                variant="outlined"
              /><v-btn
                icon="mdi-delete-outline"
                variant="text"
                :aria-label="`Fjern steg ${index + 1}`"
                @click="draft.steps.splice(index, 1)"
              />
            </div>
            <v-btn
              variant="text"
              prepend-icon="mdi-plus"
              @click="draft.steps.push('')"
              >Legg til steg</v-btn
            >
            <h3 class="cart-subheading">Næringsinnhold</h3>
            <div class="editor-nutrients">
              <v-text-field
                v-for="(label, key) in nutrientLabels"
                :key="key"
                v-model="draft.nutrients[key]"
                :label="label"
                type="number"
                min="0"
                step="any"
                variant="outlined"
                :rules="[nonnegative]"
              />
            </div>
          </fieldset>
          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="mb-4"
            role="alert"
            >{{ error }}</v-alert
          >
          <v-btn
            type="submit"
            color="primary"
            :loading="busy"
            :disabled="busy"
            prepend-icon="mdi-content-save-outline"
            >Lagre oppskrift</v-btn
          >
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
