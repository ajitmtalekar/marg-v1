import puppeteer from "puppeteer";
import fs from "fs-extra";
import path from "path";


// Output folder
import { fileURLToPath } from "url";

// get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// now you can safely do:
const OUTPUT_DIR = path.join(__dirname, "public", "audio", "mr");

// Ensure folder exists
fs.ensureDirSync(OUTPUT_DIR);

// ----------------------------
// 1️⃣ Phrases
// ----------------------------
const phrases = {
  "start": "सुरू करा",
  "straight": "सरळ जा",
  "turn_right": "उजव्या बाजूला वळा",
  "turn_left": "डाव्या बाजूला वळा",
  "slight_right": "थोडे उजव्या बाजूला वळा",
  "slight_left": "थोडे डाव्या बाजूला वळा",
  "arrive": "आपण आपल्या ठिकाणी पोहोचला आहात",
  "circle": "गोल मार्गावर चालत रहा"
};

// ----------------------------
// 2️⃣ Numbers
// ----------------------------
const numbers = {
  0: "शून्य", 1: "एक", 2: "दोन", 3: "तीन", 4: "चार",
  5: "पाच", 6: "सहा", 7: "सात", 8: "आठ", 9: "नऊ",
  10: "दहा", 20: "वीस", 30: "तीस", 40: "चाळीस", 50: "पन्नास",
  60: "साठ", 70: "सत्तर", 80: "ऐंशी", 90: "नव्वद", 100: "शंभर",
  "मीटर": "मीटर"
};

// ----------------------------
// 3️⃣ Generate MP3 using Web Speech API in headless Chrome
// ----------------------------
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // HTML template with JS to generate MP3
  const htmlContent = `
  <html>
  <body>
  <script>
    async function speakToFile(text) {
      return new Promise(resolve => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "mr-IN";
        // @ts-ignore
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const synth = window.speechSynthesis;
        const source = audioCtx.createMediaStreamSource(dest.stream);
        utter.onend = () => { resolve(); };
        synth.speak(utter);
      });
    }
  </script>
  </body>
  </html>
  `;

  await page.setContent(htmlContent);

  // ----------------------------
  // 3a️⃣ Generate phrases
  // ----------------------------
  for (const [name, text] of Object.entries(phrases)) {
    const filePath = path.join(OUTPUT_DIR, `${name}.mp3`);
    console.log("Generating phrase:", name, text);

    await page.evaluate((t) => {
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "mr-IN";
        u.rate = 0.9;
        u.pitch = 0.95;
        u.onend = resolve;
        speechSynthesis.speak(u);
      });
    }, text);

    // Dummy empty MP3 placeholder (replace with actual audio capture in real implementation)
    fs.writeFileSync(filePath, "");
  }

  // ----------------------------
  // 3b️⃣ Generate numbers
  // ----------------------------
  for (const [num, text] of Object.entries(numbers)) {
    const filePath = path.join(OUTPUT_DIR, `${num}.mp3`);
    console.log("Generating number:", num, text);

    await page.evaluate((t) => {
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = "mr-IN";
        u.rate = 0.9;
        u.pitch = 0.95;
        u.onend = resolve;
        speechSynthesis.speak(u);
      });
    }, text);

    fs.writeFileSync(filePath, "");
  }

  console.log("✅ All files generated (dummy placeholders for demo).");
  await browser.close();
})();
