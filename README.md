# Kamillas oppskriftsbok

A personal Norwegian recipe collection for Kamilla's family and friends, built with Vue 3, Vite, and Vuetify. Recipes and uploaded images are stored in Supabase. See [backend setup](docs/backend-setup.md) for deployment and [recipe format](public/meals-format.md) for the data format. `data/meals.json` is the original import backup.

## Development

```sh
npm install
cp .env.example .env.local
npm run dev
```

## Verification and production

```sh
npm test
npm run build
npm run preview
```

Search matches recipe titles, ingredients, and protein additions, ignoring case and accents. Multiple search words must all match. Recipes can be filtered by protein and sorted by name, protein, or calories. Opening a recipe shows instructions and quantities adjustable from 1 to 20 servings.

The recipe editor supports creating, updating and deleting recipes, plus image uploads and removal. Imported external image URLs are retained until successfully copied to Storage or replaced with an upload. Nutrition values retain their original basis and are not scaled. Recipes can be filtered by Frokost (0), Lunsj (1), Middag (2) and Kvelds (3).

## Shopping list

Open a recipe, choose servings and any optional protein additions, then add it to the shopping list. The list combines ingredients across dishes and is saved in the current browser. Removing a dish recalculates the quantities; purchased items can be checked off.

Ingredient names match regardless of case and spacing, with explicit aliases for known equivalents such as medium potatoes and green pesto. Different product variants remain separate. Compatible units are converted (for example, tablespoons and decilitres to millilitres). When unit families differ, the supplied gram weights are summed without assuming a density. Add further verified aliases in `src/shopping.js` as needed.

## Shared password

The backend validates `SITE_PASSWORD` and issues a signed 30-day session, remembered in localStorage. There are no separate accounts or admin passwords: everyone with the shared password can edit recipes. Change the Supabase password secret to invalidate sessions. Backend secrets never belong in `VITE_` variables. Logout removes remembered access while preserving the shopping list and favorites.

Recipes and private image uploads are accessed through the password-checked API. The public import backup and Git history retain previously published recipes.

Favorites are saved as recipe IDs in localStorage under `kamilla-favorites-v1`. Heart buttons are available on cards and in recipe details. The favorites filter combines with search and the protein filter; logging out preserves favorites.

## Weekly menu and copying

The weekly menu stores one recipe and 1–20 servings for each weekday under `kamilla-week-menu-v1`. It is a reusable plan, not a dated calendar. Updating the shopping list replaces entries previously created by the menu and preserves manually added dishes. Optional protein additions are excluded. Clearing the plan is local to the menu; update the shopping list afterwards to remove its planned dishes there.

Shopping list copying defaults to remaining items, with an option to include checked items. If clipboard access is unavailable, a text field supports manual copying.

Recipe duplication opens an editable draft with a copy name and saves it as a new recipe. Uploaded images are copied to a separate Storage object; existing external image URLs are retained. Cancelling the draft creates nothing. Recipe deletion always opens a confirmation dialog before sending the delete request.

Recipe filters: Lite styr selects recipes with at most six ingredients and four nonempty preparation steps. Mye styr selects more than six ingredients or four steps. Fort gjort selects recipes with an explicitly supplied total duration of at most 20 minutes; unknown times are excluded. Total duration can be entered in the recipe editor. Overrask meg opens a random recipe matching all current filters, avoiding the last selection when alternatives exist.
