import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VoiceNyayMitraPage from "./VoiceNyayMitraPage";
import { askWhatHappened } from "../../api/whatHappenedApi";
import type {
  WhatHappenedRequest,
  WhatHappenedResponse,
} from "../../api/whatHappenedApi";

/* =========================================================
   WHAT HAPPENED? — the acceptance criteria at screen level.

   The endpoint is mocked, so what is under test is this page's
   own behaviour:

     * the first screen offers exactly two doors and sends
       nothing;
     * the incident flow asks for a description — never a court
       stage — and renders the hedged answer with its plain
       time-sensitivity note instead of an urgency band;
     * the case flow reads the case store and sends the record
       along, never incident mode;
     * the microphone exists in BOTH workflows, the language
       selector really switches the next turn, and an answer can
       be read aloud — none of those send anything by themselves.

   The service's real responses are covered by
   `NyayMitra-feature-nlp-translation/test_what_happened.py`.
   ========================================================= */

vi.mock("../../api/whatHappenedApi", () => ({
  askWhatHappened: vi.fn(),
}));

vi.mock("../../api/translationApi", () => ({
  transcribeVoice: vi.fn(),
}));

vi.mock("../../components/ServiceStatus", () => ({
  default: () => null,
}));

vi.mock("../../api/caseApi", () => ({
  getCasesForUser: vi.fn(() => [CASE_RECORD]),
  isOngoing: vi.fn(() => true),
}));

const CASE_RECORD = {
  cnr_number: "MHPU210000042026",
  case_type: "Civil Suit",
  court_name: "Pune Civil Court",
  filing_number: "CASE/2026/4471",
  current_case_stage: "Case adjourned for want of time",
  next_hearing_date: "15.10.2026",
  petitioner_name: "Asha Patil",
  respondents_list: ["Ramesh Kumar"],
  case_history_timeline: [],
  timeline: [],
  orders: [],
};

const mockedAsk = vi.mocked(askWhatHappened);

/* A response shaped exactly like POST /api/what-happened returns,
   with the time sensitivity in its plain "nothing marked" state. */
const INCIDENT_ANSWER: WhatHappenedResponse = {
  mode: "incident",
  language: "en",
  conversation_id: "c_inc_0001",
  acknowledgement: "",
  summary:
    "From what you said, something that may be cheating appears to have happened.",
  possible_issue:
    "Possible cheating — only if what you described is what actually happened.",
  explanation:
    "Money was taken after an OTP was shared; nothing beyond that is assumed.",
  next_steps: [
    "Keep the messages and the payment record.",
    "Consider reporting it to the police cyber cell.",
  ],
  preserve_information: ["Screenshots of the chat and the OTP message."],
  follow_up_questions: ["When did this happen, and did you share anything else?"],
  case_facts: [],
  record_gaps: [],
  warnings: [
    "This reading is based only on what you described. It does not establish any fact, date or legal conclusion.",
  ],
  time_sensitive: false,
  time_sensitivity_note:
    "Nothing in what you said marks this as time-sensitive.",
  matched_stage: null,
  guidance: null,
  legal_terms: [],
  disclaimer: "This guidance is general legal information, not legal advice.",
};

const CASE_ANSWER: WhatHappenedResponse = {
  mode: "case",
  language: "en",
  conversation_id: "c_case_0001",
  acknowledgement: "",
  summary: "The record shows the next hearing on 15.10.2026.",
  possible_issue: "",
  explanation:
    "The case is listed for arguments on that date, recorded in the case information.",
  next_steps: ["You may consider reaching the court before that date."],
  preserve_information: [],
  follow_up_questions: ["Was any order passed at the last hearing?"],
  case_facts: [
    "Next hearing: 15.10.2026",
    "Stage: Case adjourned for want of time",
  ],
  record_gaps: ["The record does not say what was argued last time."],
  warnings: [
    "This answer is drawn only from the case information sent with the question.",
  ],
  time_sensitive: false,
  time_sensitivity_note:
    "The record marks a hearing date; keep track of it yourself.",
  matched_stage: null,
  guidance: null,
  legal_terms: [],
  disclaimer: "This guidance is general legal information, not legal advice.",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* ---------------- first screen: exactly two doors ---------------- */

describe("entry screen", () => {
  it("offers the two workflows and calls nothing yet", () => {
    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /what happened\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tell nyaymitra what happened/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/where would you like to start/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /tell us an incident/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ask about your case/i }),
    ).toBeInTheDocument();

    // Neither door has opened: no request, no composer.
    expect(mockedAsk).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("WHAT HAPPENED")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("YOUR QUESTION")).not.toBeInTheDocument();
  });
});

/* ---------------- workflow 1: tell us an incident ---------------- */

describe("incident workflow", () => {
  it("describes an incident, never a court stage, and hedges", async () => {
    mockedAsk.mockResolvedValue(INCIDENT_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );

    // The composer for this door — no case-question box in sight.
    expect(screen.getByText("TELL US WHAT HAPPENED")).toBeInTheDocument();
    expect(screen.queryByLabelText("YOUR QUESTION")).not.toBeInTheDocument();

    // No case-stage picker anywhere: only the LANGUAGE select exists.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone threatened me and demanded money from me." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(mockedAsk).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "incident",
          text: "Someone threatened me and demanded money from me.",
          language: "en",
          case_context: null,
        }),
      ),
    );

    // The panels of the answer, in order.
    expect(
      await screen.findByText(/something that may be cheating/i),
    ).toBeInTheDocument();
    for (const label of [
      "POSSIBLE LEGAL ISSUE",
      "WHAT YOU CAN CONSIDER DOING",
      "INFORMATION TO PRESERVE",
      "WHAT ELSE WOULD HELP",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Hedged: warnings shown, no matched stage, no invented court line.
    expect(
      screen.getByText(/based only on what you described/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/matched to the case stage/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/notice issued to respondent/i),
    ).not.toBeInTheDocument();
  });

  it("shows time sensitivity as a plain note — never a band", async () => {
    mockedAsk.mockResolvedValue(INCIDENT_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );
    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone threatened me and demanded money from me." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText(/nothing in what you said marks this as time-sensitive/i);

    // The note is a sentence, not a badge — this screen has no band.
    expect(document.querySelector(".wh-time")).not.toBeNull();
    expect(document.querySelector(".wh-urgency-badge")).toBeNull();
  });

  it("switching language keeps the conversation and changes the next turn", async () => {
    mockedAsk.mockResolvedValue(INCIDENT_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );

    // The selector is here, with the three languages as they are written.
    const languageSelect = screen.getByRole("combobox", {
      name: /^language$/i,
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(
      screen.getByRole("option", { name: "हिन्दी" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone threatened me and demanded money from me." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(mockedAsk).toHaveBeenCalledTimes(1));

    // Switch to मराठी — the answer stays on screen, nothing re-sends.
    fireEvent.change(languageSelect, { target: { value: "mr" } });
    expect(languageSelect).toHaveValue("mr");
    expect(
      screen.getByText(/something that may be cheating/i),
    ).toBeInTheDocument();
    expect(mockedAsk).toHaveBeenCalledTimes(1);

    // The next turn goes out in the new language, same conversation.
    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone broke the window of my shop last night." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mockedAsk).toHaveBeenCalledTimes(2));
    expect(mockedAsk).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: "incident",
        language: "mr",
        conversation_id: "c_inc_0001",
      }),
    );
    expect(
      screen.getAllByText(/something that may be cheating/i),
    ).toHaveLength(2);
  });
});

/* ---------------- workflow 2: ask about your case ---------------- */

describe("case workflow", () => {
  it("asks with the case record from the store and renders the answer", async () => {
    mockedAsk.mockResolvedValue(CASE_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /ask about your case/i }),
    );

    // The case picker lists the ongoing case…
    expect(
      screen.getByRole("option", { name: /MHPU210000042026/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("WHICH CASE?")).toBeInTheDocument();

    // …the microphone is offered here too…
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();

    // …and this door asks a question, not an incident description.
    expect(screen.queryByLabelText("WHAT HAPPENED")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("YOUR QUESTION"), {
      target: { value: "When is my next hearing?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mockedAsk).toHaveBeenCalledTimes(1));

    const payload = mockedAsk.mock.calls[0][0];
    expect(payload.mode).toBe("case");
    expect(payload.text).toBe("When is my next hearing?");
    expect(payload.case_id).toBe("MHPU210000042026");
    const context = payload.case_context as Record<string, unknown>;
    expect(context.cnr_number).toBe("MHPU210000042026");
    expect(context.current_case_stage).toBe(
      "Case adjourned for want of time",
    );

    // The answer renders with its grounding and its recorded gaps.
    expect(
      await screen.findByText(/record shows the next hearing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("WHAT THE AVAILABLE RECORD SAYS"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("WHAT THE RECORD DOES NOT STATE"),
    ).toBeInTheDocument();
    expect(screen.getByText("Next hearing: 15.10.2026")).toBeInTheDocument();
    expect(
      screen.getByText(/drawn only from the case information/i),
    ).toBeInTheDocument();
  });

  it("does not send incident mode from the case flow", async () => {
    mockedAsk.mockResolvedValue(CASE_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /ask about your case/i }),
    );
    fireEvent.change(screen.getByLabelText("YOUR QUESTION"), {
      target: { value: "What should I do next?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(mockedAsk).toHaveBeenCalled());

    const modes = mockedAsk.mock.calls.map(
      ([request]: WhatHappenedRequest[]) => request.mode,
    );
    expect(modes).not.toContain("incident");
    expect(modes).toEqual(["case"]);
  });
});

/* ---------------- voice: microphone + read aloud ---------------- */

describe("voice", () => {
  it("offers the microphone in both workflows", () => {
    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^change$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /ask about your case/i }),
    );
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();

    // Pressing it is a voice action, never a send.
    expect(mockedAsk).not.toHaveBeenCalled();
  });

  it("reads an answer aloud without sending anything new", async () => {
    // jsdom has no speech synthesis; the page must degrade quietly.
    expect("speechSynthesis" in window).toBe(false);

    mockedAsk.mockResolvedValue(INCIDENT_ANSWER);

    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );
    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone threatened me and demanded money from me." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    const readButton = await screen.findByRole("button", {
      name: /read aloud/i,
    });
    fireEvent.click(readButton);

    // Reading aloud is playback only — still exactly one turn sent.
    expect(mockedAsk).toHaveBeenCalledTimes(1);
  });
});

/* ---------------- switching between the doors ---------------- */

describe("workflow separation", () => {
  it("returns to the two choices without sending anything", () => {
    render(<VoiceNyayMitraPage userId="USER_0001" onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /tell us an incident/i }),
    );
    fireEvent.change(screen.getByLabelText("WHAT HAPPENED"), {
      target: { value: "Someone threatened me and demanded money from me." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^change$/i }));

    expect(screen.getByText(/where would you like to start/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tell us an incident/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ask about your case/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("WHAT HAPPENED")).not.toBeInTheDocument();
    expect(mockedAsk).not.toHaveBeenCalled();
  });
});
