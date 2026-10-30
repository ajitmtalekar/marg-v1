export function speak(text) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN"; // Indian English accent
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel(); // stop any ongoing voice
  window.speechSynthesis.speak(utterance);
}
