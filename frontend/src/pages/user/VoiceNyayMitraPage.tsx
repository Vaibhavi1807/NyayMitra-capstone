import {useRef, useState } from "react";

import { transcribeVoice } from "../../api/translationApi";

type VoiceNyayMitraPageProps = {
  onBack: () => void;
};
const languages = [
  { code: "hi", name: "Hindi" },
  { code: "mr", name: "Marathi" },
];

export default function VoiceNyayMitraPage({
  onBack,
}: VoiceNyayMitraPageProps) {
  const [language, setLanguage] = useState("mr");
  const [question, setQuestion] = useState("");
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [response, setResponse] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const blobToWav = async (blob: Blob): Promise<Blob> => {
  const arrayBuffer = await blob.arrayBuffer();

  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const wavBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numberOfChannels * 2,
    true
  );
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(
    40,
    length * numberOfChannels * 2,
    true
  );

  const channels: Float32Array[] = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  let offset = 44;

  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, channels[channel][i])
      );

      view.setInt16(
        offset,
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff,
        true
      );

      offset += 2;
    }
  }

  await audioContext.close();

  return new Blob([wavBuffer], {
    type: "audio/wav",
  });
};
  const startListening = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported by this browser.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const recorder = new MediaRecorder(stream);

    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());

      const recordedBlob = new Blob(
  audioChunksRef.current,
  { type: recorder.mimeType }
);

const audioBlob = await blobToWav(recordedBlob);

      try {
        setQuestion("Transcribing your voice...");

        const data = await transcribeVoice(
          audioBlob,
          language as "hi" | "mr"
        );

        setQuestion(
          data.transcribed_text || ""
        );
      } catch (error) {
        console.error(
          "Voice transcription error:",
          error
        );

        setQuestion("");

        alert(
          error instanceof Error
            ? error.message
            : "Unable to transcribe the recording."
        );
      } finally {
        setIsListening(false);
      }
    };

    mediaRecorderRef.current = recorder;

    recorder.start();

    setIsListening(true);
  } catch (error) {
    console.error(
      "Microphone error:",
      error
    );

    setIsListening(false);

    alert(
      "Microphone access was denied or unavailable."
    );
  }
};

const stopListening = () => {
  const recorder = mediaRecorderRef.current;

  if (
    recorder &&
    recorder.state !== "inactive"
  ) {
    recorder.stop();
  }
};

  const handleAsk = () => {
    if (!question.trim()) return;

    setResponse(
      "Based on the information you provided, you should first read the legal notice carefully, note any response deadline, preserve the related documents, and consider consulting a qualified lawyer for advice specific to your situation."
    );
  };

  const clearConversation = () => {
    setQuestion("");
    setResponse("");
    setIsSpeaking(false);
  };

  const speakResponse = () => {
    if (!response) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(response);

      speech.lang =
        language === "hi"
          ? "hi-IN"
          : language === "mr"
          ? "mr-IN"
          : "en-IN";

      speech.onstart = () => {
        setIsSpeaking(true);
      };

      speech.onend = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(speech);
    }
  };

  const selectedLanguage =
    languages.find((item) => item.code === language)?.name ||
    "English";

  return (
    <main className="voice-nyaymitra-page">

      {/* =====================================================
          BACK BUTTON
          ===================================================== */}

      <button
        type="button"
        className="voice-back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="voice-hero">

        <div className="voice-hero-glow" />

        <div className="voice-hero-content">

          <div className="voice-eyebrow">
            <span>🎙</span>
            NYAYMITRA VOICE ASSISTANCE
          </div>

          <h1>
            Talk to
            <br />
            <span>NyayMitra</span>
          </h1>

          <p>
            Ask your legal questions by speaking naturally.
            NyayMitra can help you understand legal information
            in a simpler and more accessible way.
          </p>

          <div className="voice-hero-pills">
            <span>Voice First</span>
            <span>Multilingual</span>
            <span>Simple Legal Guidance</span>
          </div>

        </div>
      </section>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <section className="voice-main">

        {/* LANGUAGE */}

        <div className="voice-language-card">

          <div>

            <span className="voice-small-label">
              CONVERSATION LANGUAGE
            </span>

            <h3>
              Choose your preferred language
            </h3>

          </div>

          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
          >
            {languages.map((item) => (
              <option
                key={item.code}
                value={item.code}
              >
                {item.name}
              </option>
            ))}
          </select>

        </div>

        {/* =================================================
            VOICE AREA
            ================================================= */}

        <div className="voice-assistant-card">

          <div className="voice-assistant-top">

            <div>

              <span className="voice-section-label">
                VOICE ASSISTANT
              </span>

              <h2>
                How can I help you?
              </h2>

              <p>
                Speak your question or type it below.
              </p>

            </div>

            <div className="voice-status">
              <span />
              Ready
            </div>

          </div>

          {/* MICROPHONE */}

          <div className="voice-microphone-area">

            <button
              type="button"
              className={
                isListening
                  ? "voice-microphone listening"
                  : "voice-microphone"
              }
              onClick={
                isListening
                  ? stopListening
                  : startListening
              }
              aria-label={
                isListening
                  ? "Stop listening"
                  : "Start voice input"
              }
            >
              <span>
                {isListening ? "■" : "🎙"}
              </span>
            </button>

            <strong>
              {isListening
                ? "Listening..."
                : "Tap to speak"}
            </strong>

            <p>
              {isListening
                ? "Tell NyayMitra about your legal question"
                : "Speak naturally in your selected language"}
            </p>

          </div>

          {/* TRANSCRIPTION */}

          <div className="voice-input-section">

            <div className="voice-input-heading">

              <label htmlFor="voice-question">
                YOUR QUESTION
              </label>

              {question && (
                <button
                  type="button"
                  onClick={() => setQuestion("")}
                >
                  Clear
                </button>
              )}

            </div>

            <textarea
              id="voice-question"
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              placeholder={`Your spoken question will appear here...`}
              rows={5}
            />

            <div className="voice-input-footer">

              <span>
                {question.length} characters
              </span>

              <span>
                {selectedLanguage}
              </span>

            </div>

          </div>

          {/* ASK BUTTON */}

          <button
            type="button"
            className="voice-ask-button"
            disabled={!question.trim()}
            onClick={handleAsk}
          >
            <span>✦</span>
            Ask NyayMitra
            <strong>→</strong>
          </button>

        </div>

        {/* =================================================
            RESPONSE
            ================================================= */}

        {response && (

          <div className="voice-response-card">

            <div className="voice-response-header">

              <div className="voice-response-avatar">
                ⚖
              </div>

              <div>

                <span className="voice-section-label">
                  NYAYMITRA
                </span>

                <h2>
                  Here's what I understand
                </h2>

              </div>

            </div>

            <div className="voice-response-text">
              {response}
            </div>

            <div className="voice-response-actions">

              <button
                type="button"
                className={
                  isSpeaking
                    ? "voice-speak-button speaking"
                    : "voice-speak-button"
                }
                onClick={speakResponse}
              >
                <span>
                  {isSpeaking ? "🔊" : "🔈"}
                </span>

                {isSpeaking
                  ? "Speaking..."
                  : "Read Aloud"}
              </button>

              <button
                type="button"
                className="voice-new-button"
                onClick={clearConversation}
              >
                New Question
              </button>

            </div>

          </div>

        )}

        {/* =================================================
            EXAMPLES
            ================================================= */}

        <div className="voice-example-section">

          <div className="voice-section-heading">

            <span className="voice-section-label">
              TRY ASKING
            </span>

            <h2>
              You can ask NyayMitra...
            </h2>

          </div>

          <div className="voice-example-grid">

            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "What should I do after receiving a legal notice?"
                )
              }
            >
              <span>📄</span>

              <div>
                <strong>
                  Legal Notice
                </strong>

                <small>
                  What should I do after receiving one?
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "What happens at the next hearing of my case?"
                )
              }
            >
              <span>⚖</span>

              <div>
                <strong>
                  Court Hearing
                </strong>

                <small>
                  Understand what may happen next
                </small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "How can I understand my court order?"
                )
              }
            >
              <span>📑</span>

              <div>
                <strong>
                  Court Order
                </strong>

                <small>
                  Explain a legal order simply
                </small>
              </div>

              <b>→</b>
            </button>

          </div>

        </div>

        {/* DISCLAIMER */}

        <div className="voice-disclaimer">

          <span>ⓘ</span>

          <p>
            <strong>Important:</strong> NyayMitra provides
            AI-assisted legal information for understanding
            legal processes. It is not a substitute for advice
            from a qualified legal professional.
          </p>

        </div>

      </section>
    </main>
  );
}
