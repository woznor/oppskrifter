# Kamillas oppskriftsbok

A personal Norwegian recipe collection for Kamilla's family and friends, built with Vue 3, Vite, and Vuetify. Recipes are loaded from `public/meals.json`; see `public/meals-format.md` for the data format.

## Development

```sh
npm install
npm run dev
```

## Verification and production

```sh
npm test
npm run build
npm run preview
```

Search matches recipe titles, ingredients, and protein additions, ignoring case and accents. Multiple search words must all match. Recipes can be filtered by protein and sorted by name, protein, or calories. Opening a recipe shows instructions and quantities adjustable from 1 to 20 servings.

External image URLs are preserved; unavailable images have a fallback. Nutrition values retain their original basis and are not scaled. Undocumented meal-type codes and heating flags are not displayed.

## Shopping list

Open a recipe, choose servings and any optional protein additions, then add it to the shopping list. The list combines ingredients across dishes and is saved in the current browser. Removing a dish recalculates the quantities; purchased items can be checked off.

Ingredient names match regardless of case and spacing, with explicit aliases for known equivalents such as medium potatoes and green pesto. Different product variants remain separate. Compatible units are converted (for example, tablespoons and decilitres to millilitres). When unit families differ, the supplied gram weights are summed without assuming a density. Add further verified aliases in `src/shopping.js` as needed.

## Frontend password

The entry screen uses the password in `src/access.js` (initially `kamillasmat`). Successful entry stores an access version in localStorage, not the entered password. Change the password and increment `accessVersion` to reset remembered logins after deployment. The logout button removes remembered access while preserving the shopping list. Recipe loading starts after the entry screen is unlocked.

This is a frontend convenience gate. The public repository, deployed JavaScript, and `meals.json` remain accessible without authentication.
