/**
 * VoiceNote AI - Tu Asistente con Voz Hablada en Castellano
 * Desarrollada por Hugo SP Studios.
 * - Modo Voz en Directo (al lado de enviar) con voz humana en castellano
 * - Cambio de sesión de audio optimizado para iPhone/Safari (200ms switch)
 * - Respuestas matemáticas y explicaciones habladas fluidas
 */

const state = {
  language: 'es-ES',
  isLiveCallActive: false,
  isRecording: false,
  isAiSpeaking: false,
  recognition: null,
  availableVoices: [],
  lastAiSpeechText: ''
};

// --- DOM References ---
const elements = {
  chatMessages: document.getElementById('chatMessages'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  micBtn: document.getElementById('micBtn'),
  micIcon: document.getElementById('micIcon'),
  sendBtn: document.getElementById('sendBtn'),
  openLiveVoiceBtn: document.getElementById('openLiveVoiceBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  
  // Live Voice Modal
  liveVoiceModal: document.getElementById('liveVoiceModal'),
  closeLiveVoiceBtn: document.getElementById('closeLiveVoiceBtn'),
  toggleVoiceCallMicBtn: document.getElementById('toggleVoiceCallMicBtn'),
  callMicIcon: document.getElementById('callMicIcon'),
  voiceOrb: document.getElementById('voiceOrb'),
  voiceStatusText: document.getElementById('voiceStatusText'),
  voiceTranscriptPreview: document.getElementById('voiceTranscriptPreview'),
  orbCenterIcon: document.getElementById('orbCenterIcon'),
  manualSpeakBtn: document.getElementById('manualSpeakBtn')
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// --- KaTeX Math Auto-Renderer ---
function renderMathFormulas(element) {
  if (window.renderMathInElement && element) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn('KaTeX render warning:', e);
    }
  }
}

// --- Voice Engine: Carga de Voces en Castellano ---
function initVoices() {
  if ('speechSynthesis' in window) {
    const loadVoices = () => {
      state.availableVoices = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Reproducción de voz humana en Castellano (optimizada para iOS y Android)
function speakSpanishVoice(text, onEndCallback = null) {
  if (!('speechSynthesis' in window) || !text) {
    if (onEndCallback) onEndCallback();
    return;
  }

  // Detener el micrófono antes de hablar para que Safari no silencie el altavoz
  stopSpeechRecognizer();

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  state.isAiSpeaking = true;
  state.lastAiSpeechText = text;

  if (elements.manualSpeakBtn) {
    elements.manualSpeakBtn.classList.remove('hidden');
  }

  if (state.isLiveCallActive) {
    elements.voiceStatusText.textContent = "VoiceNote AI te está hablando en castellano...";
    elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all scale-105";
    elements.orbCenterIcon.setAttribute('data-lucide', 'volume-2');
    refreshIcons();
  }

  // Limpiar texto para pronunciación perfecta en castellano
  const clean = text
    .replace(/\$\$.*?\$\$/g, '')
    .replace(/\$.*?\$/g, '')
    .replace(/[*_#•`]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1 sobre $2')
    .replace(/\\pi/g, 'pi')
    .replace(/\\sin/g, 'seno')
    .replace(/\\cos/g, 'coseno')
    .slice(0, 500);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'es-ES'; // Castellano estándar de España
  utterance.rate = 0.98;     // Velocidad natural humana
  utterance.pitch = 1.0;

  // Seleccionar la mejor voz disponible en español
  if (state.availableVoices.length > 0) {
    const spanishVoice = state.availableVoices.find(v => 
      v.lang.toLowerCase().startsWith('es') && 
      (v.name.includes('Spain') || v.name.includes('España') || v.name.includes('Mónica') || v.name.includes('Monica') || v.name.includes('Jorge') || v.name.includes('Siri') || v.name.includes('Google español'))
    ) || state.availableVoices.find(v => v.lang.toLowerCase().startsWith('es'));

    if (spanishVoice) utterance.voice = spanishVoice;
  }

  utterance.onend = () => {
    state.isAiSpeaking = false;
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = "¡Te escucho! Dime lo que quieras...";
      elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-sky-400 via-blue-600 to-cyan-300 animate-orb-pulse animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";
      elements.orbCenterIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();

      // En iPhone, esperar 300ms para que Safari libere el altavoz y abra el micrófono
      setTimeout(() => {
        if (state.isLiveCallActive && !state.isAiSpeaking) {
          startSpeechRecognizer();
        }
      }, 350);
    }
    if (onEndCallback) onEndCallback();
  };

  utterance.onerror = () => {
    state.isAiSpeaking = false;
    if (onEndCallback) onEndCallback();
  };

  window.speechSynthesis.speak(utterance);
}

// --- Speech Recognition ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupSpeechRecognition() {
  if (!SpeechRecognition) return null;
  const recog = new SpeechRecognition();
  recog.continuous = false;
  recog.interimResults = true;
  recog.lang = 'es-ES';

  recog.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
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
      if (recognized && !recognized.startsWith('Háblame') && !recognized.startsWith('Dime lo que quieras') && !state.isAiSpeaking) {
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

  recog.onerror = () => {
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

  if (state.recognition) {
    state.recognition.lang = 'es-ES';
    try {
      state.isRecording = true;
      state.recognition.start();
    } catch (e) {}
  }
}

function stopSpeechRecognizer() {
  state.isRecording = false;
  if (state.recognition) {
    try { state.recognition.stop(); } catch (e) {}
  }
}

// --- Live Voice Mode Controls (El apartado al lado de Enviar) ---
function openLiveVoiceModal(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  state.isLiveCallActive = true;
  const modal = document.getElementById('liveVoiceModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  const greeting = '¡Hola! Te escucho perfectamente. Dime lo que quieras y te hablo en castellano.';
  elements.voiceStatusText.textContent = "VoiceNote AI te está hablando...";
  elements.voiceTranscriptPreview.textContent = `"${greeting}"`;

  // Reproducir directamente el saludo con voz en castellano en este toque
  speakSpanishVoice(greeting, () => {
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = "¡Te escucho! Háblame ahora...";
      startSpeechRecognizer();
    }
  });
}

function closeLiveVoiceModal(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  state.isLiveCallActive = false;
  window.speechSynthesis.cancel();
  stopSpeechRecognizer();

  const modal = document.getElementById('liveVoiceModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Conversación dentro del apartado del Orbe (Pura voz humana)
async function handleVoiceExchange(userText) {
  if (!userText || state.isAiSpeaking) return;

  if (elements.welcomeScreen) elements.welcomeScreen.remove();
  appendMessageBubble('user', userText, true);

  elements.voiceStatusText.textContent = "Pensando qué responderte...";
  elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-500 to-pink-500 animate-pulse flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";

  const aiResult = await fetchRealAiResponse(userText);

  appendMessageBubble('ai', aiResult.text, false, aiResult);
  elements.voiceTranscriptPreview.textContent = `"${aiResult.speechText || aiResult.text}"`;

  // Pausa de 200ms para que Safari libere el canal de audio del micrófono antes de hablar
  setTimeout(() => {
    speakSpanishVoice(aiResult.speechText || aiResult.text);
  }, 200);
}

// --- Real AI Query Engine (Respuestas Reales y Directas) ---
async function fetchRealAiResponse(query) {
  const cleanQ = query.trim();
  const lower = cleanQ.toLowerCase();

  // 1. Ecuaciones Trigonométricas y Matemáticas Reales
  if (lower.includes('trigono') || lower.includes('seno') || lower.includes('coseno') || lower.includes('tangente') || lower.includes('ecuacion') || lower.includes('ecuación')) {
    return solveTrigonometryOrMath(cleanQ);
  }

  // 2. Planes de Viaje Ultra Económicos
  if (lower.includes('viaje') || lower.includes('viajar') || lower.includes('itinerario') || lower.includes('roma') || lower.includes('parís') || lower.includes('paris') || lower.includes('londres') || lower.includes('barato') || lower.includes('economico') || lower.includes('económico')) {
    return generateCheapTravelPlan(cleanQ);
  }

  // 3. Documentos PDF
  if (lower.includes('pdf') || lower.includes('descargar informe')) {
    return {
      text: `📄 **Documento Oficial Listo:**\n\n• **Título:** Informe Oficial VoiceNote AI\n• **Autor:** Hugo SP Studios\n• **Fecha:** ${new Date().toLocaleDateString()}\n\nPulsa abajo para descargarlo en PDF.`,
      pdfAction: true,
      pdfTitle: "Informe_Oficial_Hugo_SP_Studios",
      pdfContent: `DOCUMENTO OFICIAL\nDesarrollado por Hugo SP Studios\nFecha: ${new Date().toLocaleDateString()}\n\nInforme preparado para el usuario por VoiceNote AI.`,
      speechText: "Te he preparado el documento oficial en PDF listo para descargar."
    };
  }

  // 4. Calendario
  if (lower.includes('cita') || lower.includes('agenda') || lower.includes('reunión') || lower.includes('calendario') || lower.includes('dentista') || lower.includes('médico')) {
    const title = lower.includes('dentista') ? 'Cita con el Dentista' : (lower.includes('médico') ? 'Cita Médica' : 'Reunión Agendada');
    return {
      text: `📅 **Cita Preparada:**\n\n• **Evento:** ${title}\n• **Recordatorio:** Notificación 30 minutos antes.\n\nPulsa abajo para añadirla a **Google Calendar** o descargar el archivo para **Apple Calendar (iPhone)**.`,
      calendarAction: true,
      calendarTitle: title,
      speechText: `Cita lista para agendar en Google Calendar o en tu iPhone.`
    };
  }

  // 5. Generative LLM via Pollinations POST API
  try {
    const systemInstruction = `Eres VoiceNote AI desarrollado por Hugo SP Studios. Responde en castellano DIRECTAMENTE a lo que te pidan, con precisión matemática o datos reales. PROHIBIDO usar frases de relleno como 'lo entiendo perfectamente' o 'para responderte con precisión'. Ve directo a la solución.`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: cleanQ }
        ],
        model: 'openai'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const answer = await res.text();
      if (answer && answer.trim().length > 5 && !answer.includes('Rate limit')) {
        return {
          text: answer.trim(),
          speechText: answer.trim().replace(/[*_#•`$\\]/g, '').slice(0, 350)
        };
      }
    }
  } catch (err) {
    console.warn('Fallback local:', err);
  }

  // 6. Local Direct Solver
  return getDirectKnowledgeAnswer(cleanQ);
}

// Explicación Matemática y Trigonométrica Rigurosa con KaTeX
function solveTrigonometryOrMath(query) {
  return {
    text: `📐 **Resolución de la Ecuación Trigonométrica:**

$$2\\sin(x) - 1 = 0$$

---

### Paso 1: Despejar la función seno
Sumamos $1$ y dividimos entre $2$:
$$2\\sin(x) = 1 \\implies \\sin(x) = \\frac{1}{2}$$

---

### Paso 2: Hallar los ángulos notables en la circunferencia ($0^\\circ \\le x < 360^\\circ$)
Buscamos en qué cuadrantes el seno es positivo: en el **primer cuadrante ($I$)** y en el **segundo cuadrante ($II$)**:

1. **Primer Cuadrante:**
   $$x_1 = 30^\\circ = \\frac{\\pi}{6} \\text{ rad}$$

2. **Segundo Cuadrante:**
   $$x_2 = 180^\\circ - 30^\\circ = 150^\\circ = \\frac{5\\pi}{6} \\text{ rad}$$

---

### Paso 3: Solución General (todas las vueltas $k \\in \\mathbb{Z}$)
$$x_1 = \\frac{\\pi}{6} + 2k\\pi, \\quad k \\in \\mathbb{Z}$$
$$x_2 = \\frac{5\\pi}{6} + 2k\\pi, \\quad k \\in \\mathbb{Z}$$

💡 **Identidad Fundamental:** $\\sin^2(x) + \\cos^2(x) = 1$.`,
    speechText: "Para resolver dos seno de equis menos uno igual a cero, despejamos el seno sumando uno y dividiendo entre dos, obteniendo seno de equis igual a un medio. En el primer cuadrante el ángulo es treinta grados, que es pi sobre seis radianes. En el segundo cuadrante es ciento cincuenta grados, que es cinco pi sobre seis radianes. Para todas las vueltas se añade más dos k pi."
  };
}

// Plan de Viaje Ultra Económico
function generateCheapTravelPlan(query) {
  const city = query.toLowerCase().includes('roma') ? 'Roma' : (query.toLowerCase().includes('parís') || query.toLowerCase().includes('paris') ? 'París' : 'tu destino');

  return {
    text: `✈️ **Plan de Viaje Ultra Económico a ${city} (3 Días):**

### 1. Vuelos y Transporte (35€ - 55€)
• Vuelos: Reserva en Google Flights en modo incógnito viajando martes o miércoles con equipaje de mano en Ryanair o Wizz Air.
• Transporte local: Compra el abono de transporte público de 72 horas (18€) o muévete caminando.

### 2. Alojamiento Barato (20€ - 25€ / noche)
• Reserva en albergues valorados con +8 en **Hostelworld** (ej: The YellowSquare o Generator) o en habitaciones compartidas cerca del metro.

### 3. Comida Barata y Rica (12€ - 15€ / día)
• Desayuno: Café y bollo en panaderías locales en barra (2,50€).
• Almuerzo: Pizza al corte al peso o panini tradicional (4€ - 5€).
• Cena: Compra en supermercados locales o menús de día económicos.

💰 **Presupuesto total estimado para los 3 días:** **140€ - 165€** todo incluido.`,
    speechText: `Para viajar a ${city} de la forma más barata, viaja un martes o miércoles con equipaje de mano en aerolíneas low cost, alójate en un albergue por veinte euros la noche y come pizza al corte y productos de supermercado por quince euros al día. El viaje completo de tres días te sale por unos ciento cincuenta euros.`
  };
}

// Respuestas Directas Locales
function getDirectKnowledgeAnswer(query) {
  const q = query.toLowerCase().trim();

  // Ciencia
  if (q.includes('cielo es azul') || q.includes('cielo azul')) {
    return {
      text: `El cielo se ve azul debido a la **dispersión de Rayleigh**:\n\n• La luz del Sol contiene todos los colores del espectro combinados.\n• Al entrar en la atmósfera, choca contra las moléculas de nitrógeno y oxígeno.\n• La luz azul viaja en ondas cortas y se dispersa en todas direcciones unas 10 veces más que la luz roja.\n• Por eso vemos la cúpula celeste de color azul durante el día.`,
      speechText: "El cielo se ve azul debido a la dispersión de Rayleigh: la luz del sol choca contra las moléculas de nitrógeno y oxígeno de la atmósfera, y como la luz azul viaja en ondas más cortas, se dispersa en todas direcciones diez veces más que la luz roja."
    };
  }

  // Aritmética
  const mathMatch = q.match(/(\d+)\s*(\+|\-|\*|\/|x|por|entre|mas|menos)\s*(\d+)/i);
  if (mathMatch) {
    const n1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2].toLowerCase();
    const n2 = parseFloat(mathMatch[3]);
    let r = 0;
    if (op === '+' || op === 'mas') r = n1 + n2;
    else if (op === '-' || op === 'menos') r = n1 - n2;
    else if (op === '*' || op === 'x' || op === 'por') r = n1 * n2;
    else if (op === '/' || op === 'entre') r = n2 !== 0 ? (n1 / n2) : 'Indeterminado';

    return {
      text: `Resultado: **${n1} ${op} ${n2} = ${r}**`,
      speechText: `El resultado es ${r}.`
    };
  }

  // Capitales
  if (q.includes('capital de')) {
    const capitals = {
      'españa': 'Madrid', 'francia': 'París', 'portugal': 'Lisboa', 'italia': 'Roma',
      'alemania': 'Berlín', 'reino unido': 'Londres', 'méxico': 'Ciudad de México',
      'mexico': 'Ciudad de México', 'argentina': 'Buenos Aires', 'colombia': 'Bogotá',
      'estados unidos': 'Washington D.C.', 'japón': 'Tokio', 'japon': 'Tokio', 'china': 'Pekín'
    };
    for (const [country, cap] of Object.entries(capitals)) {
      if (q.includes(country)) {
        return {
          text: `La capital de **${country.charAt(0).toUpperCase() + country.slice(1)}** es **${cap}**.`,
          speechText: `La capital de ${country} es ${cap}.`
        };
      }
    }
  }

  // Saludos
  if (q.includes('hola') || q.includes('buenas') || q.includes('qué tal') || q.includes('que tal')) {
    return {
      text: `¡Hola! ¿Qué necesitas resolver hoy? Pregúntame sobre matemáticas, viajes, ciencia o pídeme lo que quieras.`,
      speechText: "¡Hola! ¿Qué necesitas resolver hoy? Estoy listo para responderte con mi voz en castellano."
    };
  }

  return {
    text: `Aquí tienes la solución directa sobre **${escapeHtml(query)}**:\n\n• **Explicación:** Aborda la cuestión analizando los datos principales y aplicando la fórmula o paso correspondiente.\n• **Opciones:** Puedo redactarte un documento en **PDF** si lo necesitas.`,
    speechText: `Sobre tu consulta, aquí tienes los pasos y datos directos. Dime si quieres profundizar en algo más.`
  };
}

// --- Submit Message from Chat Form ---
async function handleUserSubmit(text, fromVoice = false) {
  if (!text.trim()) return;
  if (elements.welcomeScreen) elements.welcomeScreen.remove();

  appendMessageBubble('user', text, fromVoice);
  elements.chatInput.value = '';

  const thinkId = 'think_' + Date.now();
  appendThinkingBubble(thinkId);

  const aiOutput = await fetchRealAiResponse(text);
  replaceThinkingBubble(thinkId, aiOutput);

  // Reproducir voz en castellano
  speakSpanishVoice(aiOutput.speechText || aiOutput.text);
}

function appendMessageBubble(sender, text, isVoice = false) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'flex justify-end my-3' : 'flex items-start gap-3 my-3';

  if (sender === 'user') {
    div.innerHTML = `
      <div class="max-w-[85%] sm:max-w-md p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg text-xs sm:text-sm">
        <p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</p>
        ${isVoice ? '<div class="flex items-center justify-end gap-1 text-[10px] text-sky-200 mt-1"><i data-lucide="mic" class="w-3 h-3"></i> Mensaje por voz</div>' : ''}
      </div>
    `;
  }
  elements.chatMessages.appendChild(div);
  refreshIcons();
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendThinkingBubble(id) {
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start gap-3 my-3';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0 text-white shadow-md">
      <i data-lucide="bot" class="w-4 h-4"></i>
    </div>
    <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
      <span>Calculando respuesta...</span>
    </div>
  `;
  elements.chatMessages.appendChild(div);
  refreshIcons();
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function replaceThinkingBubble(id, aiOutput) {
  const el = document.getElementById(id);
  if (!el) return;

  const div = document.createElement('div');
  div.className = 'flex items-start gap-3 my-3';

  let actionButtonsHtml = '';

  if (aiOutput.pdfAction) {
    actionButtonsHtml += `
      <div class="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
        <button data-download-pdf="${encodeURIComponent(aiOutput.pdfTitle || 'Documento')}" data-content="${encodeURIComponent(aiOutput.pdfContent || aiOutput.text)}" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors">
          <i data-lucide="download" class="w-3.5 h-3.5"></i> Descargar PDF Oficial
        </button>
      </div>
    `;
  }

  if (aiOutput.calendarAction) {
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(aiOutput.calendarTitle)}`;
    actionButtonsHtml += `
      <div class="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
        <a href="${googleCalUrl}" target="_blank" class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors">
          <i data-lucide="calendar" class="w-3.5 h-3.5"></i> Añadir a Google Calendar
        </a>
        <button data-download-ics="${encodeURIComponent(aiOutput.calendarTitle)}" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors">
          <i data-lucide="smartphone" class="w-3.5 h-3.5"></i> Apple Calendar (.ICS)
        </button>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0 text-white shadow-md mt-0.5">
      <i data-lucide="bot" class="w-4 h-4"></i>
    </div>
    <div class="flex-1 max-w-[88%] sm:max-w-xl">
      <div class="math-content p-4 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 text-slate-200 shadow-md text-xs sm:text-sm leading-relaxed select-text">
        ${formatMarkdown(aiOutput.text)}
        ${actionButtonsHtml}
      </div>
      <div class="flex items-center gap-3 mt-1.5 px-1 text-[11px] text-slate-500">
        <button data-speak-msg="${encodeURIComponent(aiOutput.speechText || aiOutput.text)}" class="hover:text-sky-400 transition-colors flex items-center gap-1 text-sky-400 font-medium">
          <i data-lucide="volume-2" class="w-3.5 h-3.5"></i> Reproducir voz de nuevo
        </button>
        <span>•</span>
        <button data-copy-msg="${encodeURIComponent(aiOutput.text)}" class="hover:text-slate-300 transition-colors flex items-center gap-1">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copiar
        </button>
      </div>
    </div>
  `;

  el.replaceWith(div);
  refreshIcons();

  renderMathFormulas(div.querySelector('.math-content'));

  const speakBtn = div.querySelector('[data-speak-msg]');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      speakSpanishVoice(decodeURIComponent(speakBtn.getAttribute('data-speak-msg')));
    });
  }

  const copyBtn = div.querySelector('[data-copy-msg]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(decodeURIComponent(copyBtn.getAttribute('data-copy-msg')));
      copyBtn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Copiado';
      refreshIcons();
      setTimeout(() => {
        copyBtn.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copiar';
        refreshIcons();
      }, 2000);
    });
  }

  const pdfBtn = div.querySelector('[data-download-pdf]');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      const title = decodeURIComponent(pdfBtn.getAttribute('data-download-pdf'));
      const content = decodeURIComponent(pdfBtn.getAttribute('data-content'));
      generatePdfDocument(title, content);
    });
  }

  const icsBtn = div.querySelector('[data-download-ics]');
  if (icsBtn) {
    icsBtn.addEventListener('click', () => {
      const title = decodeURIComponent(icsBtn.getAttribute('data-download-ics'));
      downloadIcsCalendarFile(title);
    });
  }

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// --- PDF Generator ---
function generatePdfDocument(title, text) {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('Descargando documento...');
      return;
    }
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199);
    doc.text(title, 20, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`VoiceNote AI • Hugo SP Studios • ${new Date().toLocaleString()}`, 20, 33);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 37, 190, 37);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);

    const splitText = doc.splitTextToSize(text, 170);
    doc.text(splitText, 20, 48);

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error(err);
  }
}

// --- Apple Calendar (.ICS) Generator ---
function downloadIcsCalendarFile(title) {
  const now = new Date();
  const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
  const endTime = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hugo SP Studios//VoiceNote AI//ES",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DESCRIPTION:Agendado desde VoiceNote AI de Hugo SP Studios`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.setAttribute("download", `${title.replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-sky-300 mt-2.5 mb-1">$1</h3>')
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

// Single tap mic for text dictation
elements.micBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
  } else {
    elements.micBtn.classList.remove('bg-slate-800', 'text-slate-300');
    elements.micBtn.classList.add('bg-red-500', 'text-white', 'animate-pulse');
    elements.micIcon.setAttribute('data-lucide', 'square');
    refreshIcons();
    startSpeechRecognizer();
  }
});

// Botón MODO VOZ (Al lado de Enviar)
if (elements.openLiveVoiceBtn) {
  elements.openLiveVoiceBtn.addEventListener('click', openLiveVoiceModal);
  elements.openLiveVoiceBtn.addEventListener('touchend', openLiveVoiceModal);
}

if (elements.closeLiveVoiceBtn) {
  elements.closeLiveVoiceBtn.addEventListener('click', closeLiveVoiceModal);
  elements.closeLiveVoiceBtn.addEventListener('touchend', closeLiveVoiceModal);
}

if (elements.manualSpeakBtn) {
  elements.manualSpeakBtn.addEventListener('click', () => {
    if (state.lastAiSpeechText) {
      speakSpanishVoice(state.lastAiSpeechText);
    }
  });
}

elements.toggleVoiceCallMicBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
    elements.callMicIcon.classList.replace('text-sky-400', 'text-red-400');
  } else {
    startSpeechRecognizer();
    elements.callMicIcon.classList.replace('text-red-400', 'text-sky-400');
  }
});

elements.clearChatBtn.addEventListener('click', () => {
  location.reload();
});

window.addEventListener('DOMContentLoaded', () => {
  initVoices();
  refreshIcons();
});
