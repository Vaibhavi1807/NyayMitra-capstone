import {useRef, useState } from "react";

import { transcribeVoice } from "../../api/translationApi";
import { getGuidance } from "../../api/guidanceApi";
import type { GuidanceResult } from "../../api/guidanceApi";

import ServiceStatus from "../../components/ServiceStatus";

/* =========================================================
   VOICE NYAYMITRA

   One page where somebody says what has happened to them and
   is told two things back: what to do next, and how urgent it
   is. "Tell us what happened" and "Next steps" used to be two
   separate screens asking for a CNR between them; the answer
   now comes out of what the person said, so the number was
   never needed.

   The two halves are built to different depths and say so.

   WHAT TO DO NEXT comes from the guidance set — fifty case
   stages, matched on the words the person actually used. It is
   real, and it is theirs to read.

   URGENCY is a band borrowed from that same matched stage. It
   is a lookup describing the stage in general, not a model's
   opinion about this particular incident, and the panel
   says exactly that until the urgency model is connected.
   ========================================================= */

type VoiceNyayMitraPageProps = {
  onBack: () => void;
};

const languages = [
  { code: "hi", name: "Hindi" },
  { code: "mr", name: "Marathi" },
];

/* Carried over from the Next Steps screen, which no longer
   exists on its own. These four hold whether or not the
   guidance set recognised anything, so they are shown with
   every result rather than only when a stage matched. */
const GENERAL_CHECKLIST = [
  {
    title: "Check the next hearing date",
    body: "Review your latest case information and confirm the upcoming hearing date with the court record.",
  },
  {
    title: "Review required documents",
    body: "Check whether any documents, applications or evidence need to be submitted before the next hearing.",
  },
  {
    title: "Consult your lawyer",
    body: "Discuss the latest case development with your lawyer before taking an important legal action.",
  },
  {
    title: "Keep your case information updated",
    body: "Continue monitoring your case status and upcoming hearings through NyayMitra.",
  },
];

const URGENCY_TONE: Record<string, string> = {
  low: "is-low",
  medium: "is-mid",
  high: "is-high",
};

const URGENCY_BLURB: Record<string, string> = {
  low: "Nothing here has a deadline attached to it today.",
  medium: "Something is expected of you within a short window.",
  high: "A date, a filing or an arrest question is running against the clock.",
};

export default function VoiceNyayMitraPage({
  onBack,
}: VoiceNyayMitraPageProps) {
  const [language, setLanguage] = useState("mr");
  const [question, setQuestion] = useState("");
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [result, setResult] = useState<GuidanceResult | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    const channels: Float32Array[] = [];

    for (let channel = 0; channel < numberOfChannels; channel++) {
      channels.push(audioBuffer.getChannelData(channel));
    }

    let offset = 44;

    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));

        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true,
        );

        offset += 2;
      }
    }

    await audioContext.close();

    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const startListening = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const recordedBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType,
        });

        const audioBlob = await blobToWav(recordedBlob);

        try {
          setIsReading(true);
          setQuestion("Transcribing your voice...");

          const data = await transcribeVoice(
            audioBlob,
            language as "hi" | "mr",
          );

          setQuestion(data.transcribed_text || "");
        } catch (error) {
          console.error("Voice transcription error:", error);

          setQuestion("");

          alert(
            error instanceof Error
              ? error.message
              : "Unable to transcribe the recording.",
          );
        } finally {
          setIsReading(false);
          setIsListening(false);
        }
      };

      mediaRecorderRef.current = recorder;

      recorder.start();

      setIsListening(true);
    } catch (error) {
      console.error("Microphone error:", error);

      setIsListening(false);

      alert("Microphone access was denied or unavailable.");
    }
  };

  const stopListening = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  /* Speech to text, then the text read against the guidance set.
     The placeholder sentence the screen used to show in place of
     an answer is gone — this either returns something or says
     why it could not. */
  const handleAsk = async () => {
    const text = question.trim();

    if (!text || busy) return;

    setBusy(true);
    setError("");
    setResult(null);

    try {
      setResult(await getGuidance(text));
    } catch (caught) {
      console.error("Guidance error:", caught);

      setError(
        caught instanceof Error
          ? caught.message
          : "Your description could not be read.",
      );
    } finally {
      setBusy(false);
    }
  };

  const clearConversation = () => {
    setQuestion("");
    setResult(null);
    setError("");
    setIsSpeaking(false);

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  /* Reads the action back, not the whole panel. */
  const speakResponse = () => {
    if (!result) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(
        result.stage
          ? `${result.stage}. ${result.what_to_do_next}`
          : result.what_to_do_next,
      );

      speech.lang =
        language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";

      speech.onstart = () => setIsSpeaking(true);
      speech.onend = () => setIsSpeaking(false);

      window.speechSynthesis.speak(speech);
    }
  };

  const selectedLanguage =
    languages.find((item) => item.code === language)?.name || "English";

  return (
    <main className="voice-nyaymitra-page">
      {/* BACK TO DASHBOARD */}
      <button type="button" className="voice-back-button" onClick={onBack}>
        ← Back to Dashboard
      </button>

      {/* HERO */}
      <section className="voice-hero">
        <div className="voice-hero-glow" />

        <div className="voice-hero-content">
          <div className="voice-eyebrow">
            <span>🎙</span>
            NYAYMITRA VOICE ASSISTANCE
          </div>

          <h1>
            Tell NyayMitra
            <br />
            <span>what happened.</span>
          </h1>

          <p>
            Speak about your situation in your own words. NyayMitra turns it
            into text and comes back with what to do next, and how urgent the
            matter looks.
          </p>

          <div className="voice-hero-pills">
            <span>Voice First</span>
            <span>Multilingual</span>
            <span>What to do next</span>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="voice-main">
        {/* NLP SERVICE STATUS */}
        <ServiceStatus />

        {/* LANGUAGE */}
        <div className="voice-language-card">
          <div>
            <span className="voice-small-label">CONVERSATION LANGUAGE</span>

            <h3>Choose your preferred language</h3>
          </div>

          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* VOICE AREA */}
        <div className="voice-assistant-card">
          <div className="voice-assistant-top">
            <div>
              <span className="voice-section-label">VOICE ASSISTANT</span>

              <h2>What happened?</h2>

              <p>
                Speak about it, or type what happened below.
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
                isListening ? "voice-microphone listening" : "voice-microphone"
              }
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              <span>{isListening ? "■" : "🎙"}</span>
            </button>

            <strong>{isListening ? "Listening..." : "Tap to speak"}</strong>

            <p>
              {isListening
                ? "Tell NyayMitra what has happened"
                : "Speak naturally in your selected language"}
            </p>
          </div>

          {/* WHAT THEY SAID */}
          <div className="voice-input-section">
            <div className="voice-input-heading">
              <label htmlFor="voice-question">WHAT YOU SAID</label>

              {question && !isReading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuestion("");
                    setResult(null);
                    setError("");
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              id="voice-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Your spoken account will appear here, and you can edit it before sending..."
              rows={5}
            />

            <div className="voice-input-footer">
              <span>{question.length} characters</span>

              <span>{selectedLanguage}</span>
            </div>
          </div>

          {/* ASK BUTTON */}
          <button
            type="button"
            className="voice-ask-button"
            disabled={!question.trim() || busy}
            onClick={handleAsk}
          >
            <span>✦</span>
            {busy ? "Reading your account..." : "What should I do next?"}
            <strong>→</strong>
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="voice-disclaimer">
            <span>ⓘ</span>

            <p>
              <strong>That could not be read:</strong> {error}
            </p>
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <div className="voice-guidance">
            {/* -------------------------------
                1. WHAT TO DO NEXT
                ------------------------------- */}
            <section className="voice-guidance-card">
              <div className="voice-guidance-head">
                <div className="voice-response-avatar">⚖</div>

                <div>
                  <span className="voice-section-label">
                    {result.matched
                      ? "MATCHED TO A CASE STAGE"
                      : "WHAT TO DO NEXT"}
                  </span>

                  <h2>What to do next</h2>
                </div>
              </div>

              <p className="voice-guidance-action">
                {result.what_to_do_next}
              </p>

              {result.matched && (
                <div className="voice-guidance-stage">
                  <span>Because it looks like this stage</span>

                  <strong>{result.stage}</strong>

                  <p>{result.why}</p>
                </div>
              )}

              {!result.matched && result.candidates.length > 0 && (
                <div className="voice-guidance-stage">
                  <span>Closest stages in the guidance set</span>

                  <ul className="voice-guidance-candidates">
                    {result.candidates.map((candidate) => (
                      <li key={candidate.stage}>
                        <strong>{candidate.stage}</strong>
                        <small>{candidate.urgency} urgency</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.related_terms.length > 0 && (
                <div className="voice-guidance-terms">
                  <span className="voice-section-label">LEGAL TERMS USED</span>

                  {result.related_terms.map((term) => (
                    <p key={term.term}>
                      <strong>{term.term} —</strong> {term.plain}
                    </p>
                  ))}
                </div>
              )}

              {/* Always shown: these four hold whatever the set matched. */}
              <div className="voice-guidance-checklist">
                <span className="voice-section-label">AND ANYWAY</span>

                <div className="voice-guidance-checklist-grid">
                  {GENERAL_CHECKLIST.map((step, index) => (
                    <article key={step.title}>
                      <div className="voice-guidance-number">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div>
                        <h3>{step.title}</h3>

                        <p>{step.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            {/* -------------------------------
                2. URGENCY OF YOUR INCIDENT
                ------------------------------- */}
            <section className="voice-guidance-card voice-urgency-card">
              <div className="voice-guidance-head">
                <div className="voice-response-avatar">◔</div>

                <div>
                  <span className="voice-section-label">URGENCY OF YOUR INCIDENT</span>

                  <h2>
                    {result.matched
                      ? "Preliminary urgency read"
                      : "Urgency not assessed"}
                  </h2>
                </div>
              </div>

              {result.matched ? (
                <div className="voice-urgency-body">
                  <div
                    className={`voice-urgency-badge ${
                      URGENCY_TONE[result.urgency ?? ""] ?? "is-low"
                    }`}
                  >
                    {(result.urgency ?? "low").toUpperCase()}
                  </div>

                  <p>
                    {URGENCY_BLURB[result.urgency ?? ""] ??
                      "No urgency band is recorded for this stage."}
                  </p>
                </div>
              ) : (
                <div className="voice-urgency-body">
                  <div className="voice-urgency-badge is-unknown">
                    NOT ASSESSED
                  </div>

                  <p>
                    Nothing was recognised, so no band could be borrowed for
                    it. Say a little more — a notice, a hearing date, an order,
                    a bail or custody situation — and both the action and the
                    urgency come back together.
                  </p>
                </div>
              )}

              <div className="voice-urgency-model-note">
                <span aria-hidden="true">⚙</span>

                <div>
                  <strong>The incident-urgency model is not connected yet</strong>

                  <p>
                    The band above is read off the case stage it matched, which
                    describes that stage in general. Scoring how urgent
                    <em> this</em> incident is — from what you actually said —
                    will come from the urgency model when its API is available,
                    and will replace this panel without changing anything else
                    on this page.
                  </p>
                </div>
              </div>
            </section>

            {/* ACTIONS */}
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
                <span>{isSpeaking ? "🔊" : "🔈"}</span>

                {isSpeaking ? "Speaking..." : "Read Aloud"}
              </button>

              <button
                type="button"
                className="voice-new-button"
                onClick={clearConversation}
              >
                New Question
              </button>
            </div>

            <div className="voice-disclaimer">
              <span>ⓘ</span>

              <p>{result.disclaimer}</p>
            </div>
          </div>
        )}

        {/* EXAMPLES */}
        <div className="voice-example-section">
          <div className="voice-section-heading">
            <span className="voice-section-label">TRY SAYING</span>

            <h2>Tell NyayMitra...</h2>
          </div>

          <div className="voice-example-grid">
            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "I received a legal notice from the other side last week and do not know what to reply.",
                )
              }
            >
              <span>📄</span>

              <div>
                <strong>Legal Notice</strong>

                <small>A notice arrived and no reply is drafted</small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "The judge adjourned my case without giving a new date.",
                )
              }
            >
              <span>⚖</span>

              <div>
                <strong>Adjourned</strong>

                <small>Hearing pushed with no date to replace it</small>
              </div>

              <b>→</b>
            </button>

            <button
              type="button"
              onClick={() =>
                setQuestion(
                  "My written statement has to be filed and I have not filed it yet.",
                )
              }
            >
              <span>📑</span>

              <div>
                <strong>Deadline Running</strong>

                <small>A filing is due and still not in</small>
              </div>

              <b>→</b>
            </button>
          </div>
        </div>

        {/* DISCLAIMER */}
        <div className="voice-disclaimer">
          <span>ⓘ</span>

          <p>
            <strong>Important:</strong> NyayMitra provides AI-assisted legal
            information for understanding legal processes. It is not a
            substitute for advice from a qualified legal professional.
          </p>
        </div>
      </section>
    </main>
  );
}
