<script setup>
import { ref } from 'vue'
import App from '../App.vue'
import { accessStorageKey, accessVersion, sitePassword } from '../access'

const unlocked = ref(false)
const password = ref('')
const error = ref('')
const storageMessage = ref('')
try {
  unlocked.value = localStorage.getItem(accessStorageKey) === accessVersion
} catch {
  storageMessage.value = 'Nettleseren kan ikke huske innloggingen akkurat nå.'
}
function unlock() {
  if (password.value !== sitePassword) {
    error.value = 'Feil passord. Prøv igjen.'
    return
  }
  try {
    localStorage.setItem(accessStorageKey, accessVersion)
  } catch {
    /* Access still works without storage. */
  }
  password.value = ''
  unlocked.value = true
}
function logout() {
  try {
    localStorage.removeItem(accessStorageKey)
  } catch {
    storageMessage.value = 'Innloggingen kunne ikke fjernes fra nettleseren.'
  }
  unlocked.value = false
  error.value = ''
}
</script>

<template>
  <App v-if="unlocked" @logout="logout" />
  <v-app v-else>
    <v-main class="access-page">
      <section class="access-card" aria-labelledby="access-title">
        <v-icon icon="mdi-silverware-fork-knife" color="primary" size="28" />
        <h1 id="access-title">Kamillas oppskriftsbok</h1>
        <p>Skriv inn passordet for å åpne oppskriftene.</p>
        <form @submit.prevent="unlock">
          <v-text-field
            v-model="password"
            label="Passord"
            type="password"
            autocomplete="current-password"
            variant="outlined"
            :error-messages="error"
            autofocus
            @update:model-value="error = ''"
          />
          <v-btn type="submit" color="primary" block :disabled="!password"
            >Åpne oppskriftsboken</v-btn
          >
        </form>
        <p class="access-note" role="status">
          {{ storageMessage || 'Denne nettleseren husker innloggingen din.' }}
        </p>
      </section>
    </v-main>
  </v-app>
</template>
