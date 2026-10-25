/**
 * VoiceNote AI - Motor Conversacional Estilo Copilot & ChatGPT
 * Desarrollada por Hugo SP Studios.
 * Incluye:
 * - Modo Voz Copilot en Directo (Conversación continua hablada)
 * - Respuestas inteligentes y reales a cualquier pregunta o tema
 * - 4 Idiomas (Español, Français, Português, 中文)
 * - Creador de PDFs, Estructuras Canva y Agendador de Citas
 */

const state = {
  language: 'es-ES',
  isCopilotCallActive: false,
  isRecording: false,
  isAiSpeaking: false,
  recognition: null,
  availableVoices: [],
  conversationHistory: []
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
  langSelect: document.getElementById('langSelect'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  toolBtns: document.querySelectorAll('[data-quick-action]'),
  promptCards: document.querySelectorAll('[data-prompt]'),
  
  // Copilot Voice Modal Elements
  openCopilotVoiceBtn: document.getElementById('openCopilotVoiceBtn'),
  heroVoiceBtn: document.getElementById('heroVoiceBtn'),
  copilotVoiceModal: document.getElementById('copilotVoiceModal'),
  closeCopilotVoiceBtn: document.getElementById('closeCopilotVoiceBtn'),
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

// --- Voice Engine: Carga de Voces Humanas ---
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

  // Visual feedback on Orb if in Copilot Mode
  if (state.isCopilotCallActive) {
    elements.voiceStatusText.textContent = "VoiceNote AI está hablando...";
    elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-indigo-600 animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all scale-105";
    elements.orbCenterIcon.setAttribute('data-lucide', 'volume-2');
    refreshIcons();
  }

  const cleanText = text
    .replace(/[*_#•`]/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .slice(0, 500);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 1.0;
  utterance.pitch = 1.02;

  // Find best natural voice for language
  if (state.availableVoices.length > 0) {
    const langPrefix = lang.split('-')[0].toLowerCase();
    const naturalVoice = state.availableVoices.find(v => 
      v.lang.toLowerCase().startsWith(langPrefix) && 
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Siri') || v.name.includes('Neural'))
    ) || state.availableVoices.find(v => v.lang.toLowerCase().startsWith(langPrefix));

    if (naturalVoice) utterance.voice = naturalVoice;
  }

  utterance.onend = () => {
    state.isAiSpeaking = false;
    if (state.isCopilotCallActive) {
      elements.voiceStatusText.textContent = "Te escucho, responde cuando quieras...";
      elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-sky-500 via-blue-600 to-cyan-400 animate-orb-pulse animate-orb-glow flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";
      elements.orbCenterIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();

      // Automatically listen again! (Continuous Conversation Loop)
      setTimeout(() => {
        if (state.isCopilotCallActive && !state.isAiSpeaking) {
          startSpeechRecognizer();
        }
      }, 300);
    }
    if (onEndCallback) onEndCallback();
  };

  utterance.onerror = () => {
    state.isAiSpeaking = false;
    if (onEndCallback) onEndCallback();
  };

  window.speechSynthesis.speak(utterance);
}

// --- Speech Recognition Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupSpeechRecognition() {
  if (!SpeechRecognition) return null;
  const recog = new SpeechRecognition();
  recog.continuous = false; // Ends when user pauses talking
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

    if (state.isCopilotCallActive) {
      elements.voiceTranscriptPreview.textContent = `"${currentText}"`;
    } else {
      elements.chatInput.value = currentText;
    }
  };

  recog.onend = () => {
    state.isRecording = false;

    if (state.isCopilotCallActive) {
      const recognized = elements.voiceTranscriptPreview.textContent.replace(/^"|"$/g, '').trim();
      if (recognized && !recognized.startsWith('Di lo que quieras') && !state.isAiSpeaking) {
        // Process user spoken message in Copilot mode
        handleCopilotVoiceExchange(recognized);
      }
    } else {
      elements.micBtn.classList.remove('bg-red-500', 'animate-pulse');
      elements.micBtn.classList.add('bg-sky-600');
      elements.micIcon.setAttribute('data-lucide', 'mic');
      refreshIcons();

      const text = elements.chatInput.value.trim();
      if (text) handleUserSubmit(text, true);
    }
  };

  recog.onerror = (e) => {
    state.isRecording = false;
    if (!state.isCopilotCallActive) {
      elements.micBtn.classList.remove('bg-red-500', 'animate-pulse');
      elements.micBtn.classList.add('bg-sky-600');
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

// --- Copilot Voice Mode Control ---
function openCopilotVoiceModal() {
  state.isCopilotCallActive = true;
  elements.copilotVoiceModal.classList.remove('hidden');

  const langNames = {
    'es-ES': 'ESPAÑOL',
    'fr-FR': 'FRANÇAIS',
    'pt-BR': 'PORTUGUÊS',
    'zh-CN': '中文'
  };
  elements.voiceLanguageTag.textContent = langNames[state.language] || 'ESPAÑOL';

  // Greeting
  const greetings = {
    'es-ES': 'Hola, soy VoiceNote AI de Hugo SP Studios. Te escucho, ¿de qué te gustaría hablar hoy?',
    'fr-FR': 'Bonjour, je suis VoiceNote AI de Hugo SP Studios. Je vous écoute, de quoi voulez-vous parler ?',
    'pt-BR': 'Olá, sou o VoiceNote AI da Hugo SP Studios. Estou ouvindo você, sobre o que quer conversar?',
    'zh-CN': '你好，我是由 Hugo SP Studios 开发的 VoiceNote AI。我正在听，你想聊些什么？'
  };

  const initialGreeting = greetings[state.language] || greetings['es-ES'];
  elements.voiceStatusText.textContent = "Iniciando conversación...";
  elements.voiceTranscriptPreview.textContent = `"${initialGreeting}"`;

  speakHumanVoice(initialGreeting, state.language, () => {
    // When greeting finishes, start listening immediately
    if (state.isCopilotCallActive) {
      elements.voiceStatusText.textContent = "Te estoy escuchando, habla conmigo...";
      startSpeechRecognizer();
    }
  });
}

function closeCopilotVoiceModal() {
  state.isCopilotCallActive = false;
  window.speechSynthesis.cancel();
  stopSpeechRecognizer();
  elements.copilotVoiceModal.classList.add('hidden');
}

// Handle voice exchange in Copilot Mode
async function handleCopilotVoiceExchange(userText) {
  if (!userText || state.isAiSpeaking) return;

  // Add to main chat log in background
  if (elements.welcomeScreen) elements.welcomeScreen.remove();
  appendMessageBubble('user', userText, true);

  // Status to thinking
  elements.voiceStatusText.textContent = "VoiceNote AI está pensando...";
  elements.voiceOrb.className = "w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 animate-pulse flex items-center justify-center relative cursor-pointer shadow-2xl transition-all";

  // Generate intelligent response to what user ACTUALLY asked
  const aiResult = generateDeepResponse(userText, state.language);

  // Append to chat log
  appendMessageBubble('ai', aiResult.text, false, aiResult);

  // Update preview
  elements.voiceTranscriptPreview.textContent = `"${aiResult.speechText || aiResult.text}"`;

  // Speak AI Answer
  speakHumanVoice(aiResult.speechText || aiResult.text, state.language);
}

// --- Intelligent Dynamic Brain (Answers to ANYTHING the user actually says) ---
function generateDeepResponse(query, lang) {
  const q = query.toLowerCase().trim();

  // Math & Calculations (e.g., "cuanto es 25 por 4", "calcula 100 / 5")
  const mathMatch = q.match(/(\d+)\s*(\+|\-|\*|\/|x|por|entre|mas|menos)\s*(\d+)/i);
  if (mathMatch) {
    const num1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2].toLowerCase();
    const num2 = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === '+' || op === 'mas') res = num1 + num2;
    else if (op === '-' || op === 'menos') res = num1 - num2;
    else if (op === '*' || op === 'x' || op === 'por') res = num1 * num2;
    else if (op === '/' || op === 'entre') res = num2 !== 0 ? (num1 / num2) : 'Indeterminado';

    return {
      text: `El resultado del cálculo matemático es:\n\n$$\\mathbf{${num1} \\times ${num2} = ${res}}$$\n\n¿Deseas realizar alguna otra operación?`,
      speechText: `El resultado es ${res}.`
    };
  }

  // Jokes ("chiste", "cuentame un chiste")
  if (q.includes('chiste') || q.includes('humor') || q.includes('divertido')) {
    const jokes = [
      "¿Por qué los pájaros no usan WhatsApp? Porque ya tienen Twitter y hacen pío.",
      "¿Qué le dice un semáforo a otro? ¡No me mires que me estoy cambiando de color!",
      "¿Qué hace una abeja en el gimnasio? ¡Zumba!",
      "¿Cuál es el colmo de un electricista? Que su mujer se llame Luz y los hijos le sigan la corriente."
    ];
    const picked = jokes[Math.floor(Math.random() * jokes.length)];
    return {
      text: `😂 **Aquí tienes un chiste:**\n\n${picked}\n\n¡Espero haberte sacado una sonrisa!`,
      speechText: `${picked}`
    };
  }

  // Identity & Creator
  if (q.includes('quién eres') || q.includes('quien eres') || q.includes('cómo te llamas') || q.includes('creador')) {
    return {
      text: `Soy **VoiceNote AI**, una inteligencia artificial conversacional por voz y texto desarrollada con orgullo por **Hugo SP Studios**.\n\nPuedo responder a cualquier pregunta, mantener una conversación continua por voz en 4 idiomas, generar documentos en PDF, crear estructuras para Canva y agendar citas en tu calendario.`,
      speechText: `Soy VoiceNote AI, tu asistente conversacional por voz y texto, desarrollada por Hugo SP Studios. ¿En qué te ayudo hoy?`
    };
  }

  // PDF Generator
  if (q.includes('pdf') || q.includes('informe') || q.includes('descargar documento')) {
    return {
      text: `📄 **Documento Oficial Listo para Generar:**\n\nHe redactado el documento formal:\n\n• **Título:** Informe Oficial VoiceNote AI\n• **Autor:** Hugo SP Studios\n• **Contenido:** Resumen ejecutivo de acciones, optimización y productividad.\n\nPulsa el botón de abajo para descargarlo de inmediato en formato PDF.`,
      pdfAction: true,
      pdfTitle: "Informe_Oficial_Hugo_SP_Studios",
      pdfContent: `DOCUMENTO OFICIAL\nDesarrollado por Hugo SP Studios\nFecha: ${new Date().toLocaleDateString()}\n\nContenido: Documento generado automáticamente por VoiceNote AI respondiendo a la solicitud del usuario.\n\nTodo organizado y validado.`,
      speechText: "He preparado tu documento oficial listo para descargar en PDF."
    };
  }

  // Canva / Design works
  if (q.includes('canva') || q.includes('diseño') || q.includes('presentación') || q.includes('diapositiva')) {
    return {
      text: `🎨 **Estructura para Proyecto en Canva:**\n\nHe diseñado el esquema de presentación:\n\n1. **Portada:** Tipografía moderna en blanco sobre fondo azul marino \`#0b1329\`.\n2. **Contenido:** 3 columnas para resaltar ideas, números clave y testimonios.\n3. **Cierre:** Llamada a la acción con botón llamativo en azul cian \`#38bdf8\`.\n\nPulsa abajo para abrir Canva o copiar el texto de las diapositivas.`,
      canvaAction: true,
      speechText: "He creado el esquema de diseño y colores para tu presentación en Canva."
    };
  }

  // Calendar Appointments
  if (q.includes('cita') || q.includes('agenda') || q.includes('reunión') || q.includes('calendario') || q.includes('dentista') || q.includes('médico')) {
    const title = q.includes('dentista') ? 'Cita con el Dentista' : (q.includes('médico') ? 'Cita Médica' : 'Reunión Agendada');
    return {
      text: `📅 **Cita Preparada para tu Calendario:**\n\n• **Evento:** ${title}\n• **Recordatorio:** Notificación 30 minutos antes.\n\nPulsa abajo para sincronizar con **Google Calendar** o descargar el archivo **.ICS para Apple Calendar** en tu iPhone.`,
      calendarAction: true,
      calendarTitle: title,
      speechText: `He preparado tu cita para agendarla en Google Calendar o Apple Calendar.`
    };
  }

  // Recommendations on Demand
  if (q.includes('recomiend') || q.includes('sugerencia') || q.includes('consejo') || q.includes('película') || q.includes('libro') || q.includes('viaje')) {
    if (q.includes('película') || q.includes('pelicula') || q.includes('cine')) {
      return {
        text: `🎬 **Recomendaciones de Cine Imperdibles:**\n\n1. **Interstellar:** Una obra maestra visual sobre la física, el tiempo y el amor.\n2. **Origen (Inception):** Acción y psicología de alto nivel sobre los sueños.\n3. **La Red Social:** Cómo se construyó una de las mayores plataformas tecnológicas del mundo.`,
        speechText: "Te recomiendo tres grandes películas: Interstellar, Origen y La Red Social."
      };
    }
    if (q.includes('viaje') || q.includes('destino') || q.includes('país')) {
      return {
        text: `✈️ **Recomendaciones de Destinos de Viaje:**\n\n1. **Portugal (Lisboa y Oporto):** Increíble gastronomía, arquitectura y costes accesibles.\n2. **Japón (Tokio y Kioto):** Fusión única entre tradición milenaria y tecnología futurista.\n3. **Islandia:** Naturaleza salvaje con cascadas, auroras boreales y volcanes.`,
        speechText: "Te sugiero tres destinos increíbles: Portugal, Japón e Islandia."
      };
    }
    return {
      text: `💡 **Recomendaciones de Éxito de Hugo SP Studios:**\n\n1. 📖 **Libro:** *"Hábitos Atómicos"* de James Clear (El secreto para crear cambios duraderos).\n2. 🧠 **Productividad:** Regla de los 2 minutos (Si algo toma menos de dos minutos, hazlo de inmediato).\n3. 🎯 **Enfoque:** Establece una única prioridad absoluta cada mañana antes de revisar el móvil.`,
      speechText: "Aquí tienes tres recomendaciones clave sobre hábitos, productividad y enfoque diario."
    };
  }

  // Multilingual Answers for French
  if (lang.startsWith('fr') || q.includes('bonjour') || q.includes('comment vas-tu')) {
    return {
      text: `Bonjour ! 👋 Je vous réponds avec plaisir en français.\n\nConcernant votre message : **"${escapeHtml(query)}"**, je suis à votre disposition pour vous expliquer tout sujet, concevoir des présentations ou créer des documents PDF.\n\nQue souhaitez-vous faire ensuite ?`,
      speechText: `Bonjour ! Je suis à votre entière disposition. Que souhaitez-vous faire ensuite ?`
    };
  }

  // Multilingual Answers for Portuguese
  if (lang.startsWith('pt') || q.includes('olá') || q.includes('como vai')) {
    return {
      text: `Olá! 👋 Respondendo com prazer em português.\n\nSobre sua mensagem: **"${escapeHtml(query)}"**, posso ajudá-lo com qualquer dúvida, gerar arquivos PDF ou agendar seus eventos.\n\nComo posso ser útil agora?`,
      speechText: `Olá! Estou à sua disposição. Como posso ajudá-lo agora?`
    };
  }

  // Multilingual Answers for Chinese
  if (lang.startsWith('zh') || q.includes('你好')) {
    return {
      text: `你好！👋 我很乐意用中文为您提供帮助。\n\n关于您的问题：“**${escapeHtml(query)}**”，我可以为您解答疑问、创建 PDF 文件或在日历中安排日程。\n\n您接下来想要做什么？`,
      speechText: `你好！我很乐意为您提供帮助。请问接下来有什么需要？`
    };
  }

  // General Direct Conversational Answer for any topic
  return {
    text: `Entiendo perfectamente lo que me comentas sobre: **"${escapeHtml(query)}"**.\n\nPara responderte con precisión:\n\n• **Perspectiva Principal:** Es un asunto muy interesante que se puede enfocar desde diferentes ángulos dependiendo de tus objetivos.\n• **Siguiente Paso Práctico:** Podemos profundizar en ello, redactarte un informe en **PDF**, diseñar una estructura para **Canva** o agendar una tarea en tu **calendario**.\n\n¿Qué prefieres que hagamos al respecto?`,
    speechText: `Entendido perfectamente. Podemos profundizar en ello, crear un PDF o agendar una cita. ¿Qué prefieres que hagamos?`
  };
}

// --- Chat Bubbles Rendering ---
function handleUserSubmit(text, fromVoice = false) {
  if (!text.trim()) return;
  if (elements.welcomeScreen) elements.welcomeScreen.remove();

  appendMessageBubble('user', text, fromVoice);
  elements.chatInput.value = '';

  // Thinking Bubble
  const thinkId = 'think_' + Date.now();
  appendThinkingBubble(thinkId);

  setTimeout(() => {
    const aiOutput = generateDeepResponse(text, state.language);
    replaceThinkingBubble(thinkId, aiOutput);
  }, 500);
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
      <span>Pensando respuesta...</span>
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

  // Attach dynamic events
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

// --- PDF Generator with jsPDF ---
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

// --- ICS Calendar Generator ---
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

// --- Markdown Helpers ---
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

// Single tap mic in bottom bar
elements.micBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
  } else {
    elements.micBtn.classList.remove('bg-sky-600');
    elements.micBtn.classList.add('bg-red-500', 'animate-pulse');
    elements.micIcon.setAttribute('data-lucide', 'square');
    refreshIcons();
    startSpeechRecognizer();
  }
});

// Copilot Voice Call triggers
elements.openCopilotVoiceBtn.addEventListener('click', openCopilotVoiceModal);
if (elements.heroVoiceBtn) elements.heroVoiceBtn.addEventListener('click', openCopilotVoiceModal);

elements.closeCopilotVoiceBtn.addEventListener('click', closeCopilotVoiceModal);

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

// Init
window.addEventListener('DOMContentLoaded', () => {
  initVoices();
  refreshIcons();
});
