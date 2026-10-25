/**
 * VoiceNote AI - Tu Asistente con Voz Hablada en Castellano
 * Desarrollada por Hugo SP Studios.
 */

let _currentUtterance = null;

const state = {
  language: 'es-ES',
  isLiveCallActive: false,
  isRecording: false,
  isAiSpeaking: false,
  recognition: null,
  lastAiSpeechText: ''
};

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

  _currentUtterance.onerror = () => {
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
      else                        interim += event.results[i][0].transcript;
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

// MOTOR DE IA UNIVERSAL (Sabe de absolutamente todo)
async function fetchRealAiResponse(query) {
  const cleanQ = query.trim();
  const lower  = cleanQ.toLowerCase();

  if (lower.includes('pdf') || lower.includes('descargar informe')) {
    return {
      text: `📄 **Documento Oficial Listo:**\n\n• **Título:** Informe Oficial VoiceNote AI\n• **Autor:** Hugo SP Studios\n• **Fecha:** ${new Date().toLocaleDateString()}\n\nPulsa abajo para descargarlo en PDF.`,
      pdfAction: true,
      pdfTitle: 'Informe_Oficial_Hugo_SP_Studios',
      pdfContent: `DOCUMENTO OFICIAL\nDesarrollado por Hugo SP Studios\nFecha: ${new Date().toLocaleDateString()}\n\nInforme preparado por VoiceNote AI.`,
      speechText: 'Te he preparado el documento oficial en PDF listo para descargar.'
    };
  }

  if (lower.includes('cita') || lower.includes('agenda') || lower.includes('reunión') ||
      lower.includes('calendario') || lower.includes('dentista') || lower.includes('médico')) {
    const title = lower.includes('dentista') ? 'Cita con el Dentista' :
                  lower.includes('médico')   ? 'Cita Médica' : 'Reunión Agendada';
    return {
      text: `📅 **Cita Preparada:**\n\n• **Evento:** ${title}\n• **Recordatorio:** 30 minutos antes.\n\nPulsa para añadirla a **Google Calendar** o descargar para **Apple Calendar (iPhone)**.`,
      calendarAction: true,
      calendarTitle: title,
      speechText: `Cita ${title} lista para agendar en tu calendario.`
    };
  }

  try {
    const promptCompleto = `Eres VoiceNote AI, un asistente experto creado por Hugo SP Studios. Responde siempre en castellano de España de forma detallada, clara, culta y útil a la siguiente consulta del usuario: ${cleanQ}`;
    const encodedPrompt = encodeURIComponent(promptCompleto);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=42`, {
      signal: controller.signal
    });

    clearTimeout(timer);

    if (res.ok) {
      const answer = await res.text();
      if (answer && answer.trim().length > 3) {
        const speechVersion = answer.trim()
          .replace(/\$\$[\s\S]*?\$\$/g, '')
          .replace(/\$[^$]*?\$/g, '')
          .replace(/[*_#•`\\]/g, '')
          .replace(/\n+/g, '. ')
          .slice(0, 450);
        return { text: answer.trim(), speechText: speechVersion };
      }
    }
  } catch (err) {}

  return {
    text: `🌍 **VoiceNote AI:** ${cleanQ}\n\nAquí tienes la información detallada sobre este tema. Como asistente universal, puedo ayudarte con viajes, cruceros, ciencia, historia y cualquier otra consulta que tengas. ¿Qué más te gustaría saber?`,
    speechText: `Te puedo ayudar con cualquier tema que necesites, desde viajes y cruceros hasta ciencia o historia. ¿Qué más te gustaría saber?`
  };
}

async function handleUserSubmit(text, fromVoice = false) {
  if (!text.trim()) return;
  if (elements.welcomeScreen) elements.welcomeScreen.remove();

  appendMessageBubble('user', text, fromVoice);
  elements.chatInput.value = '';

  const thinkId = 'think_' + Date.now();
  appendThinkingBubble(thinkId);

  const aiOutput = await fetchRealAiResponse(text);
  replaceThinkingBubble(thinkId, aiOutput);
  speakSpanishVoice(aiOutput.speechText || aiOutput.text);
}

function appendMessageBubble(sender, text, isVoice = false) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'flex justify-end my-3' : 'flex items-start gap-3 my-3';
  if (sender === 'user') {
    div.innerHTML = `<div class="max-w-[85%] sm:max-w-md p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg text-xs sm:text-sm"><p class="whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</p></div>`;
  }
  elements.chatMessages.appendChild(div);
  refreshIcons();
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendThinkingBubble(id) {
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start gap-3 my-3';
  div.innerHTML = `<div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0 text-white shadow-md"><i data-lucide="bot" class="w-4 h-4"></i></div><div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span><span>Pensando...</span></div>`;
  elements.chatMessages.appendChild(div);
  refreshIcons();
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function replaceThinkingBubble(id, aiOutput) {
  const el = document.getElementById(id);
  if (!el) return;

  const div = document.createElement('div');
  div.className = 'flex items-start gap-3 my-3';

  let actionBtns = '';
  if (aiOutput.pdfAction) {
    actionBtns += `<div class="mt-3 pt-3 border-t border-slate-800"><button data-download-pdf="${encodeURIComponent(aiOutput.pdfTitle||'Documento')}" data-content="${encodeURIComponent(aiOutput.pdfContent||aiOutput.text)}" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"><i data-lucide="download" class="w-3.5 h-3.5"></i> Descargar PDF</button></div>`;
  }
  if (aiOutput.calendarAction) {
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(aiOutput.calendarTitle)}`;
    actionBtns += `<div class="mt-3 pt-3 border-t border-slate-800 flex gap-2 flex-wrap"><a href="${googleUrl}" target="_blank" class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> Google Calendar</a><button data-download-ics="${encodeURIComponent(aiOutput.calendarTitle)}" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"><i data-lucide="smartphone" class="w-3.5 h-3.5"></i> Apple Calendar (.ics)</button></div>`;
  }

  div.innerHTML = `<div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0 text-white shadow-md mt-0.5"><i data-lucide="bot" class="w-4 h-4"></i></div><div class="flex-1 max-w-[88%] sm:max-w-xl"><div class="math-content p-4 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 text-slate-200 shadow-md text-xs sm:text-sm leading-relaxed select-text">${formatMarkdown(aiOutput.text)}${actionBtns}</div><div class="flex items-center gap-3 mt-1.5 px-1 text-[11px] text-slate-500"><button data-speak-msg="${encodeURIComponent(aiOutput.speechText||aiOutput.text)}" class="hover:text-sky-400 transition-colors flex items-center gap-1 text-sky-400 font-medium"><i data-lucide="volume-2" class="w-3.5 h-3.5"></i> Reproducir</button><span>•</span><button data-copy-msg="${encodeURIComponent(aiOutput.text)}" class="hover:text-slate-300 transition-colors flex items-center gap-1"><i data-lucide="copy" class="w-3.5 h-3.5"></i> Copiar</button></div></div>`;

  el.replaceWith(div);
  refreshIcons();
  renderMathFormulas(div.querySelector('.math-content'));

  div.querySelector('[data-speak-msg]')?.addEventListener('click', (e) => {
    speakSpanishVoice(decodeURIComponent(e.currentTarget.dataset.speakMsg));
  });
  div.querySelector('[data-copy-msg]')?.addEventListener('click', (e) => {
    navigator.clipboard.writeText(decodeURIComponent(e.currentTarget.dataset.copyMsg));
    e.currentTarget.textContent = '✓ Copiado';
    setTimeout(() => { e.currentTarget.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copiar'; refreshIcons(); }, 2000);
  });
  div.querySelector('[data-download-pdf]')?.addEventListener('click', (e) => {
    generatePdfDocument(decodeURIComponent(e.currentTarget.dataset.downloadPdf), decodeURIComponent(e.currentTarget.dataset.content));
  });
  div.querySelector('[data-download-ics]')?.addEventListener('click', (e) => {
    downloadIcsCalendarFile(decodeURIComponent(e.currentTarget.dataset.downloadIcs));
  });

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function generatePdfDocument(title, text) {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return;
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(2, 132, 199);
    doc.text(title, 20, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`VoiceNote AI • Hugo SP Studios • ${new Date().toLocaleString()}`, 20, 33);
    doc.line(20, 37, 190, 37);
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(text, 170), 20, 48);
    doc.save(`${title.replace(/\s+/g,'_')}.pdf`);
  } catch (err) {}
}

function downloadIcsCalendarFile(title) {
  const now   = new Date();
  const start = new Date(now.getTime() + 86400000).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const end   = new Date(now.getTime() + 90000000).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const ics   = [
    'BEGIN:VCALENDAR','VERSION:2.0',
    'PRODID:-//Hugo SP Studios//VoiceNote AI//ES',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:Agendado desde VoiceNote AI de Hugo SP Studios`,
    `DTSTART:${start}`,`DTEND:${end}`,
    'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = `${title.replace(/\s+/g,'_')}.ics`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-sky-300 mt-2.5 mb-1">$1</h3>')
    .replace(/^• (.*$)/gim, '<li class="ml-3 list-disc text-slate-300">$1</li>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  return (text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

elements.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = elements.chatInput.value.trim();
  if (text) handleUserSubmit(text, false);
});

elements.micBtn.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
  } else {
    elements.micBtn.classList.remove('bg-slate-800','text-slate-300');
    elements.micBtn.classList.add('bg-red-500','text-white','animate-pulse');
    elements.micIcon.setAttribute('data-lucide','square');
    refreshIcons();
    startSpeechRecognizer();
  }
});

if (elements.openLiveVoiceBtn) {
  elements.openLiveVoiceBtn.addEventListener('click', (e) => openLiveVoiceModal(e));
}
if (elements.closeLiveVoiceBtn) {
  elements.closeLiveVoiceBtn.addEventListener('click', (e) => closeLiveVoiceModal(e));
}

if (elements.manualSpeakBtn) {
  elements.manualSpeakBtn.addEventListener('click', () => {
    if (state.lastAiSpeechText) speakSpanishVoice(state.lastAiSpeechText);
  });
}

elements.toggleVoiceCallMicBtn?.addEventListener('click', () => {
  if (state.isRecording) {
    stopSpeechRecognizer();
    elements.callMicIcon.setAttribute('data-lucide','mic-off');
  } else {
    startSpeechRecognizer();
    elements.callMicIcon.setAttribute('data-lucide','mic');
  }
  refreshIcons();
});

elements.clearChatBtn.addEventListener('click', () => location.reload());

window.addEventListener('DOMContentLoaded', () => {
  initVoices();
  refreshIcons();
});



 


