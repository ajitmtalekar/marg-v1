// marathiSpeak.js — Sequential route navigation

// ----------------------------
// 1️⃣ Pre-recorded phrases
// ----------------------------
const phraseAudioMap = {
  "Start": new Audio("/audio/mr/start.mp3"),
  "Continue straight": new Audio("/audio/mr/straight.mp3"),
  "Turn right": new Audio("/audio/mr/turn_right.mp3"),
  "Turn left": new Audio("/audio/mr/turn_left.mp3"),
  "Slight right": new Audio("/audio/mr/slight_right.mp3"),
  "Slight left": new Audio("/audio/mr/slight_left.mp3"),
  "Arrive": new Audio("/audio/mr/arrive.mp3"),
  "Circle path": new Audio("/audio/mr/circle.mp3")
};

// ----------------------------
// 2️⃣ Pre-recorded numbers
// ----------------------------
const numberAudioMap = {
  0: new Audio("/audio/mr/0.mp3"),
  1: new Audio("/audio/mr/1.mp3"),
  2: new Audio("/audio/mr/2.mp3"),
  3: new Audio("/audio/mr/3.mp3"),
  4: new Audio("/audio/mr/4.mp3"),
  5: new Audio("/audio/mr/5.mp3"),
  6: new Audio("/audio/mr/6.mp3"),
  7: new Audio("/audio/mr/7.mp3"),
  8: new Audio("/audio/mr/8.mp3"),
  9: new Audio("/audio/mr/9.mp3"),
  10: new Audio("/audio/mr/10.mp3"),
  20: new Audio("/audio/mr/20.mp3"),
  30: new Audio("/audio/mr/30.mp3"),
  40: new Audio("/audio/mr/40.mp3"),
  50: new Audio("/audio/mr/50.mp3"),
  60: new Audio("/audio/mr/60.mp3"),
  70: new Audio("/audio/mr/70.mp3"),
  80: new Audio("/audio/mr/80.mp3"),
  90: new Audio("/audio/mr/90.mp3"),
  100: new Audio("/audio/mr/100.mp3"),
  "मीटर": new Audio("/audio/mr/मीटर.mp3")
};

// ----------------------------
// 3️⃣ Split number into playable chunks
// ----------------------------
function getNumberChunks(num) {
  const chunks = [];
  if (num >= 100) {
    const hundreds = Math.floor(num / 100) * 100;
    if (numberAudioMap[hundreds]) chunks.push(hundreds);
    num = num % 100;
  }

  if (num >= 20) {
    const tens = Math.floor(num / 10) * 10;
    if (numberAudioMap[tens]) chunks.push(tens);
    num = num % 10;
  }

  if (num > 0 && numberAudioMap[num]) chunks.push(num);
  return chunks;
}

// ----------------------------
// 4️⃣ Play number audio sequentially
// ----------------------------
function playNumber(distance, onComplete) {
  const chunks = getNumberChunks(Math.round(distance));
  chunks.push("मीटर"); // append "मीटर"

  let i = 0;
  const playNext = () => {
    if (i >= chunks.length) {
      if (onComplete) onComplete();
      return;
    }
    const audio = numberAudioMap[chunks[i]];
    if (!audio) {
      i++;
      playNext();
      return;
    }
    audio.currentTime = 0;
    audio.play();
    audio.onended = () => {
      i++;
      playNext();
    };
  };
  playNext();
}

// ----------------------------
// 5️⃣ Play phrase audio
// ----------------------------
export function speakMarathiPhrase(phrase, onEnded) {
  const audio = phraseAudioMap[phrase];
  if (!audio) {
    if (onEnded) onEnded();
    return;
  }

  // Stop all other audios
  Object.values(phraseAudioMap).forEach(a => a.pause() && (a.currentTime = 0));
  Object.values(numberAudioMap).forEach(a => a.pause() && (a.currentTime = 0));

  audio.currentTime = 0;
  audio.play();
  audio.onended = onEnded || null;
}

// ----------------------------
// 6️⃣ Play full route sequentially
// steps = [{ phrase: "Turn left", distance: 250 }, { phrase: "Continue straight", distance: 120 }, ...]
// ----------------------------
export function speakMarathiRoute(steps) {
  if (!steps || !steps.length) return;

  let index = 0;

  const playNextStep = () => {
    if (index >= steps.length) return;

    const step = steps[index];
    index++;

    if (step.distance) {
      // Phrase → distance → next step
      speakMarathiPhrase(step.phrase, () => {
        playNumber(step.distance, playNextStep);
      });
    } else {
      // Phrase only
      speakMarathiPhrase(step.phrase, playNextStep);
    }
  };

  playNextStep();
}
