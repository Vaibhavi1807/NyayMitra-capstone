import { useEffect, useState } from "react";

import { getLawyers, type Lawyer } from "../api/lawyerApi";
import { addCase } from "../api/caseApi";
import {
  DOCUMENT_CATEGORIES,
  addDocument,
  readFileAsDataUrl,
  type DocumentCategory,
} from "../api/documentApi";

import "./AddCaseForm.css";

/* =========================================================
   MY CASES — FILE A NEW MATTER

   The form behind "File a new case". It collects what a
   registry would need to open a record — parties, court,
   statute, dates — plus two things a paper form cannot take:

   · the advocate who will handle it, picked from the live
     lawyer directory so the matter lands on somebody's
     caseload rather than in a void;
   · the documents that go with the filing, uploaded in the
     same step instead of after the fact, because the first
     set of papers is what makes a case real.

   Validation is deliberately narrow: everything a court
   record cannot exist without is required, and everything
   that can be filled in later is not.
   ========================================================= */

type AddCaseFormProps = {
  userId: string;

  /* Used to prefill the petitioner field — the filer is
     usually the party, and an empty box is a worse default
     than an editable correct answer. */
  defaultPetitioner: string;

  onCancel: () => void;
  onCreated: (cnr: string) => void;
};

const CASE_TYPES = [
  "Civil Suit",
  "Criminal Complaint",
  "Writ Petition",
  "Family Matter",
  "Consumer Complaint",
  "Property Dispute",
  "Labour Dispute",
  "Cheque Bounce (138 NI Act)",
  "Commercial Arbitration",
  "Other",
];

const SAMPLE_ACTS = [
  "Indian Penal Code, 1860",
  "Code of Civil Procedure, 1908",
  "Constitution of India",
  "Consumer Protection Act, 2019",
  "Indian Contract Act, 1872",
  "Negotiable Instruments Act, 1881",
  "Hindu Marriage Act, 1955",
  "Specific Relief Act, 1963",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AddCaseForm({
  userId,
  defaultPetitioner,
  onCancel,
  onCreated,
}: AddCaseFormProps) {
  const [caseType, setCaseType] = useState(CASE_TYPES[0]);
  const [petitioner, setPetitioner] = useState(defaultPetitioner);
  const [respondents, setRespondents] = useState("");
  const [courtState, setCourtState] = useState("");
  const [courtDistrict, setCourtDistrict] = useState("");
  const [courtName, setCourtName] = useState("");
  const [judge, setJudge] = useState("");
  const [act, setAct] = useState(SAMPLE_ACTS[0]);
  const [section, setSection] = useState("");
  const [filingDate, setFilingDate] = useState(today());
  const [hearingDate, setHearingDate] = useState("");

  const [lawyerId, setLawyerId] = useState("");
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [lawyersLoaded, setLawyersLoaded] = useState(false);

  const [category, setCategory] =
    useState<DocumentCategory>("Filing");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The directory, for the advocate picker. It is a nicety,
     not a dependency: if the service is down the select is
     simply empty and the matter can still be filed without
     an assigned advocate. */
  useEffect(() => {
    let cancelled = false;

    getLawyers()
      .then((response) => {
        if (!cancelled) setLawyers(response.lawyers);
      })
      .catch(() => {
        /* Directory unavailable — file without a picker. */
      })
      .finally(() => {
        if (!cancelled) setLawyersLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const chosenLawyer = lawyers.find((item) => item.lawyer_id === lawyerId);

  const respondentList = respondents
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  function validate(): string | null {
    if (!petitioner.trim()) return "The petitioner's name is required.";
    if (respondentList.length === 0)
      return "At least one respondent is required.";
    if (!courtState.trim()) return "The state of the court is required.";
    if (!courtDistrict.trim())
      return "The district of the court is required.";
    if (!courtName.trim()) return "The court's name is required.";
    if (!act.trim()) return "The act applied is required.";
    if (!filingDate) return "The filing date is required.";
    if (hearingDate && hearingDate < filingDate)
      return "The next hearing cannot fall before the filing date.";

    return null;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const created = addCase({
        owner_user_id: userId,
        handling_lawyer_id: lawyerId,
        petitioner_name: petitioner.trim(),
        respondents_list: respondentList,
        petitioner_advocate: chosenLawyer
          ? `Adv. ${chosenLawyer.full_name}`
          : "",
        case_type: caseType,
        court_name: courtName.trim(),
        court_state: courtState.trim(),
        court_district: courtDistrict.trim(),
        presiding_judge: judge.trim(),
        applied_act: act.trim(),
        applied_section: section.trim(),
        filing_date: filingDate,
        next_hearing_date: hearingDate || filingDate,
      });

      /* Initial documents, filed with the case rather than after
         it — each one is stamped with the matter's CNR as soon
         as it exists. */
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);

        addDocument({
          cnr: created.cnr_number,
          owner_user_id: userId,
          category,
          file,
          dataUrl,
        });
      }

      onCreated(created.cnr_number);
    } catch {
      setError(
        "The case could not be filed in this browser. Check that " +
          "storage is not full and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="file-case">
      <button type="button" className="matter-back" onClick={onCancel}>
        ← All cases
      </button>

      <header className="file-case-head">
        <span className="matter-eyebrow">NEW MATTER</span>
        <h2>File a new case</h2>
        <p>
          Record the matter once, here. The documents you attach go straight
          onto the case file, and the advocate you choose gets it on their
          caseload.
        </p>
      </header>

      <form className="file-case-form" onSubmit={handleSubmit}>
        {/* ---------------------------------------------
            PARTIES
            --------------------------------------------- */}
        <fieldset>
          <legend>Parties</legend>

          <div className="file-grid file-grid-2">
            <label>
              <span>Petitioner</span>
              <input
                type="text"
                value={petitioner}
                onChange={(event) => setPetitioner(event.target.value)}
                placeholder="Who is filing"
              />
            </label>

            <label>
              <span>Case type</span>
              <select
                value={caseType}
                onChange={(event) => setCaseType(event.target.value)}
              >
                {CASE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="file-field">
            <span>Respondents</span>
            <textarea
              value={respondents}
              onChange={(event) => setRespondents(event.target.value)}
              rows={3}
              placeholder="One per line, or separated by commas"
            />

            <em>
              {respondentList.length === 0
                ? "At least one respondent is required."
                : `${respondentList.length} ${
                    respondentList.length === 1
                      ? "respondent"
                      : "respondents"
                  }`}
            </em>
          </label>
        </fieldset>

        {/* ---------------------------------------------
            COURT
            --------------------------------------------- */}
        <fieldset>
          <legend>Court</legend>

          <div className="file-grid file-grid-2">
            <label>
              <span>State</span>
              <input
                type="text"
                value={courtState}
                onChange={(event) => setCourtState(event.target.value)}
                placeholder="e.g. Maharashtra"
              />
            </label>

            <label>
              <span>District</span>
              <input
                type="text"
                value={courtDistrict}
                onChange={(event) => setCourtDistrict(event.target.value)}
                placeholder="e.g. Mumbai"
              />
            </label>

            <label>
              <span>Court name</span>
              <input
                type="text"
                value={courtName}
                onChange={(event) => setCourtName(event.target.value)}
                placeholder="e.g. Sessions Court, Mumbai"
              />
            </label>

            <label>
              <span>Presiding judge (if known)</span>
              <input
                type="text"
                value={judge}
                onChange={(event) => setJudge(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
        </fieldset>

        {/* ---------------------------------------------
            STATUTE AND DATES
            --------------------------------------------- */}
        <fieldset>
          <legend>Statute and dates</legend>

          <div className="file-grid file-grid-2">
            <label>
              <span>Act applied</span>
              <input
                type="text"
                list="sample-acts"
                value={act}
                onChange={(event) => setAct(event.target.value)}
                placeholder="e.g. Indian Penal Code, 1860"
              />

              <datalist id="sample-acts">
                {SAMPLE_ACTS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Section (optional)</span>
              <input
                type="text"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                placeholder="e.g. 420"
              />
            </label>

            <label>
              <span>Filing date</span>
              <input
                type="date"
                value={filingDate}
                max={today()}
                onChange={(event) => setFilingDate(event.target.value)}
              />
            </label>

            <label>
              <span>Next hearing date (if listed)</span>
              <input
                type="date"
                value={hearingDate}
                min={filingDate}
                onChange={(event) => setHearingDate(event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        {/* ---------------------------------------------
            ADVOCATE
            --------------------------------------------- */}
        <fieldset>
          <legend>Assigned advocate</legend>

          <label className="file-field">
            <span>Handle this matter</span>

            <select
              value={lawyerId}
              onChange={(event) => setLawyerId(event.target.value)}
              disabled={!lawyersLoaded}
            >
              <option value="">
                {lawyersLoaded
                  ? "Not assigned yet — I will represent myself"
                  : "Loading the lawyer directory…"}
              </option>

              {lawyers.map((lawyer) => (
                <option key={lawyer.lawyer_id} value={lawyer.lawyer_id}>
                  Adv. {lawyer.full_name}
                  {lawyer.city ? ` — ${lawyer.city}` : ""}
                </option>
              ))}
            </select>

            <em>
              {chosenLawyer
                ? `Adv. ${chosenLawyer.full_name} will be able to see this matter and message you about it.`
                : "You can assign an advocate later from this case's page."}
            </em>
          </label>
        </fieldset>

        {/* ---------------------------------------------
            INITIAL DOCUMENTS
            --------------------------------------------- */}
        <fieldset>
          <legend>Initial documents</legend>

          <div className="file-grid file-grid-2">
            <label>
              <span>Category for these files</span>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as DocumentCategory)
                }
              >
                {DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="file-picker">
              <span>Attach files</span>

              <input
                type="file"
                multiple
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
            </label>
          </div>

          {files.length > 0 && (
            <ul className="file-attached">
              {files.map((file) => (
                <li key={`${file.name}_${file.size}`}>
                  {file.name}
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item !== file),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {/* ---------------------------------------------
            SUBMIT
            --------------------------------------------- */}
        {error && (
          <p className="file-error" role="alert">
            {error}
          </p>
        )}

        <div className="file-actions">
          <button type="button" className="file-cancel" onClick={onCancel}>
            Cancel
          </button>

          <button type="submit" className="file-submit" disabled={saving}>
            {saving ? "Filing…" : "File this case"}
          </button>
        </div>
      </form>
    </section>
  );
}
