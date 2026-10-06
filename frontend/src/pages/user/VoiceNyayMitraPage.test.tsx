import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import VoiceNyayMitraPage from "./VoiceNyayMitraPage";
import { ModelApiError, understandSituation } from "../../services/modelApi";
import { getGuidance } from "../../api/guidanceApi";
import type { GuidanceResult } from "../../api/guidanceApi";

/* =========================================================
   TELL US WHAT HAPPENED — screen-level acceptance after the
   merge with Member 2's model integration.

   The model client is mocked; the real adapter
   (toWhatHappenedView) runs, so what is under test is this
   page's own behaviour around POST /understand-situation:

     * nothing is sent on arrival;
     * a description comes back as intent / category /
       confidence / facts / missing information panels;
     * the unclear case shows the rephrase prompt and never
       renders a category the model declined to assign;
     * each failure kind gets its own title, and a guidance
       outage never costs the model result;
     * the microphone and read-aloud are playback actions —
       neither sends anything by itself.
   ========================================================= */

vi.mock("../../services/modelApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/modelApi")>();

  return { ...actual, understandSituation: vi.fn() };
});

vi.mock("../../api/guidanceApi", () => ({
  getGuidance: vi.fn(),
}));

vi.mock("../../api/translationApi", () => ({
  transcribeVoice: vi.fn(),
}));

vi.mock("../../components/ServiceStatus", () => ({
  default: () => null,
}));

type Wire = Awaited<ReturnType<typeof understandSituation>>;

/* Exactly what POST /understand-situation returned in the live
   API tests — fed through the real view adapter. */
const INCIDENT_WIRE: Wire = {
  intent: "incident",
  incident_category: "threats_intimidation_or_intentional_insult",
  category_id: "INC011",
  confidence: 0.632,
  facts: { threat: "threatened", "date/time": "last night" },
  missing_information: ["person involved", "witnesses"],
  message: null,
};

const UNCLEAR_WIRE: Wire = {
  intent: "unclear",
  incident_category: null,
  category_id: null,
  confidence: 0.29,
  facts: null,
  missing_information: null,
  message:
    "I could not understand that confidently. Please rephrase your message or add a few more details about what happened.",
};

const GUIDANCE: GuidanceResult = {
  matched: true,
  stage: "Case adjourned for want of time",
  urgency: "medium",
  why: "the words used match that stage",
  what_to_do_next: "Confirm the next hearing date with the court record.",
  related_terms: [{ term: "adjourn", plain: "postponed to another day" }],
  candidates: [],
  disclaimer: "General legal information, not legal advice.",
};

const mockedUnderstand = vi.mocked(understandSituation);
const mockedGuidance = vi.mocked(getGuidance);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByLabelText("WHAT YOU SAID"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: /tell nyaymitra/i }));
};

/* ---------------- arrival ---------------- */

describe("entry screen", () => {
  it("offers the composer and calls nothing yet", () => {
    render(<VoiceNyayMitraPage onBack={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /what happened\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/say what happened in your own words/i),
    ).toBeInTheDocument();

    // One language selector, the microphone, an empty composer.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
    expect(screen.getByLabelText("WHAT YOU SAID")).toBeInTheDocument();

    expect(mockedUnderstand).not.toHaveBeenCalled();
  });
});

/* ---------------- the model call ---------------- */

describe("understand-situation flow", () => {
  it("sends the description and renders what the model understood", async () => {
    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockRejectedValue(new Error("guidance down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");

    await waitFor(() =>
      expect(mockedUnderstand).toHaveBeenCalledWith(
        "Someone threatened me and demanded money from me.",
      ),
    );

    // The panels, in the model's own vocabulary.
    expect(await screen.findByText("CONFIDENCE")).toBeInTheDocument();
    expect(screen.getByText("INCIDENT CATEGORY")).toBeInTheDocument();
    expect(
      screen.getByText("threats intimidation or intentional insult"),
    ).toBeInTheDocument();
    expect(screen.getByText("INC011")).toBeInTheDocument();
    expect(screen.getByText(/threat:\s*threatened/i)).toBeInTheDocument();
    expect(screen.getByText("person involved")).toBeInTheDocument();

    // The chip carries the intent.
    expect(document.querySelector(".wh-intent-chip")).not.toBeNull();
  });

  it("the unclear case rephrases and never invents a category", async () => {
    mockedUnderstand.mockResolvedValue(UNCLEAR_WIRE);
    mockedGuidance.mockRejectedValue(new Error("guidance down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("xq9#vZ!pla?42 42 42 asdfghjkl;qwerty");

    expect(
      await screen.findByText(/i could not understand that confidently/i),
    ).toBeInTheDocument();
    expect(screen.getByText("WE COULD NOT TELL YET")).toBeInTheDocument();

    // The guard: no category, no facts, no missing-information panel.
    expect(screen.queryByText("INCIDENT CATEGORY")).not.toBeInTheDocument();
    expect(
      screen.queryByText("WHAT WE FOUND IN YOUR ACCOUNT"),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".wh-intent-chip.is-unclear")).not.toBeNull();
  });

  it("keeps the answers on a language switch and only sends the text", async () => {
    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockRejectedValue(new Error("guidance down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");
    expect(await screen.findByText("CONFIDENCE")).toBeInTheDocument();

    // Switch to मराठी — the answer stays, nothing re-sends.
    const languageSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(languageSelect, { target: { value: "mr" } });
    expect(languageSelect).toHaveValue("mr");
    expect(screen.getAllByText("CONFIDENCE")).toHaveLength(1);
    expect(mockedUnderstand).toHaveBeenCalledTimes(1);

    // The next turn goes out as text alone — no conversation to lose.
    typeAndSend("Someone broke the window of my shop last night.");
    await waitFor(() => expect(mockedUnderstand).toHaveBeenCalledTimes(2));
    expect(mockedUnderstand).toHaveBeenLastCalledWith(
      "Someone broke the window of my shop last night.",
    );
    expect(screen.getAllByText("CONFIDENCE")).toHaveLength(2);
  });
});

/* ---------------- failures ---------------- */

describe("failures", () => {
  it("titles a network failure by its kind, never one generic message", async () => {
    mockedUnderstand.mockRejectedValue(
      new ModelApiError("Connection refused.", "network"),
    );

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");

    expect(
      await screen.findByText("The model service could not be reached:"),
    ).toBeInTheDocument();
    // Nothing rendered as a result.
    expect(screen.queryByText("CONFIDENCE")).not.toBeInTheDocument();
  });

  it("a guidance outage never costs the model result", async () => {
    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockRejectedValue(new Error("nlp down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");

    expect(await screen.findByText("CONFIDENCE")).toBeInTheDocument();
    expect(
      screen.queryByText("WHAT TO DO NEXT"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("MATCHED TO A CASE STAGE"),
    ).not.toBeInTheDocument();
  });

  it("renders the guidance panel when the NLP service answers", async () => {
    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockResolvedValue(GUIDANCE);

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");

    expect(await screen.findByText("CONFIDENCE")).toBeInTheDocument();
    expect(
      screen.getByText("MATCHED TO A CASE STAGE"),
    ).toBeInTheDocument();
    expect(screen.getByText("URGENCY OF YOUR INCIDENT")).toBeInTheDocument();
  });
});

/* ---------------- voice ---------------- */

describe("voice", () => {
  it("offers the microphone without sending anything", () => {
    render(<VoiceNyayMitraPage onBack={vi.fn()} />);

    expect(screen.getByLabelText("Start voice input")).toBeInTheDocument();
    expect(mockedUnderstand).not.toHaveBeenCalled();
  });

  it("reads an answer aloud without sending anything new", async () => {
    // jsdom has no speech synthesis; the page must degrade quietly.
    expect("speechSynthesis" in window).toBe(false);

    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockRejectedValue(new Error("guidance down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");

    const readButton = await screen.findByRole("button", {
      name: /read aloud/i,
    });
    fireEvent.click(readButton);

    // Reading aloud is playback only — still exactly one turn sent.
    expect(mockedUnderstand).toHaveBeenCalledTimes(1);
  });
});

/* ---------------- clearing ---------------- */

describe("clear conversation", () => {
  it("“Start a new account” empties the transcript without another call", async () => {
    mockedUnderstand.mockResolvedValue(INCIDENT_WIRE);
    mockedGuidance.mockRejectedValue(new Error("guidance down"));

    render(<VoiceNyayMitraPage onBack={vi.fn()} />);
    typeAndSend("Someone threatened me and demanded money from me.");
    expect(await screen.findByText("CONFIDENCE")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /start a new account/i }),
    );

    expect(screen.queryByText("CONFIDENCE")).not.toBeInTheDocument();
    expect(screen.queryByText("What we understood")).not.toBeInTheDocument();
    expect(mockedUnderstand).toHaveBeenCalledTimes(1);
  });
});
