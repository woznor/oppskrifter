<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import App from '../App.vue'
import { apiUrl, apiRequest, hasSession, login, setSession } from '../api'

const unlocked = ref(false)
const password = ref('')
const error = ref('')
const busy = ref(false)
async function restore() {
  if (!hasSession()) return
  busy.value = true
  try {
    await apiRequest('/session')
    unlocked.value = true
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}
async function unlock() {
  busy.value = true
  error.value = ''
  try {
    await login(password.value)
    password.value = ''
    unlocked.value = true
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}
function logout() {
  setSession('')
  unlocked.value = false
  error.value = ''
}
function sessionExpired() {
  unlocked.value = false
  error.value = 'Logg inn på nytt for å fortsette.'
}
onMounted(() => {
  window.addEventListener('recipe-session-expired', sessionExpired)
  restore()
})
onUnmounted(() =>
  window.removeEventListener('recipe-session-expired', sessionExpired)
)
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
          <v-btn
            type="submit"
            color="primary"
            block
            :disabled="!password || !apiUrl || busy"
            :loading="busy"
            >Åpne oppskriftsboken</v-btn
          >
        </form>
        <p class="access-note" role="status">
          {{
            apiUrl
              ? 'Denne nettleseren husker innloggingen i opptil 30 dager.'
              : 'Oppskriftsboken venter på at backend blir koblet til.'
          }}
        </p>
      </section>
    </v-main>
  </v-app>
</template>
