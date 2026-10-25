/**
 * VoiceNote AI - Tu Asistente con Voz Hablada en Castellano
 * Desarrollada por Hugo SP Studios.
 * Fix iOS Safari: la voz se activa SINCRÓNICAMENTE en el gesto del usuario
 */

let _currentUtterance = null;

// Acceso seguro a localStorage (evita que el script se muera en modo incógnito/privado)
function safeGetStorage(key) {
  try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}
function safeSetStorage(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
}
function safeRemoveStorage(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

const state = {
  language: 'es-ES',
  isLiveCallActive: false,
  isRecording: false,
  isAiSpeaking: false,
  recognition: null,
  lastAiSpeechText: '',
  conversationHistory: [],
  geminiApiKey: safeGetStorage('voicenote_gemini_key')
};

// --- DOM References ---
const elements = {
  chatMessages:         document.getElementById('chatMessages'),
  welcomeScreen:        document.getElementById('welcomeScreen'),
  chatForm:             document.getElementById('chatForm'),
  chatInput:            document.getElementById('chatInput'),
  micBtn:               document.getElementById('micBtn'),
  micIcon:              document.getElementById('micIcon'),
  sendBtn:              document.getElementById('sendBtn'),
  openLiveVoiceBtn:     document.getElementById('openLiveVoiceBtn'),
  clearChatBtn:         document.getElementById('clearChatBtn'),
  settingsBtn:          document.getElementById('settingsBtn'),
  settingsModal:        document.getElementById('settingsModal'),
  closeSettingsBtn:     document.getElementById('closeSettingsBtn'),
  saveSettingsBtn:      document.getElementById('saveSettingsBtn'),
  geminiApiKeyInput:    document.getElementById('geminiApiKeyInput'),
  apiKeyStatus:         document.getElementById('apiKeyStatus'),
  liveVoiceModal:       document.getElementById('liveVoiceModal'),
  closeLiveVoiceBtn:    document.getElementById('closeLiveVoiceBtn'),
  toggleVoiceCallMicBtn:document.getElementById('toggleVoiceCallMicBtn'),
  callMicIcon:          document.getElementById('callMicIcon'),
  voiceOrb:             document.getElementById('voiceOrb'),
  voiceStatusText:      document.getElementById('voiceStatusText'),
  voiceTranscriptPreview:document.getElementById('voiceTranscriptPreview'),
  orbCenterIcon:        document.getElementById('orbCenterIcon'),
  manualSpeakBtn:       document.getElementById('manualSpeakBtn')
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// --- KaTeX Math Renderer ---
function renderMathFormulas(element) {
  if (window.renderMathInElement && element) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }
}

// =====================================================
// MOTOR DE VOZ — Fix iOS Safari
// =====================================================

function initVoices() {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function getBestSpanishVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = voices.find(v =>
    v.lang.toLowerCase().startsWith('es') &&
    (v.name.includes('Monica')  || v.name.includes('Mónica')  ||
     v.name.includes('Jorge')   || v.name.includes('Spain')   ||
     v.name.includes('España')  || v.name.includes('Siri')    ||
     v.name.includes('Google español') || v.name.includes('es-ES'))
  );
  return preferred || voices.find(v => v.lang.toLowerCase().startsWith('es')) || null;
}

function speakSpanishVoice(text, onEndCallback = null) {
  if (!('speechSynthesis' in window) || !text) {
    if (onEndCallback) onEndCallback();
    return;
  }

  window.speechSynthesis.cancel();

  const clean = text
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]*?\$/g, '')
    .replace(/[*_#•`]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1 sobre $2')
    .replace(/\\pi/g, 'pi')
    .replace(/\\sin/g, 'seno')
    .replace(/\\cos/g, 'coseno')
    .replace(/\\tan/g, 'tangente')
    .replace(/\n+/g, '. ')
    .replace(/#{1,3}\s/g, '')
    .trim()
    .slice(0, 450);

  if (!clean) { if (onEndCallback) onEndCallback(); return; }

  _currentUtterance = new SpeechSynthesisUtterance(clean);
  _currentUtterance.lang  = 'es-ES';
  _currentUtterance.rate  = 0.95;
  _currentUtterance.pitch = 1.05;
  _currentUtterance.volume = 1.0;

  const voice = getBestSpanishVoice();
  if (voice) _currentUtterance.voice = voice;

  state.isAiSpeaking = true;
  state.lastAiSpeechText = text;

  if (state.isLiveCallActive) {
    elements.voiceStatusText.textContent = '🔊 Hablándote en castellano...';
    elements.voiceOrb.className = 'w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all scale-110';
    elements.orbCenterIcon.setAttribute('data-lucide', 'volume-2');
    refreshIcons();
  }

  _currentUtterance.onend = () => {
    state.isAiSpeaking = false;
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = '🎤 Te escucho... habla ahora';
      elements.voiceOrb.className = 'w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-sky-400 via-blue-600 to-cyan-300 animate-orb-pulse animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all';
      elements.orbCenterIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();
      setTimeout(() => {
        if (state.isLiveCallActive && !state.isAiSpeaking) startSpeechRecognizer();
      }, 400);
    }
    if (onEndCallback) onEndCallback();
  };

  _currentUtterance.onerror = (e) => {
    console.warn('Speech error:', e.error);
    state.isAiSpeaking = false;
    if (onEndCallback) onEndCallback();
  };

  window.speechSynthesis.speak(_currentUtterance);

  const keepAlive = setInterval(() => {
    if (!state.isAiSpeaking) { clearInterval(keepAlive); return; }
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10000);
}

// --- Reconocimiento de Voz ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupSpeechRecognition() {
  if (!SpeechRecognition) return null;
  const recog = new SpeechRecognition();
  recog.continuous      = false;
  recog.interimResults  = true;
  recog.lang            = 'es-ES';

  recog.onresult = (event) => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final  += event.results[i][0].transcript;
      else                          interim += event.results[i][0].transcript;
    }
    const currentText = (final || interim).trim();
    if (state.isLiveCallActive) {
      elements.voiceTranscriptPreview.textContent = `"${currentText}"`;
    } else {
      elements.chatInput.value = currentText;
    }
  };

  recog.onend = () => {
    state.isRecording = false;
    if (state.isLiveCallActive) {
      const recognized = elements.voiceTranscriptPreview.textContent.replace(/^"|"$/g, '').trim();
      const isPlaceholder = recognized.startsWith('Háblame') || recognized.startsWith('"Háblame') || recognized === '';
      if (recognized && !isPlaceholder && !state.isAiSpeaking) {
        handleVoiceExchange(recognized);
      }
    } else {
      elements.micBtn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
      elements.micBtn.classList.add('bg-slate-800', 'text-slate-300');
      elements.micIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();
      const text = elements.chatInput.value.trim();
      if (text) handleUserSubmit(text, true);
    }
  };

  recog.onerror = (e) => {
    state.isRecording = false;
    if (!state.isLiveCallActive) {
      elements.micBtn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
      elements.micBtn.classList.add('bg-slate-800', 'text-slate-300');
      elements.micIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();
    }
  };

  return recog;
}

function startSpeechRecognizer() {
  if (state.isAiSpeaking) return;
  if (!state.recognition) state.recognition = setupSpeechRecognition();
  if (!state.recognition) return;
  state.recognition.lang = 'es-ES';
  try {
    state.isRecording = true;
    state.recognition.start();
  } catch (e) {
    state.isRecording = false;
  }
}

function stopSpeechRecognizer() {
  state.isRecording = false;
  if (state.recognition) {
    try { state.recognition.abort(); } catch (e) {}
  }
}

// =====================================================
// MODAL DE VOZ
// =====================================================
function openLiveVoiceModal(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (state.isLiveCallActive) return;
  state.isLiveCallActive = true;

  stopSpeechRecognizer();

  elements.liveVoiceModal.classList.remove('hidden');
  elements.liveVoiceModal.style.display = 'flex';

  const greeting = 'Hola. Estoy aquí. Dime lo que quieras y te respondo con mi voz.';
  elements.voiceStatusText.textContent = '🔊 Hablándote en castellano...';
  elements.voiceTranscriptPreview.textContent = `"${greeting}"`;

  speakSpanishVoice(greeting, () => {
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = '🎤 Te escucho... habla ahora';
      startSpeechRecognizer();
    }
  });
}

function closeLiveVoiceModal(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  state.isLiveCallActive = false;
  window.speechSynthesis.cancel();
  stopSpeechRecognizer();
  elements.liveVoiceModal.classList.add('hidden');
  elements.liveVoiceModal.style.display = 'none';
}

async function handleVoiceExchange(userText) {
  if (!userText || state.isAiSpeaking) return;
  if (elements.welcomeScreen) elements.welcomeScreen.remove();

  appendMessageBubble('user', userText, true);
  elements.voiceStatusText.textContent = '⏳ Pensando...';
  elements.voiceOrb.className = 'w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-500 to-pink-500 animate-pulse flex items-center justify-center relative cursor-pointer shadow-2xl transition-all';

  const aiResult = await fetchRealAiResponse(userText);
  appendMessageBubble('ai', aiResult.text, false, aiResult);
  elements.voiceTranscriptPreview.textContent = `"${aiResult.speechText || aiResult.text}"`;

  speakSpanishVoice(aiResult.speechText || aiResult.text);
}

// =====================================================
// MOTOR DE IA — Respuestas Reales, Dinámicas y Sin Repeticiones
// =====================================================
async function fetchRealAiResponse(query) {
  const cleanQ = query.trim();
  const lower  = cleanQ.toLowerCase();

  state.conversationHistory.push({ role: 'user', content: cleanQ });
  if (state.conversationHistory.length > 14) {
    state.conversationHistory = state.conversationHistory.slice(-14);
  }

  const wantsPdf = lower.includes('pdf') || lower.includes('descargar documento') || lower.includes('descargar informe');
  const wantsCalendar = lower.includes('cita') || lower.includes('agenda') || lower.includes('calendario');

  const systemPrompt = `Eres VoiceNote AI, un asistente inteligente y amigable desarrollado por Hugo SP Studios.
Responde SIEMPRE en castellano de España, con tono claro, conciso, natural y directo.
Si la consulta incluye fórmulas o matemáticas, utiliza notación LaTeX (en bloque con $$...$$ o en línea con $...$).
NO uses respuestas genéricas ni frases de relleno. Ve directo al contenido que pide el usuario.`;

  // 1. INTENTO 1: Google Gemini API (si el usuario la ha configurado en ⚙️)
  if (state.geminiApiKey) {
    try {
      // Filtrar el historial para asegurar alternancia estricta user -> model (evita error 400 de Gemini)
      const validContents = [];
      let expectedRole = 'user';
      for (const msg of state.conversationHistory) {
        const r = (msg.role === 'user') ? 'user' : 'model';
        if (r === expectedRole) {
          validContents.push({ role: r, parts: [{ text: msg.content }] });
          expectedRole = (expectedRole === 'user') ? 'model' : 'user';
        }
      }
      if (validContents.length === 0 || validContents[validContents.length - 1].role !== 'user') {
        validContents.push({ role: 'user', parts: [{ text: cleanQ }] });
      }

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(state.geminiApiKey.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: validContents,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiText && geminiText.trim().length > 0) {
          state.conversationHistory.push({ role: 'assistant', content: geminiText.trim() });
          return createAiResultObject(geminiText.trim(), wantsPdf, wantsCalendar);
        }
      } else {
        const errJson = await geminiRes.json().catch(() => ({}));
        const errDetails = errJson.error?.message || `Error ${geminiRes.status}`;
        console.warn('Gemini API error:', errDetails);
        return {
          text: `⚠️ **Aviso de Gemini (${geminiRes.status}):**\n\n${errDetails}\n\n👉 Revisa la clave que pegaste en el icono de **Ajustes ⚙️** (arriba a la derecha).`,
          speechText: 'Hubo un error con la clave de Gemini. Revisa la configuración.'
        };
      }
    } catch (e) {
      console.warn('Gemini network error:', e);
    }
  }

  // 2. INTENTO 2: Pollinations Direct (Sin registro
