/* ============================================================
   Hello Translator — vanilla JS only
   1 Config & languages | 2 Helpers | 3 Selectors | 4 Translation
   5 Text card | 6 Speak to Speak | 7 Image OCR | 8 Init
   ============================================================ */

/* 1. CONFIG — never put secret API keys in frontend JS.
   Set provider:"proxy" to call YOUR backend which adds the key. */
const TRANSLATE_CONFIG = {
  provider: "mymemory",            // "mymemory" (key-less) | "proxy"
  proxyEndpoint: "/api/translate", // used only when provider === "proxy"
};

const OCR_CONFIG = {
  enabled: true,
  cdnUrl: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
  languages: "eng+tel+hin+kor+jpn+chi_sim+spa+fra+deu+ara+tam+kan+mal+mar+ben",
};

const LANGUAGES = [
  { code: "auto", name: "Auto Detect", voice: "" },
  { code: "en", name: "English", voice: "en-US" },
  { code: "te", name: "Telugu", voice: "te-IN" },
  { code: "hi", name: "Hindi", voice: "hi-IN" },
  { code: "ko", name: "Korean", voice: "ko-KR" },
  { code: "ja", name: "Japanese", voice: "ja-JP" },
  { code: "zh", name: "Chinese", voice: "zh-CN" },
  { code: "es", name: "Spanish", voice: "es-ES" },
  { code: "fr", name: "French", voice: "fr-FR" },
  { code: "de", name: "German", voice: "de-DE" },
  { code: "ar", name: "Arabic", voice: "ar-SA" },
  { code: "ta", name: "Tamil", voice: "ta-IN" },
  { code: "kn", name: "Kannada", voice: "kn-IN" },
  { code: "ml", name: "Malayalam", voice: "ml-IN" },
  { code: "mr", name: "Marathi", voice: "mr-IN" },
  { code: "bn", name: "Bengali", voice: "bn-IN" },
];

/* 2. HELPERS */
const $ = (id) => document.getElementById(id);

let toastTimer = null;
function toast(message, type = "") {          // friendly bottom message
  const el = $("toast");
  el.textContent = message;
  el.className = "show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = type), 3200);
}

function setBox(id, text, placeholder) {      // fill a result box
  const el = $(id);
  if (text && text.trim()) { el.textContent = text; el.classList.remove("empty"); }
  else { el.textContent = placeholder; el.classList.add("empty"); }
}

function setLoading(btn, isLoading) {         // button loading state
  if (!btn) return;
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
}

const langByCode = (code) => LANGUAGES.find((l) => l.code === code);
const langName = (code) => (langByCode(code) ? langByCode(code).name : code);
const voiceTag = (code) => (langByCode(code) && langByCode(code).voice) || "en-US";

async function copyText(text) {               // clipboard with fallback
  if (!text || !text.trim()) return toast("There is nothing to copy yet.", "error");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    toast("Copied to clipboard.", "ok");
  } catch (e) {
    toast("Your browser blocked copying. Please copy manually.", "error");
  }
}

/* 3. LANGUAGE SELECTORS + SWAP */
function fillLanguageSelectors() {
  const from = $("fromLang"), to = $("toLang");
  LANGUAGES.forEach((lang) => {
    const a = document.createElement("option");
    a.value = lang.code; a.textContent = lang.name; from.appendChild(a);
    if (lang.code !== "auto") {                // Auto Detect can't be a target
      const b = document.createElement("option");
      b.value = lang.code; b.textContent = lang.name; to.appendChild(b);
    }
  });
  from.value = "auto"; to.value = "en";
}

function swapLanguages() {
  const from = $("fromLang"), to = $("toLang");
  if (from.value === "auto") return toast("Pick a specific From language before swapping.", "error");
  const tmp = from.value; from.value = to.value; to.value = tmp;
  toast(langName(from.value) + " → " + langName(to.value), "ok");
}

/* 4. TRANSLATION SERVICE LAYER */
async function translateText(text, fromCode, toCode) {
  if (!text || !text.trim()) throw new Error("Please enter some text first.");
  if (fromCode !== "auto" && fromCode === toCode) return { text, detected: fromCode };
  if (TRANSLATE_CONFIG.provider === "proxy") return translateViaProxy(text, fromCode, toCode);
  return translateViaMyMemory(text, fromCode, toCode);
}

async function translateViaMyMemory(text, fromCode, toCode) {
  const source = fromCode === "auto" ? guessLanguage(text) : fromCode;
  const url = "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 480)) +
    "&langpair=" + encodeURIComponent(source + "|" + toCode);
  let res;
  try { res = await fetch(url); }
  catch (e) { throw new Error("Translation service is unreachable. Check your internet connection."); }
  if (!res.ok) throw new Error("Translation failed. Please try again in a moment.");
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new Error("Translation failed. Please try a shorter text.");
  return { text: out, detected: source };
}

/* Your own backend keeps API keys secret.
   Expected: { translatedText, detectedLanguage } */
async function translateViaProxy(text, fromCode, toCode) {
  let res;
  try {
    res = await fetch(TRANSLATE_CONFIG.proxyEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source: fromCode, target: toCode }),
    });
  } catch (e) { throw new Error("Translation service is unreachable right now."); }
  if (!res.ok) throw new Error("Translation failed. Please try again.");
  const data = await res.json();
  if (!data.translatedText) throw new Error("Translation failed. Please try again.");
  return { text: data.translatedText, detected: data.detectedLanguage || fromCode };
}

/* Script-based language guess for Auto Detect and image text */
function guessLanguage(text) {
  const checks = [
    ["te", /[\u0C00-\u0C7F]/], ["kn", /[\u0C80-\u0CFF]/], ["ml", /[\u0D00-\u0D7F]/],
    ["ta", /[\u0B80-\u0BFF]/], ["bn", /[\u0980-\u09FF]/], ["hi", /[\u0900-\u097F]/],
    ["ko", /[\uAC00-\uD7AF\u1100-\u11FF]/], ["ja", /[\u3040-\u30FF]/],
    ["zh", /[\u4E00-\u9FFF]/], ["ar", /[\u0600-\u06FF]/],
  ];
  for (const [code, re] of checks) if (re.test(text)) return code;
  const lower = " " + text.toLowerCase() + " ";
  if (/[áéíóúñ¿¡]/.test(lower) || / (el|la|los|que|gracias|hola) /.test(lower)) return "es";
  if (/[àâçéèêôùû]/.test(lower) || / (le|les|bonjour|merci|est) /.test(lower)) return "fr";
  if (/[äöüß]/.test(lower) || / (der|die|das|und|danke) /.test(lower)) return "de";
  return "en";
}

/* TEXT-TO-SPEECH (browser only) */
function speak(text, langCode, onStart, onEnd) {
  if (!text || !text.trim()) { toast("There is nothing to speak yet.", "error"); return false; }
  if (!("speechSynthesis" in window)) { toast("Text-to-Speech is not available in this browser.", "error"); return false; }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voiceTag(langCode);
    const voices = window.speechSynthesis.getVoices() || [];
    const match = voices.find((v) => v.lang && v.lang.toLowerCase() === utter.lang.toLowerCase())
      || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(langCode));
    if (match) utter.voice = match;
    if (onStart) utter.onstart = onStart;
    if (onEnd) utter.onend = onEnd;
    utter.onerror = () => toast("Could not play the audio for this language.", "error");
    window.speechSynthesis.speak(utter);
    return true;
  } catch (e) { toast("Text-to-Speech failed on this device.", "error"); return false; }
}

/* 5. TEXT TRANSLATION CARD */
async function handleTextTranslate() {
  const text = $("sourceText").value;
  if (!text.trim()) return toast("Please enter some text to translate.", "error");
  const btn = $("translateBtn");
  setLoading(btn, true);
  setBox("textResult", "", "Translating…");
  try {
    const { text: out, detected } = await translateText(text, $("fromLang").value, $("toLang").value);
    setBox("textResult", out, "Your translation will appear here.");
    if ($("fromLang").value === "auto") toast("Detected language: " + langName(detected), "ok");
  } catch (err) {
    setBox("textResult", "", "Your translation will appear here.");
    toast(err.message || "Translation failed. Please try again.", "error");
  } finally { setLoading(btn, false); }
}

/* 6. SPEAK TO SPEAK (Web Speech API) */
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

function setMicStatus(message) { $("micStatus").textContent = message; }

function initSpeechRecognition() {
  if (!SpeechRecognitionAPI) {
    $("micBtn").disabled = true;
    setMicStatus("Speech recognition is not supported in this browser");
    return false;
  }
  recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => { isListening = true; $("micBtn").classList.add("listening"); setMicStatus("Listening…"); };
  recognition.onresult = async (event) => {
    const said = event.results[0][0].transcript;
    setBox("speechText", said, "Nothing recognized yet.");
    setMicStatus("Processing…");
    await translateSpeech(said);
  };
  recognition.onerror = (event) => {
    stopListeningUI();
    const map = {
      "not-allowed": "Microphone permission was denied. Please allow it and try again.",
      "service-not-allowed": "Microphone access is blocked by your browser settings.",
      "no-speech": "I didn't hear anything. Please try speaking again.",
      "audio-capture": "No microphone was found on this device.",
      network: "Speech recognition needs an internet connection.",
      aborted: "Listening was stopped.",
    };
    toast(map[event.error] || "Speech recognition failed. Please try again.", "error");
    setMicStatus("Ready to listen");
  };
  recognition.onend = () => stopListeningUI();
  return true;
}

function stopListeningUI() {
  isListening = false;
  $("micBtn").classList.remove("listening");
  if ($("micStatus").textContent === "Listening…") setMicStatus("Ready to listen");
}

async function toggleListening() {
  if (!recognition && !initSpeechRecognition())
    return toast("Try Chrome, Edge or Safari to use voice translation.", "error");
  if (isListening) { recognition.stop(); return; }

  try {                                   // explicit permission = clearer error
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    }
  } catch (e) {
    setMicStatus("Ready to listen");
    return toast("Microphone permission was denied. Please allow it in your browser.", "error");
  }

  const from = $("fromLang").value;
  recognition.lang = from === "auto" ? navigator.language || "en-US" : voiceTag(from);
  try { recognition.start(); } catch (e) { toast("Already listening. Please wait a moment.", "error"); }
}

async function translateSpeech(said) {
  const target = $("toLang").value;
  setBox("speechResult", "", "Translating…");
  try {
    const { text: out } = await translateText(said, $("fromLang").value, target);
    setBox("speechResult", out, "Your translation will appear here.");
    setMicStatus("Speaking…");
    const ok = speak(out, target, null, () => setMicStatus("Ready to listen"));
    if (!ok) setMicStatus("Ready to listen");
  } catch (err) {
    setBox("speechResult", "", "Your translation will appear here.");
    toast(err.message || "Translation failed. Please try again.", "error");
    setMicStatus("Ready to listen");
  }
}

/* 7. IMAGE LANGUAGE DETECTION (OCR) */
let ocrExtractedText = "";
let ocrDetectedLang = "en";
let tesseractPromise = null;

function loadOcrEngine() {                 // in-browser OCR, no API key
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OCR_CONFIG.cdnUrl;
    s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("OCR engine unavailable")));
    s.onerror = () => reject(new Error("OCR engine could not be loaded"));
    document.head.appendChild(s);
  });
  return tesseractPromise;
}

function handleImageSelected(file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith("image/"))
    return toast("That file is not a valid image. Please choose a picture.", "error");
  if (file.size > 12 * 1024 * 1024)
    return toast("That image is too large. Please use one under 12 MB.", "error");

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = $("imgPreview");
    img.src = e.target.result;
    img.style.display = "block";
    runOcr(file);
  };
  reader.onerror = () => toast("The image could not be read. Please try another one.", "error");
  reader.readAsDataURL(file);
}

async function runOcr(file) {
  const btn = $("ocrTranslateBtn");
  btn.disabled = true;
  $("detectedWrap").style.display = "none";
  setBox("ocrText", "", "Reading text from your image…");
  setBox("ocrResult", "", "Your translation will appear here.");

  if (!OCR_CONFIG.enabled) return setBox("ocrText", "", "Text extraction is not enabled on this build.");

  try {
    const Tesseract = await loadOcrEngine();
    const result = await Tesseract.recognize(file, OCR_CONFIG.languages);
    const text = ((result && result.data && result.data.text) || "").trim();
    if (!text) {
      setBox("ocrText", "", "No readable text was found in this image.");
      return toast("No readable text found. Try a clearer, closer photo.", "error");
    }
    ocrExtractedText = text;
    ocrDetectedLang = guessLanguage(text);
    setBox("ocrText", text, "No image analysed yet.");
    $("detectedLang").textContent = "Detected language: " + langName(ocrDetectedLang);
    $("detectedWrap").style.display = "block";
    btn.disabled = false;
  } catch (err) {
    setBox("ocrText", "", "Text could not be extracted from this image.");
    toast("Reading the image failed. Please check your connection and try again.", "error");
  }
}

async function handleOcrTranslate() {
  if (!ocrExtractedText) return toast("Please analyse an image first.", "error");
  const btn = $("ocrTranslateBtn");
  setLoading(btn, true);
  setBox("ocrResult", "", "Translating…");
  try {
    const { text: out } = await translateText(ocrExtractedText, ocrDetectedLang, $("toLang").value);
    setBox("ocrResult", out, "Your translation will appear here.");
  } catch (err) {
    setBox("ocrResult", "", "Your translation will appear here.");
    toast(err.message || "Translation failed. Please try again.", "error");
  } finally { setLoading(btn, false); }
}

/* 8. INIT */
function init() {
  fillLanguageSelectors();

  $("swapBtn").addEventListener("click", swapLanguages);
  $("translateBtn").addEventListener("click", handleTextTranslate);
  $("copyBtn").addEventListener("click", () => {
    const el = $("textResult"); copyText(el.classList.contains("empty") ? "" : el.textContent);
  });
  $("speakBtn").addEventListener("click", () => {
    const el = $("textResult");
    speak(el.classList.contains("empty") ? "" : el.textContent, $("toLang").value);
  });
  $("clearBtn").addEventListener("click", () => {
    $("sourceText").value = "";
    setBox("textResult", "", "Your translation will appear here.");
  });
  $("sourceText").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleTextTranslate();
  });

  $("micBtn").addEventListener("click", toggleListening);
  $("speechCopyBtn").addEventListener("click", () => {
    const el = $("speechResult"); copyText(el.classList.contains("empty") ? "" : el.textContent);
  });
  $("speechSpeakBtn").addEventListener("click", () => {
    const el = $("speechResult");
    speak(el.classList.contains("empty") ? "" : el.textContent, $("toLang").value);
  });
  if (!SpeechRecognitionAPI) initSpeechRecognition();

  $("cameraBtn").addEventListener("click", () => $("cameraInput").click());
  $("galleryBtn").addEventListener("click", () => $("galleryInput").click());
  $("cameraInput").addEventListener("change", (e) => handleImageSelected(e.target.files[0]));
  $("galleryInput").addEventListener("change", (e) => handleImageSelected(e.target.files[0]));
  $("ocrTranslateBtn").addEventListener("click", handleOcrTranslate);
  $("ocrCopyBtn").addEventListener("click", () => {
    const el = $("ocrResult"); copyText(el.classList.contains("empty") ? "" : el.textContent);
  });
  $("ocrSpeakBtn").addEventListener("click", () => {
    const el = $("ocrResult");
    speak(el.classList.contains("empty") ? "" : el.textContent, $("toLang").value);
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}

document.addEventListener("DOMContentLoaded", init);
