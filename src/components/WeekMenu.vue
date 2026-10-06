<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ recipes: { type: Array, required: true } })
const emit = defineEmits(['update-cart', 'open-recipe'])
const days = [
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
  'Søndag'
]
const storageKey = 'kamilla-week-menu-v1'
const slots = ref(days.map(() => ({ recipeId: null, servings: 1 })))
const dialog = ref(false)
const storageError = ref(false)
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
  if (Array.isArray(saved) && saved.length === 7) {
    slots.value = saved.map((slot) => ({
      recipeId: Number.isInteger(slot?.recipeId) ? slot.recipeId : null,
      servings:
        Number.isInteger(slot?.servings) &&
        slot.servings >= 1 &&
        slot.servings <= 20
          ? slot.servings
          : 1
    }))
  }
} catch {
  storageError.value = true
}
watch(
  slots,
  (value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      storageError.value = true
    }
  },
  { deep: true }
)
const options = computed(() =>
  [...props.recipes]
    .sort((a, b) => a.name.localeCompare(b.name, 'nb-NO'))
    .map((recipe) => ({ title: recipe.name, value: recipe.id }))
)
const planned = computed(() =>
  slots.value.flatMap((slot) => {
    const recipe = props.recipes.find((recipe) => recipe.id === slot.recipeId)
    return recipe ? [{ recipe, servings: slot.servings }] : []
  })
)
function updateCart() {
  emit('update-cart', planned.value)
  dialog.value = false
}
function openRecipe(id) {
  const recipe = props.recipes.find((recipe) => recipe.id === id)
  if (recipe) {
    dialog.value = false
    emit('open-recipe', recipe)
  }
}
function clearWeek() {
  slots.value = days.map(() => ({ recipeId: null, servings: 1 }))
}
</script>

<template>
  <v-btn variant="text" prepend-icon="mdi-calendar-week" @click="dialog = true"
    >Ukesmeny
    <span v-if="planned.length" class="ml-2"
      >{{ planned.length }}/7</span
    ></v-btn
  >
  <v-dialog v-model="dialog" max-width="850" scrollable>
    <v-card rounded="xl" class="detail-card">
      <div class="detail-toolbar">
        <span>UKESMENY</span
        ><v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Lukk ukesmeny"
          @click="dialog = false"
        />
      </div>
      <v-card-text class="detail-body">
        <h2>Planlegg uken</h2>
        <p class="nutrition-note">
          Velg en rett og antall porsjoner per dag. Planen huskes i denne
          nettleseren til du endrer den.
        </p>
        <p v-if="storageError" class="nutrition-note" role="status">
          Ukesmenyen kan ikke lagres i nettleseren akkurat nå.
        </p>
        <div class="week-list">
          <div v-for="(day, index) in days" :key="day" class="week-row">
            <strong>{{ day }}</strong>
            <v-autocomplete
              v-model="slots[index].recipeId"
              :items="options"
              :label="`Rett for ${day.toLocaleLowerCase('nb-NO')}`"
              clearable
              hide-details
              variant="outlined"
              density="compact"
              no-data-text="Ingen oppskrifter funnet"
            />
            <div class="serving-control">
              <v-btn
                icon="mdi-minus"
                size="small"
                variant="text"
                :disabled="!slots[index].recipeId || slots[index].servings <= 1"
                :aria-label="`Færre porsjoner på ${day}`"
                @click="slots[index].servings--"
              /><span>{{ slots[index].servings }} porsj.</span
              ><v-btn
                icon="mdi-plus"
                size="small"
                variant="text"
                :disabled="
                  !slots[index].recipeId || slots[index].servings >= 20
                "
                :aria-label="`Flere porsjoner på ${day}`"
                @click="slots[index].servings++"
              />
            </div>
            <v-btn
              icon="mdi-open-in-new"
              size="small"
              variant="text"
              :disabled="!slots[index].recipeId"
              :aria-label="`Åpne oppskrift for ${day}`"
              @click="openRecipe(slots[index].recipeId)"
            />
          </div>
        </div>
        <p class="nutrition-note">
          Oppdatering erstatter rettene fra ukesmenyen i handlelisten. Retter du
          har lagt til enkeltvis beholdes. Proteintillegg er ikke inkludert.
        </p>
        <div class="week-actions">
          <v-btn
            color="primary"
            prepend-icon="mdi-basket-plus-outline"
            :disabled="!recipes.length"
            @click="updateCart"
            >Oppdater handlelisten</v-btn
          ><v-btn
            variant="text"
            :disabled="!slots.some((slot) => slot.recipeId)"
            @click="clearWeek"
            >Tøm ukesmenyen</v-btn
          >
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
