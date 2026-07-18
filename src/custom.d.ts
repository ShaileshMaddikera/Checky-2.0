declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Web Speech API types (not yet in TypeScript's DOM lib for all targets)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
