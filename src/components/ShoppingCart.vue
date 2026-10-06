<script setup>
import { computed, ref, watch } from 'vue'
import {
  aggregateIngredients,
  createShoppingEntry,
  shoppingQuantity,
  shoppingListText,
  replaceWeekEntries
} from '../shopping'
import { formatAmount } from '../recipes'

const storageKey = 'matglede-shopping-v1'
const entries = ref([])
const checked = ref([])
const dialog = ref(false)
const notice = ref('')
const snackbar = ref(false)
const storageError = ref(false)
const remainingOnly = ref(true)
const copyFallback = ref(false)
const copyText = computed(() =>
  shoppingListText(items.value, checked.value, remainingOnly.value)
)
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
  if (saved && Array.isArray(saved.entries)) {
    entries.value = saved.entries.filter(
      (entry) =>
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        Number.isFinite(entry.servings) &&
        Array.isArray(entry.ingredients) &&
        entry.ingredients.every(
          (item) =>
            typeof item.name === 'string' &&
            Number.isFinite(item.grams) &&
            item.grams >= 0 &&
            (item.amount === null || Number.isFinite(item.amount)) &&
            (item.unit === null || typeof item.unit === 'string')
        )
    )
    checked.value = Array.isArray(saved.checked)
      ? saved.checked.filter((key) => typeof key === 'string')
      : []
  }
} catch {
  storageError.value = true
}
const items = computed(() => aggregateIngredients(entries.value))
const remaining = computed(
  () => items.value.filter((item) => !checked.value.includes(item.key)).length
)
watch(
  [entries, checked],
  () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ entries: entries.value, checked: checked.value })
      )
    } catch {
      storageError.value = true
    }
  },
  { deep: true }
)

async function copyList() {
  try {
    await navigator.clipboard.writeText(`Handleliste\n\n${copyText.value}`)
    notice.value = 'Handlelisten er kopiert'
    snackbar.value = true
    copyFallback.value = false
  } catch {
    copyFallback.value = true
  }
}
function updateWeek(planned) {
  const affected = new Set(
    aggregateIngredients(
      entries.value.filter((entry) => entry.source === 'week-menu')
    ).map((item) => item.key)
  )
  entries.value = replaceWeekEntries(entries.value, planned)
  for (const item of aggregateIngredients(
    entries.value.filter((entry) => entry.source === 'week-menu')
  ))
    affected.add(item.key)
  checked.value = checked.value.filter((key) => !affected.has(key))
  showCart()
}
function addRecipe(recipe, servings, addons) {
  const entry = createShoppingEntry(recipe, servings, addons)
  const changed = new Set(aggregateIngredients([entry]).map((item) => item.key))
  checked.value = checked.value.filter((key) => !changed.has(key))
  entries.value.push(entry)
  notice.value = `${recipe.name} lagt til i handlelisten`
  snackbar.value = true
}
function removeEntry(id) {
  const removed = entries.value.find((entry) => entry.id === id)
  if (removed) {
    const changed = new Set(
      aggregateIngredients([removed]).map((item) => item.key)
    )
    checked.value = checked.value.filter((key) => !changed.has(key))
  }
  entries.value = entries.value.filter((entry) => entry.id !== id)
}
function showCart() {
  dialog.value = true
  snackbar.value = false
}
function clearCart() {
  entries.value = []
  checked.value = []
}
defineExpose({ addRecipe, updateWeek })
</script>

<template>
  <v-btn
    color="primary"
    variant="tonal"
    rounded="pill"
    prepend-icon="mdi-basket-outline"
    @click="dialog = true"
    >Handleliste <span class="cart-count">{{ items.length }}</span></v-btn
  >
  <v-dialog v-model="dialog" max-width="720" scrollable>
    <v-card rounded="xl" class="detail-card">
      <div class="detail-toolbar">
        <span>HANDLELISTE · {{ remaining }} igjen</span
        ><v-btn
          icon="mdi-close"
          variant="text"
          aria-label="Lukk handleliste"
          @click="dialog = false"
        />
      </div>
      <v-card-text class="detail-body">
        <h2>Alt du trenger.</h2>
        <p v-if="storageError" class="nutrition-note">
          Handlelisten kan ikke lagres i denne nettleseren akkurat nå. Du kan
          fortsatt bruke den mens siden er åpen.
        </p>
        <div v-if="!entries.length" class="empty-state">
          <v-icon icon="mdi-basket-outline" size="44" />
          <h3>Handlelisten er tom</h3>
          <p>
            Åpne en oppskrift, velg porsjoner og trykk «Legg til i
            handlelisten».
          </p>
        </div>
        <template v-else>
          <div class="copy-actions">
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-content-copy"
              :disabled="!copyText"
              @click="copyList"
              >Kopier handlelisten</v-btn
            ><v-checkbox
              v-model="remainingOnly"
              label="Bare varer som gjenstår"
              hide-details
              density="compact"
            />
          </div>
          <template v-if="copyFallback"
            ><p class="nutrition-note" role="status">
              Automatisk kopiering er ikke tilgjengelig. Marker og kopier
              teksten nedenfor.
            </p>
            <v-textarea
              :model-value="`Handleliste\n\n${copyText}`"
              label="Handleliste som tekst"
              readonly
              auto-grow
              variant="outlined"
              @focus="$event.target.select()"
          /></template>
          <h3 class="cart-subheading">Valgte retter</h3>
          <ul class="cart-recipes">
            <li v-for="entry in entries" :key="entry.id">
              <div>
                <strong>{{ entry.name }}</strong
                ><span
                  >{{ entry.servings }}
                  {{ entry.servings === 1 ? 'porsjon' : 'porsjoner' }}</span
                >
              </div>
              <v-btn
                icon="mdi-delete-outline"
                variant="text"
                size="small"
                :aria-label="`Fjern ${entry.name} fra handlelisten`"
                @click="removeEntry(entry.id)"
              />
            </li>
          </ul>
          <h3 class="cart-subheading">Ingredienser · {{ items.length }}</h3>
          <p class="nutrition-note">
            Like ingredienser er summert. Ulike mål samles i gram når de ikke
            kan summeres direkte. Produktvarianter holdes separate.
          </p>
          <ul class="shopping-list">
            <li
              v-for="item in items"
              :key="item.key"
              :class="{ purchased: checked.includes(item.key) }"
            >
              <v-checkbox
                v-model="checked"
                :value="item.key"
                :label="item.name"
                hide-details
                density="compact"
                color="primary"
              />
              <div class="shopping-amount">
                <strong>{{ shoppingQuantity(item) }}</strong
                ><small v-if="item.unit !== 'g'"
                  >{{ formatAmount(item.grams) }} g</small
                >
              </div>
            </li>
          </ul>
          <v-btn
            class="mt-6"
            variant="outlined"
            prepend-icon="mdi-delete-outline"
            @click="clearCart"
            >Tøm handlelisten</v-btn
          >
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
  <v-snackbar v-model="snackbar" :timeout="3500" color="primary"
    >{{ notice
    }}<template #actions
      ><v-btn variant="text" @click="showCart">Vis liste</v-btn></template
    ></v-snackbar
  >
</template>
