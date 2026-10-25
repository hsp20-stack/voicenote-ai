# 🎙️ VoiceNote AI: De Voz a Tareas y Resúmenes con IA

> **Nombre comercial:** VoiceNote AI  
> **Lema:** *De audio caótico a tareas organizadas y resúmenes ejecutivos en segundos.*

---

## 🚀 ¿Qué es VoiceNote AI?
**VoiceNote AI** es una aplicación web progresiva (PWA) de productividad impulsada por inteligencia artificial. Permite a los usuarios hablar o dictar notas caóticas mediante el micrófono del navegador o subir audios de WhatsApp/reuniones y obtener al instante:

1. 📋 **Tareas Accionables:** Detección de compromisos, fechas límite y prioridades (Alta, Media, Baja).
2. 📝 **Resumen Ejecutivo:** Puntos clave limpios y sin rodeos.
3. ✉️ **Borrador de Acción:** Generación automática de respuestas para WhatsApp, Slack o correo electrónico.

---

## ⚡ Cómo Ejecutar la Aplicación

No necesitas instalar Node.js ni Python. La aplicación es 100% moderna y funciona en cualquier navegador moderno (Edge, Chrome, Safari, Brave, etc.):

1. Abre el explorador de archivos en la ruta:
   `C:\Users\Hugo\.gemini\antigravity\scratch\voicenote-ai\`
2. Haz **doble clic en `index.html`** para abrir la aplicación directamente en tu navegador.
3. Permite el acceso al micrófono cuando el navegador lo solicite.
4. ¡Presiona el botón de micrófono y empieza a hablar!

---

## 🧠 Modos de Inteligencia Artificial Disponibles

* **Modo Motor Integrado (Offline, Gratuito e Inmediato):** Utiliza procesamiento de lenguaje natural en tiempo real dentro del propio navegador. No requiere claves de API ni consume datos.
* **Modo Gemini Cloud API:** Puedes ingresar tu propia clave gratuita de Google Gemini en el panel de configuración para un razonamiento aún más complejo.

---

## 📦 Estructura del Proyecto

* [index.html](file:///C:/Users/Hugo/.gemini/antigravity/scratch/voicenote-ai/index.html): Estructura visual con diseño oscuro moderno y Tailwind CSS.
* [app.js](file:///C:/Users/Hugo/.gemini/antigravity/scratch/voicenote-ai/app.js): Lógica del reconocedor de voz, procesador de IA, visualizador de audio en canvas y persistencia.
* [styles.css](file:///C:/Users/Hugo/.gemini/antigravity/scratch/voicenote-ai/styles.css): Estilos y animaciones personalizadas.
* [manifest.json](file:///C:/Users/Hugo/.gemini/antigravity/scratch/voicenote-ai/manifest.json): Configuración PWA para instalación como app nativa.
