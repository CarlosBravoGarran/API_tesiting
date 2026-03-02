const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList =
  window.SpeechGrammarList || window.webkitSpeechGrammarList;

const videoEl = document.querySelector("#video");
const logEl = document.querySelector("#log");
const indicator = document.querySelector("#indicator");
const startBtn = document.querySelector("#startBtn");
const videoOverlay = document.querySelector("#videoOverlay");

// ─── Retroalimentación por voz (SpeechSynthesis) ───────────────────────────
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.1;
    window.speechSynthesis.cancel(); // cancel previous if any
    window.speechSynthesis.speak(utterance);
}

// ─── Feedback visual en el overlay del video ──────────────────────────────
function showOverlayFeedback(text) {
    videoOverlay.textContent = text;
    videoOverlay.classList.add("visible");
    setTimeout(() => videoOverlay.classList.remove("visible"), 1200);
}

// ─── Manejo de comandos de voz ────────────────────────────────────────────
function handleCommand(command) {
    command = command.toLowerCase().trim();

    if (command.includes("reproducir") || command.includes("play")) {
        videoEl.play();
        logEl.textContent = `Comando: "${command}" → ▶ Reproduciendo`;
        speak("Reproduciendo");
        showOverlayFeedback("▶");

    } else if (command.includes("pausar") || command.includes("pausa") || command.includes("pause")) {
        videoEl.pause();
        logEl.textContent = `Comando: "${command}" → ⏸ Pausado`;
        speak("Pausado");
        showOverlayFeedback("⏸");

    } else if (command.includes("subir") || command.includes("sube") || command.includes("más volumen")) {
        videoEl.volume = Math.min(1, videoEl.volume + 0.2);
        const vol = Math.round(videoEl.volume * 100);
        logEl.textContent = `Comando: "${command}" → 🔊 Volumen: ${vol}%`;
        speak(`Volumen al ${vol} por ciento`);
        showOverlayFeedback(`🔊 ${vol}%`);

    } else if (command.includes("bajar") || command.includes("baja") || command.includes("menos volumen")) {
        videoEl.volume = Math.max(0, videoEl.volume - 0.2);
        const vol = Math.round(videoEl.volume * 100);
        logEl.textContent = `Comando: "${command}" → 🔉 Volumen: ${vol}%`;
        speak(`Volumen al ${vol} por ciento`);
        showOverlayFeedback(`🔉 ${vol}%`);

    } else {
        // Comando no reconocido
        logEl.textContent = `"${command}" — Comando no reconocido.`;
        speak("Comando no reconocido. Los comandos disponibles son: reproducir, pausar, subir y bajar.");
        showOverlayFeedback("❓");
        indicator.className = "indicator error";
    }
}

// ─── Reconocimiento de voz ────────────────────────────────────────────────
let recognition = null;
let isListening = false;

function startRecognition() {
    if (!SpeechRecognition) {
        logEl.textContent = "Tu navegador no soporta el reconocimiento de voz.";
        speak("Tu navegador no soporta el reconocimiento de voz.");
        return;
    }

    if (isListening) {
        recognition.stop();
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.continuous = true;

    // Gramática opcional para mejorar la precisión
    if (SpeechGrammarList) {
        const grammar = '#JSGF V1.0; grammar commands; public <command> = reproducir | pausar | subir | bajar;';
        const grammarList = new SpeechGrammarList();
        grammarList.addFromString(grammar, 1);
        recognition.grammars = grammarList;
    }

    recognition.onstart = () => {
        isListening = true;
        indicator.className = "indicator listening";
        startBtn.classList.add("active");
        logEl.textContent = "Escuchando… Di un comando.";
        speak("Listo. Di un comando.");
    };

    recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        handleCommand(transcript);
    };

    recognition.onerror = (event) => {
        console.error("Error de reconocimiento:", event.error);
        if (event.error === "not-allowed") {
            logEl.textContent = "Permiso de micrófono denegado.";
        } else if (event.error === "no-speech") {
            logEl.textContent = "No se detectó ninguna voz. Intenta de nuevo.";
        } else {
            logEl.textContent = `Error: ${event.error}`;
        }
        indicator.className = "indicator error";
    };

    recognition.onend = () => {
        isListening = false;
        indicator.className = "indicator";
        startBtn.classList.remove("active");
        logEl.textContent = "Reconocimiento detenido. Pulsa para volver a iniciar.";
    };

    recognition.start();
}

// ─── Control por gestos con Acelerómetro ─────────────────────────────────
let lastTilt = 0;
const TILT_THRESHOLD = 7;    // m/s²
const TILT_COOLDOWN = 1500;  // ms entre gestos
let lastGestureTime = 0;

function handleTilt(x) {
    const now = Date.now();
    if (now - lastGestureTime < TILT_COOLDOWN) return;

    if (x > TILT_THRESHOLD) {
        // Inclinar hacia la derecha → adelantar
        videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime - 5);
        logEl.textContent = "Gesto detectado: → Adelantando 5 segundos";
        showOverlayFeedback("⏪ -5s");
        lastGestureTime = now;

    } else if (x < -TILT_THRESHOLD) {
        // Inclinar hacia la izquierda → retroceder
        videoEl.currentTime = Math.max(0, videoEl.currentTime + 5);
        logEl.textContent = "Gesto detectado: ← Retrocediendo 5 segundos";
        showOverlayFeedback("⏩ +5s");
        lastGestureTime = now;
    }
}

if ("Accelerometer" in window) {
    try {
        const sensor = new Accelerometer({ frequency: 60 });

        sensor.onreading = () => {
            handleTilt(sensor.x);
        };

        sensor.start();
        console.log("Acelerómetro iniciado correctamente.");
    } catch (error) {
        console.error("Error con el acelerómetro:", error);
        logEl.innerText = "El Acelerómetro no está disponible en este dispositivo.";
    }
} else {
    console.warn("Accelerometer API no soportada en este navegador/dispositivo.");
    // Silently degrade — keyboard fallback for desktop testing
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") handleTilt(TILT_THRESHOLD + 1);
        if (e.key === "ArrowLeft")  handleTilt(-(TILT_THRESHOLD + 1));
    });
}