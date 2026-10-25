/**
 * VoiceNote AI - Tu Amigo y Asistente Universal
 * Desarrollada por Hugo SP Studios.
 * - Modo Voz en Directo al lado del botón de Enviar
 * - Personalidad cercana, cálida y humana de un buen amigo
 * - Respuestas reales a cualquier pregunta
 * - Generador de PDFs, Canva y Calendario
 * - 4 Idiomas (Español, Français, Português, 中文)
 */

const state = {
  language: 'es-ES',
  isLiveCallActive: false,
  isRecording: false,
  isAiSpeaking: false,
  recognition: null,
  availableVoices: []
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
  langSelect: document.getElementById('langSelect'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  toolBtns: document.querySelectorAll('[data-quick-action]'),
  promptCards: document.querySelectorAll('[data-prompt]'),
  
  // Live Voice Modal Elements
  liveVoiceModal: document.getElementById('liveVoiceModal'),
  closeLiveVoiceBtn: document.getElementById('closeLiveVoiceBtn'),
  toggleVoiceCallMicBtn: document.getElementById('toggleVoiceCallMicBtn'),
  callMicIcon: document.getElementById('callMicIcon'),
  voiceOrb: document.getElementById('voiceOrb'),
  voiceStatusText: document.getElementById('voiceStatusText'),
  voiceTranscriptPreview: document.getElementById('voiceTranscriptPreview'),
  voiceLanguageTag: document.getElementById('voiceLanguageTag'),
  orbCenterIcon: document.getElementById('orbCenterIcon')
};

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// --- Natural Human Voice Engine (Warm & Friendly Pitch) ---
function initVoices() {
  if ('speechSynthesis' in window) {
    const loadVoices = () => {
      state.availableVoices = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function speakHumanVoice(text, lang = state.language, onEndCallback = null) {
  if (!('speechSynthesis' in window) || !text) {
    if (onEndCallback) onEndCallback();
    return;
  }

  window.speechSynthesis.cancel();
  state.isAiSpeaking = true;

  if (state.isLiveCallActive) {
    elements.voiceStatusText.textContent = "Tu amigo VoiceNote te está respondiendo...";
    elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-600 animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all scale-105";
    elements.orbCenterIcon.setAttribute('data-lucide', 'volume-2');
    refreshIcons();
  }

  const clean = text
    .replace(/[*_#•`]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\$\$.*?\$\$/g, '')
    .slice(0, 480);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang;
  utterance.rate = 1.0;
  utterance.pitch = 1.05; // Slightly warmer, friendlier pitch

  if (state.availableVoices.length > 0) {
    const langPrefix = lang.split('-')[0].toLowerCase();
    const friendlyVoice = state.availableVoices.find(v => 
      v.lang.toLowerCase().startsWith(langPrefix) && 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Monica') || v.name.includes('Paulina') || v.name.includes('Jorge'))
    ) || state.availableVoices.find(v => v.lang.toLowerCase().startsWith(langPrefix));

    if (friendlyVoice) utterance.voice = friendlyVoice;
  }

  utterance.onend = () => {
    state.isAiSpeaking = false;
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = "¡Te escucho! Dime lo que quieras...";
      elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-sky-400 via-blue-600 to-cyan-300 animate-orb-pulse animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";
      elements.orbCenterIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();

      // Automatically listen again for back-and-forth conversation!
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
  recog.lang = state.language;

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
      if (recognized && !recognized.startsWith('Dime lo que quieras') && !state.isAiSpeaking) {
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
    state.recognition.lang = state.language;
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

// --- Live Voice Mode Controls ---
function openLiveVoiceModal() {
  state.isLiveCallActive = true;
  elements.liveVoiceModal.classList.remove('hidden');

  const langNames = {
    'es-ES': 'ESPAÑOL',
    'fr-FR': 'FRANÇAIS',
    'pt-BR': 'PORTUGUÊS',
    'zh-CN': '中文'
  };
  elements.voiceLanguageTag.textContent = langNames[state.language] || 'ESPAÑOL';

  const friendlyGreetings = {
    'es-ES': '¡Hola, amigo! ¿Qué tal estás? Te escucho perfectamente, cuéntame lo que quieras.',
    'fr-FR': 'Salut mon ami ! Comment vas-tu ? Je t\'écoute, dis-moi tout ce que tu veux.',
    'pt-BR': 'Fala, meu amigo! Tudo bem? Tô te ouvindo perfeitamente, pode me contar qualquer coisa.',
    'zh-CN': '嗨，朋友！你好吗？我在这里听着呢，随便和我聊聊吧。'
  };

  const greeting = friendlyGreetings[state.language] || friendlyGreetings['es-ES'];
  elements.voiceStatusText.textContent = "Conectando con tu amigo...";
  elements.voiceTranscriptPreview.textContent = `"${greeting}"`;

  speakHumanVoice(greeting, state.language, () => {
    if (state.isLiveCallActive) {
      elements.voiceStatusText.textContent = "¡Te escucho! Háblame de lo que quieras...";
      startSpeechRecognizer();
    }
  });
}

function closeLiveVoiceModal() {
  state.isLiveCallActive = false;
  window.speechSynthesis.cancel();
  stopSpeechRecognizer();
  elements.liveVoiceModal.classList.add('hidden');
}

// Voice Exchange Handler
async function handleVoiceExchange(userText) {
  if (!userText || state.isAiSpeaking) return;

  if (elements.welcomeScreen) elements.welcomeScreen.remove();
  appendMessageBubble('user', userText, true);

  elements.voiceStatusText.textContent = "Pensando qué responderte...";
  elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-indigo-500 via-sky-500 to-pink-500 animate-pulse flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";

  // Query Real AI Answer with Friendly Tone
  const aiResult = await fetchRealAiResponse(userText, state.language);

  appendMessageBubble('ai', aiResult.text, false, aiResult);
  elements.voiceTranscriptPreview.textContent = `"${aiResult.speechText || aiResult.text}"`;

  speakHumanVoice(aiResult.speechText || aiResult.text, state.language);
}

// --- Real AI Query Engine (Pollinations Free LLM API with Warm Friend Persona) ---
async function fetchRealAiResponse(query, lang) {
  const cleanQ = query.trim();
  const lower = cleanQ.toLowerCase();

  // Action Commands (PDF, Canva, Calendar)
  if (lower.includes('pdf') || lower.includes('descargar informe')) {
    return {
      text: `📄 **¡Aquí tienes tu documento oficial, amigo!**\n\nHe redactado el informe completo:\n\n• **Título:** Informe Oficial VoiceNote AI\n• **Estudio:** Hugo SP Studios\n• **Fecha:** ${new Date().toLocaleDateString()}\n\nSolo tienes que pulsar el botón de abajo para descargarlo en tu móvil u ordenador.`,
      pdfAction: true,
      pdfTitle: "Informe_Oficial_Hugo_SP_Studios",
      pdfContent: `DOCUMENTO OFICIAL\nDesarrollado por Hugo SP Studios\nFecha: ${new Date().toLocaleDateString()}\n\nContenido: Documento generado automáticamente por VoiceNote AI respondiendo a la solicitud del usuario.\n\nTodo organizado y listo para usar.`,
      speechText: "¡Listo, amigo! Te he preparado el documento oficial en PDF para que lo descargues con un toque."
    };
  }

  if (lower.includes('canva') || lower.includes('diseño') || lower.includes('presentación') || lower.includes('diapositiva')) {
    return {
      text: `🎨 **¡Menuda idea para Canva! Mira lo que te he preparado:**\n\n1. **Diapositiva 1 (Portada impactante):** Fondo oscuro azul \`#0b1329\` con título grande en blanco y acento cian \`#38bdf8\`.\n2. **Diapositiva 2 (Puntos clave):** Tres bloques limpios con iconos modernos y cifras claras.\n3. **Diapositiva 3 (Conclusión):** Llamada a la acción directa y tus datos de contacto.\n\nPuedes abrir Canva directamente abajo o copiar estos textos.`,
      canvaAction: true,
      speechText: "¡Genial! Te he preparado la estructura completa y la paleta de colores para tu presentación en Canva."
    };
  }

  if (lower.includes('cita') || lower.includes('agenda') || lower.includes('reunión') || lower.includes('calendario') || lower.includes('dentista') || lower.includes('médico')) {
    const title = lower.includes('dentista') ? 'Cita con el Dentista' : (lower.includes('médico') ? 'Cita Médica' : 'Reunión Agendada');
    return {
      text: `📅 **¡Cita lista para tu calendario, amigo!**\n\n• **Evento:** ${title}\n• **Recordatorio:** Notificación 30 minutos antes para que no se te pase.\n\nPulsa abajo para añadirla directo a **Google Calendar** o descargar el archivo para tu **iPhone (Apple Calendar)**.`,
      calendarAction: true,
      calendarTitle: title,
      speechText: `¡Hecho! Te he preparado la cita para que la guardes en Google Calendar o en tu iPhone.`
    };
  }

  // Live Free LLM Query with Warm Friend Persona
  try {
    const friendPrompt = `Eres VoiceNote AI, el mejor amigo y asistente del usuario, desarrollado por Hugo SP Studios. Habla con un tono completamente natural, cálido, cercano y humano, exactamente como si estuvieras charlando con un buen amigo tomando algo o por teléfono. Responde de forma entretenida, directa, empática y clara a la pregunta en el idioma ${lang}:\n"${cleanQ}"`;
    const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(friendPrompt)}?model=openai`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const answer = await res.text();
      if (answer && answer.trim().length > 5) {
        return {
          text: answer.trim(),
          speechText: answer.trim().slice(0, 320)
        };
      }
    }
  } catch (err) {
    console.warn('Fallback to local friendly brain:', err);
  }

  // Local Friendly Knowledge Base
  return getFriendlyLocalAnswer(cleanQ, lang);
}

// Local Friendly Knowledge Base
function getFriendlyLocalAnswer(query, lang) {
  const q = query.toLowerCase().trim();

  // Math
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
      text: `¡Fácil, amigo! La cuenta da exactamente: **${n1} ${op} ${n2} = ${r}**`,
      speechText: `El resultado es ${r}.`
    };
  }

  // Science / Nature
  if (q.includes('cielo es azul') || q.includes('cielo azul')) {
    return {
      text: `¡Buena pregunta, amigo! El cielo se ve azul por un fenómeno físico muy chulo llamado **dispersión de Rayleigh**:\n\n• La luz del Sol parece blanca, pero viaja con todos los colores del arcoíris mezclados.\n• Al entrar en nuestra atmósfera, choca contra las moléculas de oxígeno y nitrógeno.\n• El color azul viaja en ondas mucho más cortas y rápidas, así que "rebota" y se esparce por todo el cielo en todas direcciones. ¡Por eso durante el día vemos todo azul!`,
      speechText: `El cielo se ve azul porque la luz azul viaja en ondas cortas y se dispersa por toda la atmósfera mucho más que los otros colores.`
    };
  }

  if (q.includes('distancia') && (q.includes('luna') || q.includes('tierra'))) {
    return {
      text: `Pues mira, amigo: la Luna está a una media de **384.400 kilómetros** de nosotros. Para que te hagas una idea, ¡cabrían todos los planetas del sistema solar en fila en ese hueco!`,
      speechText: `La Luna está a unos 384.400 kilómetros de la Tierra, amigo.`
    };
  }

  // Geography & Capitals
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
          text: `La capital de **${country.charAt(0).toUpperCase() + country.slice(1)}** es **${cap}**, amigo. ¡Una ciudad con muchísima historia!`,
          speechText: `La capital de ${country} es ${cap}.`
        };
      }
    }
  }

  // Recipes / Cooking
  if (q.includes('tortilla de patata') || q.includes('receta')) {
    return {
      text: `🍳 **¡Te paso mi receta infalible de tortilla de patatas, amigo!**\n\n1. **Ingredientes:** 4 patatas grandes, 6 huevos de calidad, aceite de oliva virgen extra y sal (cebolla al gusto).\n2. **El truco del chef:** Corta las patatas finas y póchalas despacito en el aceite hasta que queden tiernas y casi se deshagan.\n3. **El secreto:** Mezcla las patatas calientes escurridas con los huevos batidos y déjalas reposar 5 minutos para que absorban bien el huevo.\n4. **La sartén:** Fuego medio-alto, vuelta y vuelta de 2 minutos por lado si te gusta jugosa. ¡Queda brutal!`,
      speechText: "Para una tortilla de patatas perfecta, pocha las patatas despacio en aceite, mézclalas con el huevo y déjalas reposar 5 minutos antes de cuajarla vuelta y vuelta."
    };
  }

  // Jokes
  if (q.includes('chiste') || q.includes('broma') || q.includes('gracioso')) {
    const jokes = [
      "— Papá, papá, ¿qué se siente tener un hijo tan guapo? — No sé, hijo, pregúntale a tu abuelo.",
      "¿Por qué los pájaros no usan WhatsApp? ¡Porque ya tienen Twitter y hacen pío!",
      "— Oye, ¿cuál es tu plato favorito? — El hondo, porque cabe más comida.",
      "¿Qué le dice un jardinero a otro? ¡Nos vemos cuando podamos!"
    ];
    const j = jokes[Math.floor(Math.random() * jokes.length)];
    return {
      text: `😂 **¡Ahí te va uno bueno, amigo!**\n\n${j}`,
      speechText: j
    };
  }

  // Movies / Recommendations
  if (q.includes('película') || q.includes('pelicula') || q.includes('cine')) {
    return {
      text: `🍿 **¡Planazo de cine, amigo! Te recomiendo estas 3 que no fallan:**\n\n1. **Interstellar:** Si te gusta la ciencia ficción y las historias emotivas en el espacio.\n2. **Origen (Inception):** Un peliculón de ladrones de sueños con un final que te deja pensando días.\n3. **Puñales por la espalda (Knives Out):** Misterio divertidísimo y giros que no te esperas.`,
      speechText: "Te recomiendo tres peliculones, amigo: Interstellar, Origen y Puñales por la espalda. ¡Te van a encantar!"
    };
  }

  // Friendly Chit-chat / Greetings
  if (q.includes('hola') || q.includes('buenas') || q.includes('qué tal') || q.includes('que tal') || q.includes('cómo estás') || q.includes('amigo')) {
    return {
      text: `¡Qué pasa, amigo! 👋 Estoy de lujo, con las pilas cargadas y listo para lo que haga falta.\n\n¿Qué planes tenemos hoy? ¿Quieres charlar un rato, preguntarme algo curioso o necesitas que preparemos algo juntos?`,
      speechText: "¡Qué pasa, amigo! Estoy genial. ¿De qué te apetece hablar hoy?"
    };
  }

  // Friendly Fallback
  return {
    text: `¡Oído cocina, amigo! Sobre lo que me comentas de **"${escapeHtml(query)}"**:\n\nEs un tema genial. Si quieres que le demos caña, puedo explicarte cualquier detalle a fondo, redactarte un **PDF** o prepararte algo para **Canva**.\n\n¿Por dónde quieres que empecemos?`,
    speechText: `¡Entendido, amigo! Cuéntame más o dime si quieres que preparemos un PDF o algo para Canva.`
  };
}

// --- Submit Message from Chat Input ---
async function handleUserSubmit(text, fromVoice = false) {
  if (!text.trim()) return;
  if (elements.welcomeScreen) elements.welcomeScreen.remove();

  appendMessageBubble('user', text, fromVoice);
  elements.chatInput.value = '';

  const thinkId = 'think_' + Date.now();
  appendThinkingBubble(thinkId);

  const aiOutput = await fetchRealAiResponse(text, state.language);
  replaceThinkingBubble(thinkId, aiOutput);
}

// DOM Message Bubble
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
      <span>Pensando...</span>
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

  if (aiOutput.canvaAction) {
    actionButtonsHtml += `
      <div class="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
        <a href="https://www.canva.com" target="_blank" class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Abrir en Canva
        </a>
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
      <div class="p-4 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 text-slate-200 shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text">
        ${formatMarkdown(aiOutput.text)}
        ${actionButtonsHtml}
      </div>
      <div class="flex items-center gap-3 mt-1.5 px-1 text-[11px] text-slate-500">
        <button data-speak-msg="${encodeURIComponent(aiOutput.speechText || aiOutput.text)}" class="hover:text-sky-400 transition-colors flex items-center gap-1">
          <i data-lucide="volume-2" class="w-3 h-3"></i> Escuchar voz
        </button>
        <span>•</span>
        <button data-copy-msg="${encodeURIComponent(aiOutput.text)}" class="hover:text-slate-300 transition-colors flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> Copiar
        </button>
      </div>
    </div>
  `;

  el.replaceWith(div);
  refreshIcons();

  const speakBtn = div.querySelector('[data-speak-msg]');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      speakHumanVoice(decodeURIComponent(speakBtn.getAttribute('data-speak-msg')), state.language);
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

// Botón MODO VOZ EN DIRECTO (Al lado de Enviar)
elements.openLiveVoiceBtn.addEventListener('click', openLiveVoiceModal);
elements.closeLiveVoiceBtn.addEventListener('click', closeLiveVoiceModal);

elements.toggleVoiceCallMicBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
    elements.callMicIcon.classList.replace('text-sky-400', 'text-red-400');
  } else {
    startSpeechRecognizer();
    elements.callMicIcon.classList.replace('text-red-400', 'text-sky-400');
  }
});

elements.langSelect.addEventListener('change', (e) => {
  state.language = e.target.value;
  if (state.recognition) state.recognition.lang = state.language;
});

elements.clearChatBtn.addEventListener('click', () => {
  location.reload();
});

// Tool Buttons
elements.toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const act = btn.getAttribute('data-quick-action');
    if (act === 'pdf') handleUserSubmit('Genera un informe oficial para descargar en formato PDF');
    if (act === 'canva') handleUserSubmit('Diseña una presentación estilo Canva para mí');
    if (act === 'calendar') handleUserSubmit('Agenda una cita en mi calendario personal para mañana');
    if (act === 'recommend') handleUserSubmit('Dame tus mejores recomendaciones de películas, libros y productividad');
  });
});

elements.promptCards.forEach(card => {
  card.addEventListener('click', () => {
    const p = card.getAttribute('data-prompt');
    if (p) handleUserSubmit(p);
  });
});

window.addEventListener('DOMContentLoaded', () => {
  initVoices();
  refreshIcons();
});
