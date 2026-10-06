# Recipe data

`meals.json` contains an array of recipes. IDs are stable. Text is UTF-8.

- `name`: recipe title.
- `portions`: number of servings the ingredient quantities make.
- `rating`: original rating; currently every recipe has 3. The scale is not documented.
- `protein_powder`: original flag, retained without reinterpretation.
- `heatable`, `must_be_heated`: original flags. Confirm whether `heatable` means reheatable before using these to label recipes; some recipes require heating while `heatable` is false.
- `meal_types`: original numeric meal-type codes. Their labels need confirmation before displaying category names.
- `category_icon`: Vuetify/MDI icon name, or `null` when unavailable.
- `image`: original external image URL, or `null` when no image URL is available. The app shows a placeholder for recipes without an image.
- `steps`: ordered plain-text instructions. An empty array means instructions are missing. Render these as text, without HTML.
- `ingredients`: ingredient objects with `name`, `amount`, `unit`, and `grams`.
- `protein_addons`: ingredient objects for additional protein choices. An empty array means none are listed. Whether these are alternatives needs confirmation.
- `nutrients`: original `calories`, `protein`, `carbs`, `fat`, and `fibre` values. The source does not specify whether these are per serving or include a protein add-on. All fibre values are originally zero; they have been preserved, but should be verified before display as measured values.

Ingredient `amount` is the quantity in `unit`, while `grams` is the supplied weight. Use the weight when `amount` or `unit` is `null`; for example, mozzarella with no piece count is 30 grams, not zero mozzarella. Scale both quantities by the requested servings divided by `portions`.

Empty `icon`, `meal_category`, and `date_time` placeholders have been removed. The old `procedure` field is now `steps`; `meal_type` is now `meal_types`; `meal_category_icon` is now `category_icon`. Ingredient fields `text`, `number`, and `type` are now `name`, `amount`, and `unit`.

New recipes use `null` for ratings and reheating flags when the source does not provide them. Hot honey bowl (ID 35) was transcribed from the supplied screenshots. Its serving count is assumed to be one; the screenshot does not specify it. Salt and pepper are mentioned in the instructions without quantities and are not included in the measured ingredient list.
