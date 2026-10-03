import { useEffect, useRef, useState } from "react";

import { transcribeVoice } from "../../api/translationApi";
import {
  askWhatHappened,
} from "../../api/whatHappenedApi";
import type {
  WhatHappenedLanguage,
  WhatHappenedMode,
  WhatHappenedResponse,
} from "../../api/whatHappenedApi";
import { getCasesForUser } from "../../api/caseApi";

import ServiceStatus from "../../components/ServiceStatus";
import "./WhatHappened.css";

/* =========================================================
   WHAT HAPPENED? — NyayMitra case & incident companion

   The screen that used to be "Voice NyayMitra". The route is
   unchanged (`voice` in App.tsx), so every existing link still
   lands here; only what the person is asked at the door has
   changed.

   The first decision is not "voice or typing" — it is
   INCIDENT or CASE:

     🧑 Tell us an incident   something happened, understand it
     ⚖ Ask about your case    a case is running, ask what is next

   Both doors lead to the same conversation box: type, or press
   the microphone, read the transcript back, correct it, send.
   The answer comes from POST /api/what-happened — incident
   understanding and grounded case answers are the backend's
   work; this file is the conversation around them.

   Voice: the existing ASR endpoint does the transcribing, the
   browser's speech synthesis reads answers back. Turn-based on
   purpose — speak, read, correct, send, hear the reply.
   ========================================================= */

type VoiceNyayMitraPageProps = {
  onBack: () => void;
  userId: string;
};

/* The selector shows the language as it is written. */
const languages: {
  code: WhatHappenedLanguage;
  name: string;
}[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
];

type VoiceState = "idle" | "listening" | "transcribing";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; response: WhatHappenedResponse };

const INCIDENT_EXAMPLES = [
  "Someone called me pretending to be from my bank and asked for my OTP. I gave it and money was deducted.",
  "Someone threatened me and demanded money.",
  "My landlord wants me to vacate the flat before the notice period ends.",
];

const CASE_EXAMPLES = [
  "What happened in my last hearing?",
  "What should I do next?",
  "When is my next hearing?",
  "What did the latest order say?",
  "Why was the hearing postponed?",
  "What is the current status?",
];

let turnSeq = 0;

function nextTurnId(): string {
  turnSeq += 1;
  return `t${turnSeq}`;
}

/* Browser TTS voice for the chosen language. Falls back to the
   default voice when the language has none installed — speaking in
   the wrong accent still beats not speaking at all. */
function speechLang(code: WhatHappenedLanguage): string {
  if (code === "hi") return "hi-IN";
  if (code === "mr") return "mr-IN";
  return "en-IN";
}

/** What the read-aloud control actually says: the answer, then the
 *  two most useful next steps. Long enough to be worth hearing,
 *  short enough not to lose the listener. */
function speakable(response: WhatHappenedResponse): string {
  const parts = [
    response.acknowledgement,
    response.summary,
    response.possible_issue,
    response.explanation,
    ...response.next_steps.slice(0, 2),
  ].filter(Boolean);

  const text = parts.join(". ").replace(/\s+/g, " ").trim();

  return text.length > 900 ? `${text.slice(0, 897)}…` : text;
}

export default function VoiceNyayMitraPage({
  onBack,
  userId,
}: VoiceNyayMitraPageProps) {
  /* ---------- navigation between the two doors ---------- */
  const [mode, setMode] = useState<WhatHappenedMode | null>(null);

  /* ---------- conversation ---------- */
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] =
    useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* ---------- language ---------- */
  const [language, setLanguage] =
    useState<WhatHappenedLanguage>("en");

  /* ---------- voice ---------- */
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcriptReady, setTranscriptReady] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /* ---------- read aloud ---------- */
  /* Which turn is speaking — one id, so only that card shows
     "Speaking…" and Stop only stops what is actually talking. */
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceConversation, setVoiceConversation] = useState(false);

  /* ---------- case mode ---------- */
  const cases = getCasesForUser(userId);
  const [selectedCnr, setSelectedCnr] = useState<string>("");

  const selectedCase =
    cases.find((item) => item.cnr_number === selectedCnr) ??
    cases[0] ??
    null;

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  };

  /* Stop any playback when the page goes away, so a half-read
     answer does not keep talking over the dashboard. */
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = (text: string, turnId?: string) => {
    if (!text.trim() || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang(language);
    utterance.onstart = () => setSpeakingId(turnId ?? "auto");
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    window.speechSynthesis.speak(utterance);
  };

  /* =======================================================
     MICROPHONE — existing ASR endpoint, existing recorder
     flow. The transcript lands in the box to be edited; it is
     never sent on its own.
     ======================================================= */

  const blobToWav = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();

    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const wavBuffer = new ArrayBuffer(
      44 + length * numberOfChannels * 2,
    );
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
        const sample = Math.max(
          -1,
          Math.min(1, channels[channel][i]),
        );

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
    if (voiceState !== "idle") return;

    setVoiceNotice("");
    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access is not supported by this browser.",
        );
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

        const recordedBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType,
        });

        try {
          const audioBlob = await blobToWav(recordedBlob);

          setVoiceState("transcribing");

          const data = await transcribeVoice(audioBlob, language);

          /* The transcript is only ever a draft: it lands in the
             box, editable, and nothing is sent until Send. */
          setInput(data.transcribed_text || "");
          setTranscriptReady(Boolean(data.transcribed_text?.trim()));

          if (!data.transcribed_text?.trim()) {
            setVoiceNotice(
              "Nothing was heard. Try again, a little closer to the microphone.",
            );
          }
        } catch (caught) {
          console.error("Voice transcription error:", caught);

          setVoiceNotice(
            caught instanceof Error
              ? caught.message
              : "Unable to transcribe the recording.",
          );
        } finally {
          setVoiceState("idle");
        }
      };

      mediaRecorderRef.current = recorder;

      recorder.start();

      setVoiceState("listening");
    } catch (caught) {
      console.error("Microphone error:", caught);

      setVoiceState("idle");
      setVoiceNotice(
        "Microphone access was denied or unavailable. You can type instead.",
      );
    }
  };

  const stopListening = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  /* =======================================================
     SENDING A TURN
     ======================================================= */

  const handleSend = async () => {
    const text = input.trim();

    if (!text || busy || !mode) return;

    setBusy(true);
    setError("");
    stopSpeaking();

    const userTurn: Turn = {
      id: nextTurnId(),
      role: "user",
      text,
    };

    try {
      const response = await askWhatHappened({
        mode,
        text,
        language,
        case_id: selectedCase?.cnr_number,
        conversation_id: conversationId ?? undefined,
        case_context:
          mode === "case" && selectedCase ? selectedCase : null,
      });

      setConversationId(response.conversation_id);

      const assistantTurn: Turn = {
        id: nextTurnId(),
        role: "assistant",
        response,
      };

      setTurns((previous) => [...previous, userTurn, assistantTurn]);
      setInput("");
      setTranscriptReady(false);

      if (voiceConversation) {
        speak(speakable(response), assistantTurn.id);
      }
    } catch (caught) {
      console.error("What-happened error:", caught);

      setError(
        caught instanceof Error
          ? caught.message
          : "NyayMitra could not read that just now.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resetConversation = () => {
    setTurns([]);
    setConversationId(null);
    setInput("");
    setError("");
    setTranscriptReady(false);
    stopSpeaking();
  };

  const pickMode = (next: WhatHappenedMode) => {
    setMode(next);
    resetConversation();
  };

  const placeholder =
    mode === "case"
      ? "Ask about your case… (for example: when is my next hearing?)"
      : "Tell us what happened…";

  const examples = mode === "case" ? CASE_EXAMPLES : INCIDENT_EXAMPLES;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="voice-nyaymitra-page">
      {/* BACK TO DASHBOARD */}
      <button
        type="button"
        className="voice-back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* HERO */}
      <section className="voice-hero">
        <div className="voice-hero-glow" />

        <div className="voice-hero-content">
          <div className="voice-eyebrow">
            <span>⚖</span>
            NYAYMITRA CASE & INCIDENT COMPANION
          </div>

          <h1>
            What <span>Happened?</span>
          </h1>

          <p>
            Tell NyayMitra what happened, or ask about your case.
          </p>

          <div className="voice-hero-pills">
            <span>Type or speak</span>
            <span>English · हिन्दी · मराठी</span>
            <span>General legal information</span>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="voice-main">
        {/* NLP SERVICE STATUS */}
        <ServiceStatus />

        {/* ------------------------------------------------
            LANDING — incident or case, nothing else
            ------------------------------------------------ */}
        {mode === null && (
          <>
            <div className="wh-intro">
              <span className="voice-section-label">
                WHERE WOULD YOU LIKE TO START?
              </span>

              <p>
                Choose the door that fits. You can type or speak on
                the next screen — that choice comes later.
              </p>
            </div>

            <div className="wh-choice-grid">
              <button
                type="button"
                className="wh-choice-card wh-choice-incident"
                onClick={() => pickMode("incident")}
              >
                <span className="wh-choice-icon">🧑</span>

                <div>
                  <h2>Tell us an incident</h2>

                  <p>
                    “Something happened to me and I want to
                    understand it.”
                  </p>
                </div>

                <b>→</b>
              </button>

              <button
                type="button"
                className="wh-choice-card wh-choice-case"
                onClick={() => pickMode("case")}
              >
                <span className="wh-choice-icon">⚖</span>

                <div>
                  <h2>Ask about your case</h2>

                  <p>
                    “I already have a case and want to understand
                    what happened or what to do next.”
                  </p>
                </div>

                <b>→</b>
              </button>
            </div>

            <div className="voice-disclaimer">
              <span>ⓘ</span>

              <p>
                <strong>Important:</strong> NyayMitra provides
                general legal information for understanding legal
                processes. It is not a substitute for advice from a
                qualified legal professional.
              </p>
            </div>
          </>
        )}

        {/* ------------------------------------------------
            CONVERSATION (both modes)
            ------------------------------------------------ */}
        {mode !== null && (
          <>
            {/* MODE + LANGUAGE */}
            <div className="voice-language-card">
              <div>
                <span className="voice-small-label">
                  {mode === "incident"
                    ? "MODE — TELL US AN INCIDENT"
                    : "MODE — ASK ABOUT YOUR CASE"}
                </span>

                <h3>
                  {mode === "incident"
                    ? "Something happened to me"
                    : "I already have a case running"}
                </h3>
              </div>

              <div className="wh-mode-controls">
                <button
                  type="button"
                  className="wh-change-mode"
                  onClick={() => setMode(null)}
                >
                  Change
                </button>

                <label className="wh-language">
                  <span>LANGUAGE</span>

                  <select
                    value={language}
                    onChange={(event) =>
                      setLanguage(
                        event.target.value as WhatHappenedLanguage,
                      )
                    }
                  >
                    {languages.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* CASE PICKER — case mode only */}
            {mode === "case" && (
              <div className="wh-case-picker">
                {cases.length > 0 ? (
                  <label>
                    <span className="voice-section-label">
                      WHICH CASE?
                    </span>

                    <select
                      value={selectedCase?.cnr_number ?? ""}
                      onChange={(event) =>
                        setSelectedCnr(event.target.value)
                      }
                    >
                      {cases.map((item) => (
                        <option
                          key={item.cnr_number}
                          value={item.cnr_number}
                        >
                          {item.case_type} — {item.cnr_number} —{" "}
                          {item.current_case_stage}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p>
                    No case is saved on this account yet, so answers
                    stay general. Search a CNR in My Cases, save the
                    case, and it will be selectable here.
                  </p>
                )}
              </div>
            )}

            {/* TRANSCRIPT */}
            {turns.length > 0 && (
              <div className="wh-transcript">
                <span className="voice-section-label">
                  THE CONVERSATION
                </span>

                {turns.map((turn) =>
                  turn.role === "user" ? (
                    <div
                      key={turn.id}
                      className="wh-turn wh-turn-user"
                    >
                      <span>You</span>
                      <p>{turn.text}</p>
                    </div>
                  ) : (
                    <AnswerCard
                      key={turn.id}
                      response={turn.response}
                      speaking={speakingId === turn.id}
                      onRead={() => speak(speakable(turn.response), turn.id)}
                      onStop={stopSpeaking}
                    />
                  ),
                )}
              </div>
            )}

            {/* ERROR */}
            {error && (
              <div className="voice-disclaimer wh-error">
                <span>ⓘ</span>

                <p>
                  <strong>That could not be sent:</strong> {error}
                </p>
              </div>
            )}

            {/* VOICE NOTICE (ASR, microphone, English) */}
            {voiceNotice && (
              <div className="voice-disclaimer wh-error">
                <span>ⓘ</span>

                <p>
                  <strong>Voice:</strong> {voiceNotice}
                </p>
              </div>
            )}

            {/* INPUT */}
            <div className="voice-assistant-card">
              <div className="voice-assistant-top">
                <div>
                  <span className="voice-section-label">
                    {mode === "incident"
                      ? "TELL US WHAT HAPPENED"
                      : "ASK ABOUT YOUR CASE"}
                  </span>

                  <h2>
                    {voiceState === "listening"
                      ? "LISTENING…"
                      : voiceState === "transcribing"
                        ? "TRANSCRIBING…"
                        : "What happened?"}
                  </h2>

                  <p>
                    {voiceState === "listening"
                      ? "Speak naturally in your selected language"
                      : voiceState === "transcribing"
                        ? "Turning your speech into text…"
                        : "Type it, or press the microphone and speak."}
                  </p>
                </div>

                <div className="voice-status">
                  <span />
                  {busy ? "Working…" : "Ready"}
                </div>
              </div>

              {/* WHAT YOU SAID — editable */}
              <div className="voice-input-section">
                <div className="voice-input-heading">
                  <label htmlFor="wh-input">
                    {transcriptReady
                      ? "WHAT YOU SAID — EDIT BEFORE SENDING"
                      : mode === "case"
                        ? "YOUR QUESTION"
                        : "WHAT HAPPENED"}
                  </label>

                  {input && !busy && (
                    <button
                      type="button"
                      onClick={() => {
                        setInput("");
                        setTranscriptReady(false);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  id="wh-input"
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    setTranscriptReady(false);
                  }}
                  placeholder={placeholder}
                  rows={5}
                  disabled={voiceState !== "idle"}
                />

                <div className="voice-input-footer">
                  <span>{input.length} characters</span>

                  <span>
                    {languages.find((item) => item.code === language)
                      ?.name ?? "English"}
                  </span>
                </div>
              </div>

              {/* MIC + SEND, inside the box */}
              <div className="wh-composer">
                <button
                  type="button"
                  className={
                    voiceState === "listening"
                      ? "voice-microphone listening"
                      : "voice-microphone"
                  }
                  onClick={
                    voiceState === "listening"
                      ? stopListening
                      : startListening
                  }
                  disabled={voiceState === "transcribing" || busy}
                  aria-label={
                    voiceState === "listening"
                      ? "Stop listening"
                      : "Start voice input"
                  }
                >
                  <span>
                    {voiceState === "listening" ? "■" : "🎙"}
                  </span>
                </button>

                <div className="wh-composer-hint">
                  {voiceState === "listening"
                    ? "LISTENING… tap to stop"
                    : voiceState === "transcribing"
                      ? "TRANSCRIBING…"
                      : transcriptReady
                        ? "Check the transcript above, then send"
                        : "Speak, or type below"}
                </div>

                <button
                  type="button"
                  className="voice-ask-button wh-send"
                  onClick={handleSend}
                  disabled={!input.trim() || busy}
                >
                  <span>✦</span>
                  {busy ? "Thinking…" : "Send"}
                  <strong>→</strong>
                </button>
              </div>
            </div>

            {/* VOICE CONVERSATION */}
            <div className="wh-voice-bar">
              <button
                type="button"
                className={
                  voiceConversation
                    ? "wh-voice-toggle on"
                    : "wh-voice-toggle"
                }
                onClick={() => {
                  if (voiceConversation) stopSpeaking();
                  setVoiceConversation((value) => !value);
                }}
              >
                <span>🎙</span>
                {voiceConversation
                  ? "Voice conversation on"
                  : "Start voice conversation"}
              </button>

              {speakingId && (
                <button
                  type="button"
                  className="wh-voice-toggle"
                  onClick={stopSpeaking}
                >
                  <span>🔇</span>
                  Stop speaking
                </button>
              )}

              {turns.length > 0 && (
                <button
                  type="button"
                  className="wh-voice-toggle"
                  onClick={resetConversation}
                >
                  New conversation
                </button>
              )}

              <p>
                {voiceConversation
                  ? "Speak, hear the answer, then speak again — the microphone never opens on its own."
                  : "With voice conversation on, every answer is read aloud."}
              </p>
            </div>

            {/* EXAMPLES */}
            <div className="voice-example-section">
              <div className="voice-section-heading">
                <span className="voice-section-label">
                  {mode === "case"
                    ? "TRY ASKING"
                    : "TRY SAYING"}
                </span>

                <h2>
                  {mode === "case"
                    ? "Ask NyayMitra about your case…"
                    : "Tell NyayMitra…"}
                </h2>
              </div>

              <div className="voice-example-grid">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInput(example);
                      setTranscriptReady(false);
                    }}
                  >
                    <span>{mode === "case" ? "⚖" : "📄"}</span>

                    <div>
                      <small>{example}</small>
                    </div>

                    <b>→</b>
                  </button>
                ))}
              </div>
            </div>

            {/* DISCLAIMER */}
            <div className="voice-disclaimer">
              <span>ⓘ</span>

              <p>
                <strong>Important:</strong> NyayMitra provides
                general legal information for understanding legal
                processes. It is not a substitute for advice from a
                qualified legal professional.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

/* =========================================================
   ANSWER CARD — one assistant turn, rendered from the same
   envelope in both modes. Incident mode shows the five panels;
   case mode shows what the record says and what it does not.
   ========================================================= */

type AnswerCardProps = {
  response: WhatHappenedResponse;
  speaking: boolean;
  onRead: () => void;
  onStop: () => void;
};

function AnswerCard({
  response,
  speaking,
  onRead,
  onStop,
}: AnswerCardProps) {
  const isCase = response.mode === "case";

  return (
    <div className="wh-turn wh-turn-nyaymitra">
      <div className="wh-answer-head">
        <div className="voice-response-avatar">
          {isCase ? "⚖" : "🧑"}
        </div>

        <div>
          <span className="voice-section-label">
            {isCase ? "ABOUT YOUR CASE" : "WHAT MAY HAVE HAPPENED"}
          </span>

          <h3>NyayMitra</h3>
        </div>

        <button
          type="button"
          className={speaking ? "voice-speak-button speaking" : "voice-speak-button"}
          onClick={speaking ? onStop : onRead}
        >
          <span>{speaking ? "🔊" : "🔈"}</span>
          {speaking ? "Speaking…" : "Read aloud"}
        </button>
      </div>

      {response.acknowledgement && (
        <p className="wh-ack">{response.acknowledgement}</p>
      )}

      {/* ---------- WHAT MAY HAVE HAPPENED / THE RECORD SAYS ---------- */}
      <section className="wh-panel">
        <span className="wh-panel-title">
          {isCase ? "WHAT THE AVAILABLE RECORD SAYS" : "WHAT MAY HAVE HAPPENED"}
        </span>

        <p className="wh-panel-lead">{response.summary}</p>

        <p>{response.explanation}</p>

        {isCase && response.case_facts.length > 0 && (
          <ul className="wh-facts">
            {response.case_facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- POSSIBLE LEGAL ISSUE (incident only) ---------- */}
      {!isCase && response.possible_issue && (
        <section className="wh-panel">
          <span className="wh-panel-title">POSSIBLE LEGAL ISSUE</span>

          <p>{response.possible_issue}</p>
        </section>
      )}

      {/* ---------- THE RECORD DOES NOT STATE (case only) ---------- */}
      {isCase && response.record_gaps.length > 0 && (
        <section className="wh-panel wh-panel-gap">
          <span className="wh-panel-title">
            WHAT THE RECORD DOES NOT STATE
          </span>

          <ul>
            {response.record_gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- WHAT YOU CAN CONSIDER DOING ---------- */}
      {response.next_steps.length > 0 && (
        <section className="wh-panel">
          <span className="wh-panel-title">
            WHAT YOU CAN CONSIDER DOING
          </span>

          {response.matched_stage && (
            <p className="wh-stage">
              Matched to the case stage{" "}
              <strong>{response.matched_stage}</strong> — a match on
              words, not a finding about your case.
            </p>
          )}

          <ol>
            {response.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------- INFORMATION TO PRESERVE (incident only) ---------- */}
      {!isCase && response.preserve_information.length > 0 && (
        <section className="wh-panel">
          <span className="wh-panel-title">
            INFORMATION TO PRESERVE
          </span>

          <ul>
            {response.preserve_information.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- WHAT ELSE WOULD HELP ---------- */}
      {response.follow_up_questions.length > 0 && (
        <section className="wh-panel">
          <span className="wh-panel-title">WHAT ELSE WOULD HELP</span>

          <ul>
            {response.follow_up_questions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- LEGAL TERMS, in the chosen language ---------- */}
      {response.legal_terms.length > 0 && (
        <section className="wh-panel">
          <span className="wh-panel-title">
            LEGAL TERMS, IN PLAIN WORDS
          </span>

          {response.legal_terms.map((term) => (
            <p className="wh-term" key={term.term}>
              <strong>{term.term}</strong> — {term.plain}
            </p>
          ))}
        </section>
      )}

      {/* ---------- TIME SENSITIVITY ---------- */}
      <div className={response.time_sensitive ? "wh-time is-soon" : "wh-time"}>
        <span>{response.time_sensitive ? "⏱" : "◌"}</span>

        <p>{response.time_sensitivity_note}</p>
      </div>

      {/* ---------- WARNINGS ---------- */}
      {response.warnings.length > 0 && (
        <div className="wh-warnings">
          {response.warnings.map((warning) => (
            <p key={warning}>ⓘ {warning}</p>
          ))}
        </div>
      )}

      <p className="wh-disclaimer">{response.disclaimer}</p>
    </div>
  );
}
