<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { filterRecipes, ingredientQuantity, mealTypeOptions } from './recipes'
import ShoppingCart from './components/ShoppingCart.vue'
import WeekMenu from './components/WeekMenu.vue'
import RecipeEditor from './components/RecipeEditor.vue'
import { apiRequest } from './api'
defineEmits(['logout'])
const cart = ref(null)
const selectedAddons = ref([])
const recipes = ref([])
const editorOpen = ref(false)
const editTarget = ref(null)
const duplicating = ref(false)
const deleteTarget = ref(null)
const deleteOpen = ref(false)
const deleting = ref(false)
const managementError = ref('')
const message = ref('')
const messageOpen = ref(false)
function requestDelete() {
  if (!selected.value) return
  deleteTarget.value = selected.value
  managementError.value = ''
  deleteOpen.value = true
}
function openEditor(recipe = null, duplicate = false) {
  duplicating.value = duplicate
  editTarget.value = recipe
  dialog.value = false
  editorOpen.value = true
}
function recipeSaved(recipe) {
  const index = recipes.value.findIndex((item) => item.id === recipe.id)
  if (index >= 0) recipes.value[index] = recipe
  else recipes.value.push(recipe)
  failedImages.value = new Set(
    [...failedImages.value].filter((id) => id !== recipe.id)
  )
  selected.value = recipe
  message.value = 'Oppskriften er lagret'
  messageOpen.value = true
}
async function deleteRecipe() {
  if (!deleteOpen.value || !deleteTarget.value || deleting.value) return
  const target = deleteTarget.value
  deleting.value = true
  managementError.value = ''
  try {
    await apiRequest(`/recipes/${target.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: target.version })
    })
    recipes.value = recipes.value.filter((recipe) => recipe.id !== target.id)
    favorites.value = favorites.value.filter((id) => id !== target.id)
    deleteOpen.value = false
    dialog.value = false
    message.value = 'Oppskriften er slettet'
    messageOpen.value = true
  } catch (failure) {
    managementError.value = failure.message
  } finally {
    deleting.value = false
  }
}
const loading = ref(true)
const error = ref(false)
const search = ref('')
const proteinOnly = ref(false)
const mealType = ref(null)
const favoritesOnly = ref(false)
const favorites = ref([])
const favoritesStorageError = ref(false)
const favoritesKey = 'kamilla-favorites-v1'
try {
  const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
  if (Array.isArray(saved))
    favorites.value = [...new Set(saved.filter(Number.isInteger))]
} catch {
  favoritesStorageError.value = true
}
watch(favorites, (ids) => {
  try {
    localStorage.setItem(favoritesKey, JSON.stringify(ids))
  } catch {
    favoritesStorageError.value = true
  }
})
function toggleFavorite(id) {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((savedId) => savedId !== id)
    : [...favorites.value, id]
}
const sort = ref('original')
const selected = ref(null)
const servings = ref(1)
const dialog = ref(false)
const failedImages = ref(new Set())
const sortOptions = [
  { title: 'Original rekkefølge', value: 'original' },
  { title: 'Navn A–Å', value: 'name' },
  { title: 'Mest protein', value: 'protein' },
  { title: 'Færrest kalorier', value: 'calories' }
]
const visibleRecipes = computed(() =>
  filterRecipes(
    recipes.value,
    search.value,
    proteinOnly.value,
    sort.value,
    mealType.value
  ).filter(
    (recipe) => !favoritesOnly.value || favorites.value.includes(recipe.id)
  )
)
async function loadRecipes() {
  loading.value = true
  error.value = false
  try {
    const data = await apiRequest('/recipes')
    if (!Array.isArray(data)) throw new Error('Invalid recipe data')
    recipes.value = data
    if (selected.value)
      selected.value =
        data.find((recipe) => recipe.id === selected.value.id) || null
  } catch (failure) {
    managementError.value = failure.message
    error.value = true
  } finally {
    loading.value = false
  }
}
function openRecipe(recipe) {
  selectedAddons.value = []
  selected.value = recipe
  servings.value = recipe.portions
  dialog.value = true
}
function resetFilters() {
  search.value = ''
  proteinOnly.value = false
  mealType.value = null
  favoritesOnly.value = false
  sort.value = 'original'
}
function imageFailed(id) {
  failedImages.value = new Set([...failedImages.value, id])
}
function quantity(ingredient) {
  return ingredientQuantity(ingredient, servings.value, selected.value.portions)
}
onMounted(loadRecipes)
</script>

<template>
  <v-app
    ><v-main>
      <header class="site-header">
        <a class="brand" href="./" aria-label="Kamillas oppskrifter – forsiden"
          ><span class="brand-icon"
            ><v-icon icon="mdi-silverware-fork-knife" size="22" /></span
          ><span class="brand-name"
            >Kamillas<span class="brand-subtitle">oppskriftsbok</span></span
          ></a
        >
        <div class="header-actions">
          <ShoppingCart ref="cart" /><v-btn
            icon="mdi-logout"
            variant="text"
            size="small"
            aria-label="Logg ut"
            title="Logg ut"
            @click="$emit('logout')"
          />
        </div>
      </header>
      <main class="page">
        <div class="planning-toolbar">
          <v-btn
            icon="mdi-refresh"
            variant="text"
            size="small"
            :disabled="loading"
            aria-label="Last oppskriftene på nytt"
            title="Last oppskriftene på nytt"
            @click="loadRecipes"
          />
          <v-btn
            variant="text"
            prepend-icon="mdi-plus"
            :disabled="loading || error"
            @click="openEditor()"
            >Ny oppskrift</v-btn
          >
          <WeekMenu
            :recipes="recipes"
            @update-cart="cart.updateWeek($event)"
            @open-recipe="openRecipe"
          />
        </div>
        <section class="search-panel" aria-label="Søk og filtrer oppskrifter">
          <v-text-field
            v-model="search"
            class="recipe-search"
            label="Søk etter en rett eller ingrediens"
            placeholder="Prøv kylling, pasta eller cottage cheese …"
            prepend-inner-icon="mdi-magnify"
            variant="solo"
            flat
            rounded="lg"
            hide-details
            clearable
          />
          <div class="filter-row">
            <div class="filter-buttons">
              <v-btn
                :variant="
                  proteinOnly || favoritesOnly || mealType !== null
                    ? 'outlined'
                    : 'flat'
                "
                :color="
                  proteinOnly || favoritesOnly || mealType !== null
                    ? undefined
                    : 'primary'
                "
                rounded="pill"
                @click="resetFilters"
                >Alle oppskrifter</v-btn
              ><v-btn
                :variant="proteinOnly ? 'flat' : 'outlined'"
                :color="proteinOnly ? 'primary' : undefined"
                :aria-pressed="proteinOnly"
                prepend-icon="mdi-arm-flex-outline"
                rounded="pill"
                @click="proteinOnly = !proteinOnly"
                >30 g+ protein</v-btn
              >
              <v-btn
                :variant="favoritesOnly ? 'flat' : 'outlined'"
                :color="favoritesOnly ? 'primary' : undefined"
                :aria-pressed="favoritesOnly"
                prepend-icon="mdi-heart-outline"
                rounded="pill"
                @click="favoritesOnly = !favoritesOnly"
                >Favoritter</v-btn
              >
            </div>
            <div class="filter-selects">
              <v-select
                v-model="mealType"
                :items="mealTypeOptions"
                label="Måltid"
                variant="outlined"
                density="compact"
                hide-details
                class="meal-select"
                rounded="lg"
              />
              <v-select
                v-model="sort"
                :items="sortOptions"
                label="Sorter etter"
                variant="outlined"
                density="compact"
                hide-details
                class="sort-select"
                rounded="lg"
              />
            </div>
          </div>
        </section>
        <p v-if="favoritesStorageError" class="nutrition-note" role="status">
          Favorittene kan ikke lagres i denne nettleseren akkurat nå.
        </p>
        <section
          class="collection"
          aria-label="Oppskrifter"
          :aria-busy="loading"
        >
          <div class="collection-heading">
            <h2>
              {{
                favoritesOnly
                  ? 'Mine favoritter'
                  : search || proteinOnly
                    ? 'Dine treff'
                    : 'Oppskriftene mine'
              }}
            </h2>
            <span aria-live="polite">{{
              loading ? 'Laster …' : `${visibleRecipes.length} oppskrifter`
            }}</span>
          </div>
          <div v-if="loading" class="recipe-grid">
            <v-skeleton-loader
              v-for="n in 6"
              :key="n"
              type="image, article"
              class="recipe-card"
            />
          </div>
          <div v-else-if="error" class="empty-state">
            <v-icon icon="mdi-cloud-alert-outline" size="44" />
            <h3>Oppskriftene kunne ikke lastes</h3>
            <p>{{ managementError || 'Prøv igjen om et øyeblikk.' }}</p>
            <v-btn color="primary" @click="loadRecipes">Prøv igjen</v-btn>
          </div>
          <div v-else-if="!visibleRecipes.length" class="empty-state">
            <v-icon icon="mdi-magnify" size="44" />
            <h3>Ingen oppskrifter funnet</h3>
            <p>
              {{
                favoritesOnly && !favorites.length
                  ? 'Trykk på hjertet ved en oppskrift for å lagre en favoritt.'
                  : 'Prøv et annet søkeord, eller fjern filtrene.'
              }}
            </p>
            <v-btn color="primary" @click="resetFilters"
              >Vis alle oppskrifter</v-btn
            >
          </div>
          <div v-else class="recipe-grid">
            <article
              v-for="recipe in visibleRecipes"
              :key="recipe.id"
              class="recipe-item"
            >
              <button class="recipe-card" @click="openRecipe(recipe)">
                <div class="card-image">
                  <img
                    v-if="recipe.image && !failedImages.has(recipe.id)"
                    :src="recipe.image"
                    alt=""
                    loading="lazy"
                    @error="imageFailed(recipe.id)"
                  />
                  <div v-else class="image-placeholder">
                    <v-icon
                      :icon="
                        recipe.category_icon || 'mdi-silverware-fork-knife'
                      "
                      size="48"
                    /><span>{{ recipe.name }}</span>
                  </div>
                </div>
                <div class="card-content">
                  <h3>{{ recipe.name }}</h3>
                  <div class="card-bottom">
                    <span
                      >{{ recipe.nutrients.calories }} kcal ·
                      {{ recipe.nutrients.protein }} g protein</span
                    ><span class="card-arrow"
                      ><v-icon icon="mdi-arrow-top-right" size="20"
                    /></span>
                  </div>
                </div>
              </button>
              <v-btn
                class="favorite-button"
                :icon="
                  favorites.includes(recipe.id)
                    ? 'mdi-heart'
                    : 'mdi-heart-outline'
                "
                color="primary"
                variant="text"
                size="small"
                :aria-pressed="favorites.includes(recipe.id)"
                :aria-label="`${favorites.includes(recipe.id) ? 'Fjern fra' : 'Legg til i'} favoritter: ${recipe.name}`"
                @click="toggleFavorite(recipe.id)"
              />
            </article>
          </div>
        </section>
        <footer>
          <span>Kamillas oppskriftsbok</span>
        </footer>
      </main>
      <v-dialog v-model="dialog" max-width="900" scrollable
        ><v-card v-if="selected" rounded="xl" class="detail-card"
          ><div class="detail-toolbar">
            <span>OPPSKRIFT</span>
            <div class="header-actions">
              <v-btn
                :icon="
                  favorites.includes(selected.id)
                    ? 'mdi-heart'
                    : 'mdi-heart-outline'
                "
                variant="text"
                :aria-pressed="favorites.includes(selected.id)"
                :aria-label="
                  favorites.includes(selected.id)
                    ? 'Fjern fra favoritter'
                    : 'Legg til i favoritter'
                "
                @click="toggleFavorite(selected.id)"
              /><v-btn
                icon="mdi-close"
                variant="text"
                aria-label="Lukk oppskrift"
                @click="dialog = false"
              />
            </div>
          </div>
          <v-card-text class="detail-body">
            <img
              v-if="selected.image && !failedImages.has(selected.id)"
              class="detail-image"
              :src="selected.image"
              :alt="selected.name"
              @error="imageFailed(selected.id)"
            />
            <h2>{{ selected.name }}</h2>
            <div class="recipe-management">
              <v-btn
                variant="text"
                prepend-icon="mdi-pencil-outline"
                @click="openEditor(selected)"
                >Rediger</v-btn
              ><v-btn
                variant="text"
                prepend-icon="mdi-content-copy"
                @click="openEditor(selected, true)"
                >Dupliser</v-btn
              ><v-btn
                variant="text"
                prepend-icon="mdi-delete-outline"
                @click="requestDelete"
                >Slett</v-btn
              >
            </div>
            <v-btn
              class="mb-5"
              color="primary"
              rounded="pill"
              prepend-icon="mdi-basket-plus-outline"
              @click="cart.addRecipe(selected, servings, selectedAddons)"
              >Legg til i handlelisten · {{ servings }}
              {{ servings === 1 ? 'porsjon' : 'porsjoner' }}</v-btn
            >
            <div class="nutrition-row">
              <span
                ><strong>{{ selected.nutrients.calories }}</strong> kcal</span
              ><span
                ><strong>{{ selected.nutrients.protein }} g</strong>
                protein</span
              ><span
                ><strong>{{ selected.nutrients.carbs }} g</strong>
                karbohydrat</span
              ><span
                ><strong>{{ selected.nutrients.fat }} g</strong> fett</span
              >
            </div>
            <p class="nutrition-note">
              Oppgitte næringsverdier fra oppskriften. Porsjonsgrunnlaget er
              ikke bekreftet; tallene endres ikke når du justerer porsjoner.
            </p>
            <div class="detail-columns">
              <section>
                <div class="ingredients-heading">
                  <h3>Ingredienser</h3>
                  <div class="serving-control">
                    <v-btn
                      icon="mdi-minus"
                      size="small"
                      variant="text"
                      :disabled="servings <= 1"
                      aria-label="Færre porsjoner"
                      @click="servings--"
                    /><span aria-live="polite"
                      >{{ servings }}
                      {{ servings === 1 ? 'porsjon' : 'porsjoner' }}</span
                    ><v-btn
                      icon="mdi-plus"
                      size="small"
                      variant="text"
                      :disabled="servings >= 20"
                      aria-label="Flere porsjoner"
                      @click="servings++"
                    />
                  </div>
                </div>
                <ul class="ingredient-list">
                  <li
                    v-for="(ingredient, index) in selected.ingredients"
                    :key="index"
                  >
                    <span>{{ ingredient.name }}</span
                    ><strong>{{ quantity(ingredient) }}</strong>
                  </li>
                </ul>
                <template v-if="selected.protein_addons.length"
                  ><h4 class="addons-heading">Ekstra proteinkilder</h4>
                  <ul class="ingredient-list">
                    <li
                      v-for="(ingredient, index) in selected.protein_addons"
                      :key="index"
                    >
                      <v-checkbox
                        v-model="selectedAddons"
                        :value="index"
                        :label="ingredient.name"
                        hide-details
                        density="compact"
                        color="primary"
                      /><strong>{{ quantity(ingredient) }}</strong>
                    </li>
                  </ul></template
                >
              </section>
              <section>
                <h3>Slik gjør du</h3>
                <ol v-if="selected.steps.length" class="step-list">
                  <li v-for="(step, index) in selected.steps" :key="index">
                    <span class="step-number">{{ index + 1 }}</span>
                    <p>{{ step }}</p>
                  </li>
                </ol>
                <p v-else class="missing-steps">
                  Denne oppskriften har foreløpig ingen fremgangsmåte.
                </p>
              </section>
            </div>
          </v-card-text></v-card
        ></v-dialog
      >
      <RecipeEditor
        v-model="editorOpen"
        :recipe="editTarget"
        :duplicate="duplicating"
        @saved="recipeSaved"
      />
      <v-dialog v-model="deleteOpen" max-width="450" :persistent="deleting"
        ><v-card rounded="xl"
          ><v-card-title>Slett oppskrift?</v-card-title
          ><v-card-text
            >Vil du slette «{{ deleteTarget?.name }}»? Oppskriften og det
            opplastede bildet fjernes. Dette kan ikke angres.<v-alert
              v-if="managementError"
              type="error"
              variant="tonal"
              class="mt-4"
              >{{ managementError }}</v-alert
            ></v-card-text
          ><v-card-actions
            ><v-btn :disabled="deleting" @click="deleteOpen = false"
              >Avbryt</v-btn
            ><v-btn
              color="error"
              :loading="deleting"
              :disabled="deleting"
              @click="deleteRecipe"
              >Slett oppskrift</v-btn
            ></v-card-actions
          ></v-card
        ></v-dialog
      >
      <v-snackbar v-model="messageOpen" :timeout="3500">{{
        message
      }}</v-snackbar>
    </v-main></v-app
  >
</template>
