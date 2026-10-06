<script setup>
import { computed, onMounted, ref } from 'vue'
import { filterRecipes, ingredientQuantity } from './recipes'
import ShoppingCart from './components/ShoppingCart.vue'
const cart = ref(null)
const selectedAddons = ref([])
const recipes = ref([])
const loading = ref(true)
const error = ref(false)
const search = ref('')
const proteinOnly = ref(false)
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
  filterRecipes(recipes.value, search.value, proteinOnly.value, sort.value)
)
async function loadRecipes() {
  loading.value = true
  error.value = false
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}meals.json`)
    if (!response.ok) throw new Error('Could not load recipes')
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Invalid recipe data')
    recipes.value = data
  } catch {
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
        ><ShoppingCart ref="cart" />
      </header>
      <main class="page">
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
                :variant="proteinOnly ? 'outlined' : 'flat'"
                :color="proteinOnly ? undefined : 'primary'"
                rounded="pill"
                @click="proteinOnly = false"
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
            </div>
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
        </section>
        <section
          class="collection"
          aria-label="Oppskrifter"
          :aria-busy="loading"
        >
          <div class="collection-heading">
            <h2>
              {{ search || proteinOnly ? 'Dine treff' : 'Oppskriftene mine' }}
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
            <p>Prøv igjen om et øyeblikk.</p>
            <v-btn color="primary" @click="loadRecipes">Prøv igjen</v-btn>
          </div>
          <div v-else-if="!visibleRecipes.length" class="empty-state">
            <v-icon icon="mdi-magnify" size="44" />
            <h3>Ingen oppskrifter funnet</h3>
            <p>Prøv et annet søkeord, eller fjern proteinfilteret.</p>
            <v-btn color="primary" @click="resetFilters"
              >Vis alle oppskrifter</v-btn
            >
          </div>
          <div v-else class="recipe-grid">
            <button
              v-for="recipe in visibleRecipes"
              :key="recipe.id"
              class="recipe-card"
              @click="openRecipe(recipe)"
            >
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
                    :icon="recipe.category_icon || 'mdi-silverware-fork-knife'"
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
          </div>
        </section>
        <footer>
          <span>Kamillas oppskriftsbok</span>
        </footer>
      </main>
      <v-dialog v-model="dialog" max-width="900" scrollable
        ><v-card v-if="selected" rounded="xl" class="detail-card"
          ><div class="detail-toolbar">
            <span>OPPSKRIFT</span
            ><v-btn
              icon="mdi-close"
              variant="text"
              aria-label="Lukk oppskrift"
              @click="dialog = false"
            />
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
    </v-main></v-app
  >
</template>
