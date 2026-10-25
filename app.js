/**
 * VoiceNote AI v2.0 - Core Engine
 * Ultra-fast Voice-to-Action, Speech-to-Text, Built-in NLP Reasoning,
 * Audio Synthesis Feedback, TTS, Decibel Meter, WhatsApp/Calendar Direct Deep-linking.
 */

// --- Application State ---
const state = {
  isRecording: false,
  language: 'es-ES',
  transcript: '',
  timerInterval: null,
  recordingSeconds: 0,
  audioContext: null,
  analyser: null,
  mediaStream: null,
  animFrameId: null,
  tasks: [],
  summary: [],
  draft: '',
  tone: 'Profesional',
  tags: [],
  history: [],
  currentFilter: 'todas',
  aiSettings: {
    mode: 'builtin',
    geminiKey: ''
  }
};

// --- Preset Demo Notes for Instant Testing ---
const DEMO_PRESETS = {
  reunion: "Acabamos de terminar la reunión con el equipo de diseño y marketing. Es fundamental enviar la propuesta actualizada a Carlos antes del viernes a las 5 de la tarde. También hay que revisar el presupuesto de los nuevos servidores porque está subiendo bastante y agendar una llamada con la agencia de desarrollo para el próximo martes. El cliente quedó muy satisfecho con los avances.",
  semana: "Organización de la semana: Hoy tengo que pagar la factura de internet y comprar los billetes de tren para Madrid. Mañana temprano debo llamar al notario para confirmar la cita de la firma. Y el jueves sin falta tengo que terminar la presentación para los inversores.",
  urgente: "Urgente: El servidor principal de la base de datos se ha caído y varios clientes no pueden iniciar sesión. Debo avisar al equipo técnico inmediatamente y mandar un correo a soporte explicando la incidencia para mantener la calma."
};

// --- DOM References ---
const elements = {
  toggleRecordBtn: document.getElementById('toggleRecordBtn'),
  recordBtnIcon: document.getElementById('recordBtnIcon'),
  recordingRipples: document.getElementById('recordingRipples'),
  recordingStatusBadge: document.getElementById('recordingStatusBadge'),
  timerDisplay: document.getElementById('timerDisplay'),
  dbValue: document.getElementById('dbValue'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  canvasPlaceholder: document.getElementById('canvasPlaceholder'),
  transcriptBox: document.getElementById('transcriptBox'),
  languageSelect: document.getElementById('languageSelect'),
  reprocessBtn: document.getElementById('reprocessBtn'),
  copyTranscriptBtn: document.getElementById('copyTranscriptBtn'),
  clearBtn: document.getElementById('clearBtn'),
  audioFileInput: document.getElementById('audioFileInput'),
  
  // Tabs & Filters
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContentTasks: document.getElementById('tabContentTasks'),
  tabContentSummary: document.getElementById('tabContentSummary'),
  tabContentDraft: document.getElementById('tabContentDraft'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  
  // AI Outputs
  tasksList: document.getElementById('tasksList'),
  taskCountBadge: document.getElementById('taskCountBadge'),
  metaBadgesContainer: document.getElementById('metaBadgesContainer'),
  toneBadge: document.getElementById('toneBadge'),
  tagBadges: document.getElementById('tagBadges'),
  summaryContent: document.getElementById('summaryContent'),
  draftBox: document.getElementById('draftBox'),
  
  // Buttons & Integrations
  copyTasksBtn: document.getElementById('copyTasksBtn'),
  addCalendarAllBtn: document.getElementById('addCalendarAllBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  speakSummaryBtn: document.getElementById('speakSummaryBtn'),
  copyDraftBtn: document.getElementById('copyDraftBtn'),
  openWhatsAppBtn: document.getElementById('openWhatsAppBtn'),
  exportMarkdownBtn: document.getElementById('exportMarkdownBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  
  // Settings
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  aiModeSelect: document.getElementById('aiModeSelect'),
  geminiKeyContainer: document.getElementById('geminiKeyContainer'),
  geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

// --- Web Audio Synthetic Chimes (Zero external files needed) ---
function playTone(freq, type = 'sine', duration = 0.15) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSuccessChime() {
  playTone(523.25, 'sine', 0.1); // C5
  setTimeout(() => playTone(659.25, 'sine', 0.12), 80); // E5
  setTimeout(() => playTone(783.99, 'sine', 0.2), 160); // G5
}

function playRecordStartChime() {
  playTone(440, 'triangle', 0.1);
  setTimeout(() => playTone(880, 'sine', 0.15), 100);
}

function playRecordStopChime() {
  playTone(880, 'sine', 0.1);
  setTimeout(() => playTone(440, 'triangle', 0.15), 100);
}

// --- Icons Helper ---
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// --- Load History & Config ---
function loadStoredState() {
  try {
    const savedHistory = localStorage.getItem('voicenote_history');
    if (savedHistory) state.history = JSON.parse(savedHistory);

    const savedSettings = localStorage.getItem('voicenote_settings');
    if (savedSettings) {
      state.aiSettings = JSON.parse(savedSettings);
      elements.aiModeSelect.value = state.aiSettings.mode || 'builtin';
      elements.geminiApiKeyInput.value = state.aiSettings.geminiKey || '';
      if (state.aiSettings.mode === 'gemini') {
        elements.geminiKeyContainer.classList.remove('hidden');
      }
    }
  } catch (e) {
    console.error('Error loading localStorage:', e);
  }
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem('voicenote_history', JSON.stringify(state.history));
  } catch (e) {}
  renderHistory();
}

// --- Speech Recognition Setup ---
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = state.language;

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    if (final) state.transcript += final;
    
    const fullText = (state.transcript + (interim ? ' ' + interim : '')).trim();
    if (fullText) {
      elements.transcriptBox.textContent = fullText;
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      showToast('Permiso de micrófono denegado en tu navegador.');
      stopRecording();
    }
  };

  recognition.onend = () => {
    if (state.isRecording) {
      try { recognition.start(); } catch (err) {}
    }
  };
}

// --- Real-Time Waveform & Decibel Meter ---
async function startAudioWaveform() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContext();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 128;
    source.connect(state.analyser);

    elements.canvasPlaceholder.classList.add('hidden');
    drawWaveform();
  } catch (err) {
    console.warn('Audio analyser unavailable:', err);
  }
}

function stopAudioWaveform() {
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }
  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  elements.canvasPlaceholder.classList.remove('hidden');
  elements.dbValue.textContent = '0';
}

function drawWaveform() {
  if (!state.isRecording || !state.analyser) return;

  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  state.analyser.getByteFrequencyData(dataArray);

  // Compute decibels
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
  const avg = sum / bufferLength;
  const db = Math.min(99, Math.round((avg / 255) * 85));
  elements.dbValue.textContent = String(db);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / bufferLength) * 2;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(0.5, '#a855f7');
    grad.addColorStop(1, '#ec4899');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight, 3);
    ctx.fill();

    x += barWidth;
  }

  state.animFrameId = requestAnimationFrame(drawWaveform);
}

// --- Timer ---
function startTimer() {
  state.recordingSeconds = 0;
  elements.timerDisplay.textContent = '00:00';
  state.timerInterval = setInterval(() => {
    state.recordingSeconds++;
    const mins = String(Math.floor(state.recordingSeconds / 60)).padStart(2, '0');
    const secs = String(state.recordingSeconds % 60).padStart(2, '0');
    elements.timerDisplay.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// --- Record Controls ---
async function startRecording() {
  state.isRecording = true;
  state.transcript = '';
  elements.transcriptBox.textContent = '';
  
  playRecordStartChime();

  elements.toggleRecordBtn.classList.add('recording-pulse');
  elements.recordingRipples.classList.remove('hidden');
  elements.recordBtnIcon.setAttribute('data-lucide', 'square');
  elements.recordingStatusBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse';
  elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500"></span> Grabando tu voz...';
  refreshIcons();

  startTimer();
  await startAudioWaveform();

  if (recognition) {
    recognition.lang = state.language;
    try { recognition.start(); } catch (e) {}
  }
}

async function stopRecording() {
  state.isRecording = false;
  playRecordStopChime();

  elements.toggleRecordBtn.classList.remove('recording-pulse');
  elements.recordingRipples.classList.add('hidden');
  elements.recordBtnIcon.setAttribute('data-lucide', 'mic');
  elements.recordingStatusBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
  elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-indigo-400 animate-spin"></span> Razonando con IA...';
  refreshIcons();

  stopTimer();
  stopAudioWaveform();

  if (recognition) {
    try { recognition.stop(); } catch (e) {}
  }

  setTimeout(async () => {
    const rawText = elements.transcriptBox.textContent.trim();
    if (rawText && !rawText.startsWith('Pulsa el botón')) {
      await processTextWithAI(rawText);
    } else {
      elements.recordingStatusBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800';
      elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> Micrófono listo';
    }
  }, 350);
}

// --- AI Reasoning Pipeline ---
async function processTextWithAI(text) {
  if (!text || text.length < 5) {
    showToast('Graba una nota con un poco más de detalle.');
    return;
  }

  elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-indigo-400 animate-spin"></span> Extrayendo acciones...';

  let result;
  if (state.aiSettings.mode === 'gemini' && state.aiSettings.geminiKey) {
    try {
      result = await processWithGeminiAPI(text, state.aiSettings.geminiKey);
    } catch (err) {
      console.warn('Gemini API fallo, usando motor local:', err);
      result = processWithBuiltinNLP(text);
    }
  } else {
    result = processWithBuiltinNLP(text);
  }

  state.tasks = result.tasks;
  state.summary = result.summary;
  state.draft = result.draft;
  state.tone = result.tone;
  state.tags = result.tags;

  renderTasks();
  renderSummary();
  renderDraft();
  renderMetaBadges();
  playSuccessChime();

  const noteEntry = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    transcript: text,
    tasks: state.tasks,
    summary: state.summary,
    draft: state.draft,
    tone: state.tone,
    tags: state.tags
  };
  state.history.unshift(noteEntry);
  saveHistory();

  elements.recordingStatusBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Organizado por la IA';

  setTimeout(() => {
    elements.recordingStatusBadge.className = 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800';
    elements.recordingStatusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> Micrófono listo';
  }, 3500);
}

// --- Built-in Smart NLP Engine ---
function processWithBuiltinNLP(text) {
  const sentences = text.split(/(?<=[.?!;])\s+|\n+/).filter(s => s.trim().length > 0);
  
  const tasks = [];
  const summaryPoints = [];
  const tags = new Set();
  let tone = 'Profesional';

  const actionKeywords = [
    'tengo que', 'hay que', 'debo', 'llamar', 'enviar', 'comprar', 'revisar', 'escribir', 
    'mandar', 'hacer', 'agendar', 'organizar', 'preparar', 'terminar', 'pagar', 'avisar',
    'confirmar', 'need to', 'have to', 'must', 'call', 'send', 'review', 'buy', 'schedule'
  ];

  const dateKeywords = [
    'mañana', 'hoy', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 
    'esta tarde', 'a las', 'la próxima semana', 'antes del viernes', 'tomorrow', 'today', 'urgent'
  ];

  // Tone detection
  const lowerText = text.toLowerCase();
  if (lowerText.includes('urgente') || lowerText.includes('inmediatamente') || lowerText.includes('caído') || lowerText.includes('problema')) {
    tone = 'Urgente';
    tags.add('#Urgente');
  } else if (lowerText.includes('cliente') || lowerText.includes('reunión') || lowerText.includes('presupuesto') || lowerText.includes('propuesta')) {
    tone = 'Profesional';
    tags.add('#Trabajo');
  } else {
    tone = 'Personal';
    tags.add('#Productividad');
  }

  if (lowerText.includes('dinero') || lowerText.includes('presupuesto') || lowerText.includes('pagar') || lowerText.includes('factura')) {
    tags.add('#Finanzas');
  }
  if (lowerText.includes('reunión') || lowerText.includes('llamada') || lowerText.includes('cita')) {
    tags.add('#Reunión');
  }

  sentences.forEach((sentence, idx) => {
    const lower = sentence.toLowerCase();
    const isTask = actionKeywords.some(kw => lower.includes(kw));

    if (isTask) {
      let priority = 'media';
      if (lower.includes('urgente') || lower.includes('inmediato') || lower.includes('hoy') || lower.includes('sin falta')) {
        priority = 'alta';
      } else if (lower.includes('cuando pueda') || lower.includes('luego') || lower.includes('próxima semana')) {
        priority = 'baja';
      }

      let dateHint = 'Sin fecha';
      for (const dKw of dateKeywords) {
        if (lower.includes(dKw)) {
          dateHint = dKw.charAt(0).toUpperCase() + dKw.slice(1);
          break;
        }
      }

      let cleanTitle = sentence.replace(/^(y\s+|que\s+|también\s+|tengo que\s+|hay que\s+|debo\s+)/i, '').trim();
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      tasks.push({
        id: 'task_' + Date.now() + '_' + idx,
        title: cleanTitle,
        priority: priority,
        date: dateHint,
        completed: false
      });
    }

    if (sentence.length > 25) {
      summaryPoints.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
    }
  });

  if (tasks.length === 0 && sentences.length > 0) {
    tasks.push({
      id: 'task_' + Date.now() + '_0',
      title: sentences[0].slice(0, 90),
      priority: 'media',
      date: 'Pendiente',
      completed: false
    });
  }

  if (summaryPoints.length === 0) summaryPoints.push(text);

  // Dynamic Draft
  let draft = '';
  if (tone === 'Urgente') {
    draft = `🚨 AVISO URGENTE:\n\nEstimado equipo,\nLes comunico la siguiente situación crítica:\n${summaryPoints.map(p => `• ${p}`).join('\n')}\n\nAcciones en marcha:\n${tasks.map(t => `- ${t.title}`).join('\n')}\n\nPor favor confirmar recepción.`;
  } else if (lowerText.includes('cliente') || lowerText.includes('propuesta')) {
    draft = `Hola,\n\nEspero que estés muy bien. Te comparto las conclusiones y acuerdos de nuestra conversación:\n\n${summaryPoints.map(p => `• ${p}`).join('\n')}\n\nPróximos compromisos:\n${tasks.map(t => `✓ ${t.title} (${t.date})`).join('\n')}\n\nQuedo a tu disposición para cualquier duda.\n\nUn cordial saludo.`;
  } else {
    draft = `Hola,\n\nTe paso un resumen rápido de lo tratado hoy:\n\n${summaryPoints.map(p => `• ${p}`).join('\n')}\n\nCualquier cosa me dices. ¡Un saludo!`;
  }

  return { tasks, summary: summaryPoints, draft, tone, tags: Array.from(tags) };
}

// --- Gemini Cloud API ---
async function processWithGeminiAPI(text, apiKey) {
  const prompt = `Analiza la transcripción de voz y genera un JSON estricto con:
{
  "tasks": [{ "title": "tarea", "priority": "alta"|"media"|"baja", "date": "fecha detectada" }],
  "summary": ["punto 1", "punto 2"],
  "draft": "mensaje de WhatsApp o email formal listo para enviar",
  "tone": "Profesional"|"Urgente"|"Personal",
  "tags": ["#Tag1", "#Tag2"]
}
Texto: "${text}"`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  const data = await res.json();
  const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
  return {
    tasks: parsed.tasks.map((t, i) => ({
      id: 'task_' + Date.now() + '_' + i,
      title: t.title,
      priority: t.priority || 'media',
      date: t.date || 'Sin fecha',
      completed: false
    })),
    summary: parsed.summary || [],
    draft: parsed.draft || '',
    tone: parsed.tone || 'Profesional',
    tags: parsed.tags || ['#Productividad']
  };
}

// --- Meta Badges (Tone & Tags) ---
function renderMetaBadges() {
  elements.metaBadgesContainer.classList.remove('hidden');
  elements.toneBadge.innerHTML = `<i data-lucide="smile" class="w-3 h-3"></i> Tono: ${escapeHtml(state.tone)}`;
  elements.tagBadges.innerHTML = state.tags.map(tag => `
    <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(tag)}</span>
  `).join('');
  refreshIcons();
}

// --- Render Tasks with Filter ---
function renderTasks() {
  const filtered = state.tasks.filter(t => {
    if (state.currentFilter === 'alta') return t.priority === 'alta';
    if (state.currentFilter === 'pendientes') return !t.completed;
    return true;
  });

  elements.taskCountBadge.textContent = state.tasks.length;

  if (filtered.length === 0) {
    elements.tasksList.innerHTML = `
      <div class="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-600 border border-slate-800">
          <i data-lucide="check-circle-2" class="w-6 h-6"></i>
        </div>
        <p class="text-sm font-medium">No hay tareas que coincidan con el filtro.</p>
      </div>`;
    refreshIcons();
    return;
  }

  elements.tasksList.innerHTML = filtered.map(task => `
    <div class="group flex items-start gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all ${task.completed ? 'opacity-60' : ''}">
      <input type="checkbox" data-task-id="${task.id}" class="task-checkbox mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer" ${task.completed ? 'checked' : ''}>
      <div class="flex-1 min-w-0">
        <p class="text-xs sm:text-sm font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}">${escapeHtml(task.title)}</p>
        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
          <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold badge-${task.priority}">
            ${task.priority.toUpperCase()}
          </span>
          <span class="text-[10px] text-slate-500 flex items-center gap-1">
            <i data-lucide="calendar" class="w-3 h-3"></i> ${escapeHtml(task.date)}
          </span>
        </div>
      </div>
      <button data-calendar-task="${task.id}" class="text-slate-500 hover:text-indigo-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Añadir a Google Calendar">
        <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i>
      </button>
      <button data-delete-task="${task.id}" class="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">
        <i data-lucide="trash" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  refreshIcons();

  elements.tasksList.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-task-id');
      const item = state.tasks.find(t => t.id === id);
      if (item) {
        item.completed = e.target.checked;
        if (item.completed) playTone(784, 'sine', 0.1);
        renderTasks();
      }
    });
  });

  elements.tasksList.querySelectorAll('[data-calendar-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-calendar-task');
      const item = state.tasks.find(t => t.id === id);
      if (item) openGoogleCalendar(item.title, item.date);
    });
  });

  elements.tasksList.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-task');
      state.tasks = state.tasks.filter(t => t.id !== id);
      renderTasks();
    });
  });
}

function openGoogleCalendar(title, details = '') {
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent('Organizado con VoiceNote AI: ' + details)}`;
  window.open(url, '_blank');
}

// --- Render Summary ---
function renderSummary() {
  if (state.summary.length === 0) {
    elements.summaryContent.innerHTML = `<p class="text-slate-500 italic py-16 text-center">El resumen ejecutivo aparecerá aquí tras analizar tu nota.</p>`;
    return;
  }

  elements.summaryContent.innerHTML = `
    <ul class="space-y-3">
      ${state.summary.map(point => `
        <li class="flex items-start gap-3">
          <span class="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 mt-1.5 flex-shrink-0"></span>
          <span class="text-xs sm:text-sm text-slate-200">${escapeHtml(point)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

// --- Render Draft ---
function renderDraft() {
  if (!state.draft) {
    elements.draftBox.innerHTML = `<span class="text-slate-500 italic font-sans text-sm">Aún no se ha generado ningún borrador.</span>`;
    return;
  }
  elements.draftBox.textContent = state.draft;
}

// --- Render History ---
function renderHistory() {
  if (state.history.length === 0) {
    elements.historyList.innerHTML = `<p class="text-xs text-slate-500 py-4 col-span-full text-center">No hay notas guardadas.</p>`;
    return;
  }

  elements.historyList.innerHTML = state.history.slice(0, 6).map(item => `
    <div class="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 group">
      <div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span>${item.date}</span>
          <span class="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-mono text-[10px]">${item.tasks?.length || 0} tareas</span>
        </div>
        <p class="text-xs text-slate-300 line-clamp-2">${escapeHtml(item.transcript)}</p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <button data-load-history="${item.id}" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
          <i data-lucide="arrow-up-right" class="w-3 h-3"></i> Cargar nota
        </button>
        <button data-delete-history="${item.id}" class="text-xs text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>
      </div>
    </div>
  `).join('');

  refreshIcons();

  elements.historyList.querySelectorAll('[data-load-history]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-load-history'));
      const item = state.history.find(h => h.id === id);
      if (item) {
        state.transcript = item.transcript;
        elements.transcriptBox.textContent = item.transcript;
        state.tasks = item.tasks || [];
        state.summary = item.summary || [];
        state.draft = item.draft || '';
        state.tone = item.tone || 'Profesional';
        state.tags = item.tags || [];
        renderTasks();
        renderSummary();
        renderDraft();
        renderMetaBadges();
        showToast('Nota cargada.');
      }
    });
  });

  elements.historyList.querySelectorAll('[data-delete-history]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-delete-history'));
      state.history = state.history.filter(h => h.id !== id);
      saveHistory();
    });
  });
}

// --- Tabs & Filters Navigation ---
elements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');

    elements.tabBtns.forEach(b => {
      b.className = 'tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all text-slate-400 hover:text-white hover:bg-slate-800/60';
    });
    btn.className = 'tab-btn flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all bg-indigo-600 text-white shadow-md';

    elements.tabContentTasks.classList.add('hidden');
    elements.tabContentSummary.classList.add('hidden');
    elements.tabContentDraft.classList.add('hidden');

    if (tabName === 'tasks') elements.tabContentTasks.classList.remove('hidden');
    if (tabName === 'summary') elements.tabContentSummary.classList.remove('hidden');
    if (tabName === 'draft') elements.tabContentDraft.classList.remove('hidden');
  });
});

elements.filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.currentFilter = btn.getAttribute('data-filter');
    elements.filterBtns.forEach(b => {
      b.className = 'filter-btn px-2.5 py-1 rounded-lg text-slate-400 hover:text-white';
    });
    btn.className = 'filter-btn px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium';
    renderTasks();
  });
});

// --- Toast & Utility ---
function showToast(message) {
  const existing = document.getElementById('toastNotification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toastNotification';
  toast.className = 'fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-white/20 animate-bounce';
  toast.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  refreshIcons();

  setTimeout(() => toast.remove(), 2500);
}

function copyToClipboard(text, message = 'Copiado al portapapeles') {
  if (!text) return showToast('No hay contenido para copiar');
  navigator.clipboard.writeText(text).then(() => showToast(message)).catch(() => showToast('Error al copiar'));
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Event Listeners ---
elements.toggleRecordBtn.addEventListener('click', () => {
  if (state.isRecording) stopRecording();
  else startRecording();
});

elements.languageSelect.addEventListener('change', (e) => {
  state.language = e.target.value;
  if (recognition) recognition.lang = state.language;
});

elements.reprocessBtn.addEventListener('click', () => {
  const rawText = elements.transcriptBox.textContent.trim();
  processTextWithAI(rawText);
});

elements.copyTranscriptBtn.addEventListener('click', () => {
  copyToClipboard(elements.transcriptBox.textContent.trim(), 'Transcripción copiada');
});

elements.clearBtn.addEventListener('click', () => {
  state.transcript = '';
  elements.transcriptBox.textContent = '';
  state.tasks = [];
  state.summary = [];
  state.draft = '';
  elements.metaBadgesContainer.classList.add('hidden');
  renderTasks();
  renderSummary();
  renderDraft();
  showToast('Lienzo limpio');
});

elements.copyTasksBtn.addEventListener('click', () => {
  if (state.tasks.length === 0) return showToast('No hay tareas');
  const txt = state.tasks.map(t => `[${t.completed ? 'x' : ' '}] ${t.title} (${t.priority.toUpperCase()} - ${t.date})`).join('\n');
  copyToClipboard(txt, 'Lista de tareas copiada');
});

elements.addCalendarAllBtn.addEventListener('click', () => {
  if (state.tasks.length === 0) return showToast('No hay tareas para agendar');
  const taskTitles = state.tasks.map(t => `• ${t.title} (${t.date})`).join('\n');
  openGoogleCalendar('Tareas VoiceNote AI', taskTitles);
});

elements.copySummaryBtn.addEventListener('click', () => {
  if (state.summary.length === 0) return showToast('No hay resumen');
  copyToClipboard(state.summary.map(s => `• ${s}`).join('\n'), 'Resumen copiado');
});

// Text to Speech
elements.speakSummaryBtn.addEventListener('click', () => {
  if (state.summary.length === 0) return showToast('No hay resumen para reproducir');
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.summary.join('. '));
    utterance.lang = state.language;
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
    showToast('Reproduciendo audio...');
  } else {
    showToast('Tu navegador no soporta síntesis de voz.');
  }
});

elements.copyDraftBtn.addEventListener('click', () => {
  copyToClipboard(state.draft, 'Borrador copiado');
});

// WhatsApp Direct Share
elements.openWhatsAppBtn.addEventListener('click', () => {
  if (!state.draft) return showToast('No hay borrador para compartir');
  const url = `https://wa.me/?text=${encodeURIComponent(state.draft)}`;
  window.open(url, '_blank');
});

// Presets
document.querySelectorAll('[data-demo-note]').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-demo-note');
    const text = DEMO_PRESETS[key];
    if (text) {
      elements.transcriptBox.textContent = text;
      state.transcript = text;
      processTextWithAI(text);
    }
  });
});

// Exports
elements.exportMarkdownBtn.addEventListener('click', () => {
  const md = `# VoiceNote AI - Sesión
**Fecha:** ${new Date().toLocaleString()}  
**Tono:** ${state.tone}  
**Etiquetas:** ${state.tags.join(' ')}

## Transcripción
${elements.transcriptBox.textContent.trim()}

## Tareas
${state.tasks.map(t => `- [${t.completed ? 'x' : ' '}] **${t.title}** (${t.priority} - ${t.date})`).join('\n')}

## Resumen
${state.summary.map(s => `- ${s}`).join('\n')}

## Borrador
\`\`\`
${state.draft}
\`\`\`
`;
  downloadBlob(md, `VoiceNote_${Date.now()}.md`, 'text/markdown');
});

elements.exportJsonBtn.addEventListener('click', () => {
  downloadBlob(JSON.stringify({
    exportedAt: new Date().toISOString(),
    transcript: elements.transcriptBox.textContent.trim(),
    tone: state.tone,
    tags: state.tags,
    tasks: state.tasks,
    summary: state.summary,
    draft: state.draft
  }, null, 2), `VoiceNote_${Date.now()}.json`, 'application/json');
});

function downloadBlob(content, fileName, contentType) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Descargado ${fileName}`);
}

elements.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('¿Deseas eliminar todo el historial?')) {
    state.history = [];
    saveHistory();
    showToast('Historial borrado');
  }
});

// Settings Modal
elements.openSettingsBtn.addEventListener('click', () => elements.settingsModal.classList.remove('hidden'));
elements.closeSettingsBtn.addEventListener('click', () => elements.settingsModal.classList.add('hidden'));
elements.aiModeSelect.addEventListener('change', (e) => {
  if (e.target.value === 'gemini') elements.geminiKeyContainer.classList.remove('hidden');
  else elements.geminiKeyContainer.classList.add('hidden');
});
elements.saveSettingsBtn.addEventListener('click', () => {
  state.aiSettings.mode = elements.aiModeSelect.value;
  state.aiSettings.geminiKey = elements.geminiApiKeyInput.value.trim();
  localStorage.setItem('voicenote_settings', JSON.stringify(state.aiSettings));
  elements.settingsModal.classList.add('hidden');
  showToast('Configuración guardada');
});

// Service Worker for Offline PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  loadStoredState();
  refreshIcons();
});
