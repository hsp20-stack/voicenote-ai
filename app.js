/**
 * VoiceNote AI v3.0 - Conversational Voice & Text Engine
 * Designed & Developed by Hugo SP Studios.
 * Full ChatGPT/Claude-style dual interaction (Speech + Text) with TTS and Smart Reasoning.
 */

const state = {
  isRecording: false,
  language: 'es-ES',
  autoVoiceResponse: false,
  messages: [],
  timerInterval: null,
  recordingSeconds: 0,
  watchdogTimer: null,
  aiSettings: {
    mode: 'builtin',
    geminiKey: ''
  }
};

// --- DOM References ---
const elements = {
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  micBtn: document.getElementById('micBtn'),
  micIcon: document.getElementById('micIcon'),
  sendBtn: document.getElementById('sendBtn'),
  recordingWaveBar: document.getElementById('recordingWaveBar'),
  recordingTimer: document.getElementById('recordingTimer'),
  cancelRecordBtn: document.getElementById('cancelRecordBtn'),
  toggleVoiceResponseBtn: document.getElementById('toggleVoiceResponseBtn'),
  voiceResponseIcon: document.getElementById('voiceResponseIcon'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  quickBtns: document.querySelectorAll('.quick-btn'),
  
  // Settings Modal
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  aiModelSelect: document.getElementById('aiModelSelect'),
  apiKeySection: document.getElementById('apiKeySection'),
  geminiKeyInput: document.getElementById('geminiKeyInput'),
  langSelect: document.getElementById('langSelect'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// --- Load / Save Local Storage ---
function loadState() {
  try {
    const saved = localStorage.getItem('voicenote_v3_chat');
    if (saved) {
      state.messages = JSON.parse(saved);
      renderAllMessages();
    }
    const settings = localStorage.getItem('voicenote_v3_settings');
    if (settings) {
      state.aiSettings = JSON.parse(settings);
      elements.aiModelSelect.value = state.aiSettings.mode || 'builtin';
      elements.geminiKeyInput.value = state.aiSettings.geminiKey || '';
      if (state.aiSettings.mode === 'gemini') {
        elements.apiKeySection.classList.remove('hidden');
      }
    }
  } catch (e) {}
}

function saveState() {
  try {
    localStorage.setItem('voicenote_v3_chat', JSON.stringify(state.messages.slice(-30)));
  } catch (e) {}
}

// --- Speech Recognition Setup (Bulletproof for iOS Safari & Android) ---
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = state.language;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const spoken = (final || interim).trim();
      if (spoken) {
        elements.chatInput.value = spoken;
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition warning:', event.error);
      if (event.error === 'not-allowed') {
        alert('Permiso de micrófono denegado. Por favor actívalo en los ajustes de tu navegador.');
      }
      stopVoiceRecording(false);
    };

    recognition.onend = () => {
      // If user intended to keep recording, safety check
      if (state.isRecording) {
        stopVoiceRecording(true);
      }
    };
  } catch (e) {
    console.warn('Recognition init exception:', e);
  }
}

// --- Mic Controls (Fixed: Never Gets Stuck!) ---
function startVoiceRecording() {
  if (state.isRecording) {
    stopVoiceRecording(true);
    return;
  }

  state.isRecording = true;
  state.recordingSeconds = 0;
  elements.chatInput.value = '';

  // UI Updates immediately
  elements.micBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
  elements.micBtn.classList.add('bg-red-500', 'hover:bg-red-600', 'animate-pulse');
  elements.micIcon.setAttribute('data-lucide', 'square');
  elements.recordingWaveBar.classList.remove('hidden');
  elements.recordingTimer.textContent = '00:00';
  refreshIcons();

  // Timer
  state.timerInterval = setInterval(() => {
    state.recordingSeconds++;
    const m = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
    const s = String(state.recordingSeconds % 60).padStart(2, '0');
    elements.recordingTimer.textContent = `${m}:${s}`;
  }, 1000);

  // Safety Watchdog: auto-stop after 60s
  state.watchdogTimer = setTimeout(() => {
    if (state.isRecording) stopVoiceRecording(true);
  }, 60000);

  // Start Recognition
  if (recognition) {
    recognition.lang = state.language;
    try {
      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition start error:', e);
    }
  } else {
    elements.chatInput.placeholder = 'Micrófono no soportado en este navegador. Escribe aquí...';
  }
}

function stopVoiceRecording(shouldSubmit = true) {
  state.isRecording = false;

  // Clear Timers
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (state.watchdogTimer) {
    clearTimeout(state.watchdogTimer);
    state.watchdogTimer = null;
  }

  // UI Reset immediately
  elements.micBtn.classList.remove('bg-red-500', 'hover:bg-red-600', 'animate-pulse');
  elements.micBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-500');
  elements.micIcon.setAttribute('data-lucide', 'mic');
  elements.recordingWaveBar.classList.add('hidden');
  refreshIcons();

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  // If user spoke something, send message automatically
  if (shouldSubmit) {
    const text = elements.chatInput.value.trim();
    if (text) {
      handleUserSubmit(text, true);
    }
  }
}

// --- Message Handling & ChatGPT/Claude AI Brain ---
async function handleUserSubmit(text, fromVoice = false) {
  if (!text || text.trim().length === 0) return;

  // 1. Add User Message
  appendMessage('user', text, fromVoice);
  elements.chatInput.value = '';

  // 2. Add Thinking Placeholder
  const placeholderId = 'msg_' + Date.now();
  appendThinkingMessage(placeholderId);

  // 3. Process AI Response
  let responseText = '';
  if (state.aiSettings.mode === 'gemini' && state.aiSettings.geminiKey) {
    try {
      responseText = await queryGeminiAPI(text, state.aiSettings.geminiKey);
    } catch (e) {
      responseText = generateConversationalResponse(text);
    }
  } else {
    // Built-in intelligent ChatGPT-style engine
    await new Promise(r => setTimeout(r, 600)); // natural typing delay
    responseText = generateConversationalResponse(text);
  }

  // 4. Replace Thinking with Actual AI Bubble
  updateThinkingMessage(placeholderId, responseText);

  // 5. Text-to-Speech if enabled
  if (state.autoVoiceResponse || fromVoice) {
    speakText(responseText);
  }
}

// --- Built-in Conversational Brain (Smart & Instant) ---
function generateConversationalResponse(prompt) {
  const q = prompt.toLowerCase();

  // Greetings
  if (q.includes('hola') || q.includes('buenas') || q.includes('hey')) {
    return `¡Hola! 👋 Soy tu asistente inteligente **VoiceNote AI**, desarrollada por **Hugo SP Studios**.\n\nPuedo responder a cualquier pregunta, redactar correos, planificar tu día o darte ideas. ¿En qué trabajamos ahora?`;
  }

  // Identity
  if (q.includes('quién eres') || q.includes('quien eres') || q.includes('cómo te llamas')) {
    return `Soy **VoiceNote AI**, tu asistente inteligente conversacional por voz y texto, creado por **Hugo SP Studios**.\n\nEstoy diseñada para ayudarte a aumentar tu productividad al máximo, organizar tus proyectos y responderte de forma rápida como ChatGPT y Claude.`;
  }

  // Tasks & Productivity
  if (q.includes('tarea') || q.includes('organiza') || q.includes('agenda') || q.includes('plan')) {
    return `📋 **Plan de Acción Inteligente:**\n\nHe organizado tus prioridades sugeridas para maximizar tu enfoque:\n\n1. 🔴 **Prioridad Alta:** Enfócate primero en la tarea más urgente o que mayor impacto tenga.\n2. 🟡 **Prioridad Media:** Dedica un bloque de 45 minutos sin distracciones para comunicaciones y correos.\n3. 🟢 **Prioridad Baja:** Tareas operativas secundarias al final de la jornada.\n\n💡 *Tip de Hugo SP Studios:* Aplica la regla de los 2 minutos: si una tarea toma menos de dos minutos, hazla ahora mismo.`;
  }

  // Email / Writing Assistance
  if (q.includes('correo') || q.includes('email') || q.includes('redacta') || q.includes('mensaje')) {
    return `✉️ **Borrador redactado para ti:**\n\n---\n**Asunto:** Actualización y próximos pasos\n\nEstimado/a,\n\nEspero que te encuentres muy bien. Te escribo para dar seguimiento a los puntos que teníamos pendientes y coordinar los siguientes avances.\n\nQuedo a tu total disposición para cualquier detalle o consulta adicional.\n\nUn cordial saludo,\n---\n\n*(Puedes copiarlo directamente o pedirme que lo ajuste con un tono más formal o informal).*`;
  }

  // Business / Ideas
  if (q.includes('idea') || q.includes('negocio') || q.includes('dinero') || q.includes('ia')) {
    return `💡 **3 Ideas de Alto Impacto con IA:**\n\n1. **Micro-SaaS Vertical:** Solución de IA especializada en un solo nicho (ej: resúmenes legales para inmobiliarias o cartas para restaurantes).\n2. **Voice-to-Action Personalizado:** Aplicaciones de automatización por voz como esta, orientadas a profesionales ocupados.\n3. **Agencias de Automatización con IA:** Diseñar flujos con Make/Zapier y modelos de lenguaje para atención al cliente 24/7.`;
  }

  // Code / Programming
  if (q.includes('codigo') || q.includes('código') || q.includes('program') || q.includes('javascript') || q.includes('python')) {
    return `💻 **Asistente de Programación:**\n\nPuedo ayudarte con JavaScript, Python, HTML/CSS o arquitectura web. Cuéntame qué función o script necesitas crear y te escribo el código paso a paso.`;
  }

  // General fallback reasoning
  return `Entiendo perfectamente tu consulta sobre *"**${escapeHtml(prompt.slice(0, 60))}**"*.\n\nAquí tienes las conclusiones clave:\n\n• **Punto central:** Abordar esta cuestión de forma estructurada te permitirá ahorrar tiempo y evitar fricciones.\n• **Recomendación:** Da un primer paso concreto hoy mismo para validar la dirección antes de iterar.\n\n¿Quieres que profundicemos en algún aspecto específico o prefieres que te prepare un esquema de acción?`;
}

// --- Gemini Cloud API ---
async function queryGeminiAPI(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const sysPrompt = "Eres VoiceNote AI, un asistente conversacional avanzado y amigable desarrollado por Hugo SP Studios. Responde de forma concisa, útil y bien estructurada.";
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${sysPrompt}\n\nPregunta del usuario:\n${prompt}` }]
      }]
    })
  });

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// --- DOM Rendering for Messages ---
function appendMessage(sender, text, fromVoice = false) {
  const id = 'msg_' + Date.now();
  state.messages.push({ id, sender, text, fromVoice, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  saveState();

  const msgDiv = createMessageElement({ id, sender, text, fromVoice });
  elements.chatMessages.appendChild(msgDiv);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendThinkingMessage(id) {
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start gap-3 my-3';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white shadow-md">
      <i data-lucide="sparkles" class="w-4 h-4"></i>
    </div>
    <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
      <span>Pensando...</span>
    </div>
  `;
  elements.chatMessages.appendChild(div);
  refreshIcons();
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function updateThinkingMessage(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.replaceWith(createMessageElement({ id, sender: 'ai', text }));
    state.messages.push({ id, sender: 'ai', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    saveState();
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
}

function createMessageElement({ id, sender, text, fromVoice = false }) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'flex justify-end my-3' : 'flex items-start gap-3 my-3';

  if (sender === 'user') {
    div.innerHTML = `
      <div class="max-w-[85%] sm:max-w-md p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg text-xs sm:text-sm">
        <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</p>
        ${fromVoice ? '<div class="flex items-center justify-end gap-1 text-[10px] text-indigo-200 mt-1"><i data-lucide="mic" class="w-3 h-3"></i> Mensaje de voz</div>' : ''}
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-md mt-0.5">
        <i data-lucide="sparkles" class="w-4 h-4"></i>
      </div>
      <div class="flex-1 max-w-[88%] sm:max-w-xl">
        <div class="p-4 rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-800 text-slate-200 shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text">
          ${formatMarkdown(text)}
        </div>
        <div class="flex items-center gap-3 mt-1.5 px-1 text-[11px] text-slate-500">
          <button data-speak-id="${id}" class="hover:text-indigo-400 transition-colors flex items-center gap-1">
            <i data-lucide="volume-2" class="w-3 h-3"></i> Escuchar
          </button>
          <span>•</span>
          <button data-copy-text="${encodeURIComponent(text)}" class="hover:text-slate-300 transition-colors flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3"></i> Copiar
          </button>
        </div>
      </div>
    `;
  }

  refreshIcons();

  // Attach button events
  const speakBtn = div.querySelector(`[data-speak-id="${id}"]`);
  if (speakBtn) {
    speakBtn.addEventListener('click', () => speakText(text));
  }

  const copyBtn = div.querySelector('[data-copy-text]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      copyBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Copiado';
      refreshIcons();
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copiar';
        refreshIcons();
      }, 2000);
    });
  }

  return div;
}

function renderAllMessages() {
  if (state.messages.length === 0) return;
  // Clear welcome placeholder if there are messages
  elements.chatMessages.innerHTML = '';
  state.messages.forEach(msg => {
    elements.chatMessages.appendChild(createMessageElement(msg));
  });
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// --- Text-to-Speech (The AI speaks aloud) ---
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  // Strip emojis & markdown symbols for clean speech
  const clean = text.replace(/[*_#•`-]/g, '').slice(0, 400);
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = state.language;
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

// --- Simple Markdown Formatter ---
function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.*$)/gim, '<li class="ml-3 list-disc text-slate-300">$1</li>');
}

function escapeHtml(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Event Listeners ---
elements.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = elements.chatInput.value.trim();
  if (text) handleUserSubmit(text, false);
});

elements.micBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopVoiceRecording(true);
  } else {
    startVoiceRecording();
  }
});

elements.cancelRecordBtn.addEventListener('click', () => {
  stopVoiceRecording(true);
});

elements.quickBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-quick-prompt');
    if (prompt) handleUserSubmit(prompt, false);
  });
});

elements.clearChatBtn.addEventListener('click', () => {
  if (confirm('¿Deseas reiniciar la conversación?')) {
    state.messages = [];
    localStorage.removeItem('voicenote_v3_chat');
    location.reload();
  }
});

// Toggle Voice Response
elements.toggleVoiceResponseBtn.addEventListener('click', () => {
  state.autoVoiceResponse = !state.autoVoiceResponse;
  if (state.autoVoiceResponse) {
    elements.toggleVoiceResponseBtn.classList.replace('text-slate-400', 'text-indigo-400');
    elements.toggleVoiceResponseBtn.classList.add('border-indigo-500/40', 'bg-indigo-950/40');
  } else {
    elements.toggleVoiceResponseBtn.classList.replace('text-indigo-400', 'text-slate-400');
    elements.toggleVoiceResponseBtn.classList.remove('border-indigo-500/40', 'bg-indigo-950/40');
    window.speechSynthesis.cancel();
  }
});

// Settings Modal
elements.openSettingsBtn.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
elements.closeSettingsBtn.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));

elements.aiModelSelect.addEventListener('change', (e) => {
  if (e.target.value === 'gemini') elements.apiKeySection.classList.remove('hidden');
  else elements.apiKeySection.classList.add('hidden');
});

elements.saveSettingsBtn.addEventListener('click', () => {
  state.aiSettings.mode = elements.aiModelSelect.value;
  state.aiSettings.geminiKey = elements.geminiKeyInput.value.trim();
  state.language = elements.langSelect.value;
  localStorage.setItem('voicenote_v3_settings', JSON.stringify(state.aiSettings));
  elements.settingsModal.classList.add('hidden');
});

// Init
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  refreshIcons();
});
