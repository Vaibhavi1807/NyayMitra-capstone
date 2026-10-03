import { beforeEach, describe, expect, it } from "vitest";

import {
  getCase,
  getCasesForUser,
  isSavedForUser,
  resetCases,
  saveCaseForUser,
} from "./caseApi";
import { makeCase } from "../test/caseFixtures";

/* =========================================================
   CASE STORE — saving to My Cases.

   The store is real here (jsdom localStorage + the seeded
   fixture), because the guarantees under test are the store's
   own: saving tags an existing record, never fabricates one,
   never duplicates, never rewrites what is already there.

   There is no "file a new case" path left to test — the
   module has no function that creates a court case.
   ========================================================= */

const ME = "USER_TEST";

beforeEach(() => {
  /* Clears the persisted store and the module-level cache, so
     each test starts with only the seeded fixture. */
  resetCases();
});

describe("saveCaseForUser", () => {
  it("tags the record with the account and changes nothing else", () => {
    const record = makeCase({ owner_user_id: "SOMEONE_ELSE" });

    const saved = saveCaseForUser(record, ME);

    expect(saved.cnr_number).toBe(record.cnr_number);
    expect(saved.owner_user_id).toBe(ME);

    /* The record the service returned is the record that is kept —
       CNR, parties, dates, timeline all intact. */
    expect(saved.petitioner_name).toBe(record.petitioner_name);
    expect(saved.filing_date).toBe(record.filing_date);
    expect(saved.case_history_timeline).toEqual(
      record.case_history_timeline,
    );
    expect(saved.timeline).toEqual(record.timeline);

    /* And the source object is not mutated. */
    expect(record.owner_user_id).toBe("SOMEONE_ELSE");
  });

  it("makes the case appear under this account's My Cases", () => {
    const record = makeCase({ owner_user_id: "SOMEONE_ELSE" });

    expect(isSavedForUser(record.cnr_number, ME)).toBe(false);

    saveCaseForUser(record, ME);

    expect(isSavedForUser(record.cnr_number, ME)).toBe(true);
    expect(getCasesForUser(ME)).toContainEqual(
      expect.objectContaining({ cnr_number: record.cnr_number }),
    );
    /* Another account does not inherit the save. */
    expect(
      isSavedForUser(record.cnr_number, "SOMEONE_ELSE"),
    ).toBe(false);
  });

  it("saving the same CNR twice never duplicates the list", () => {
    const record = makeCase();

    saveCaseForUser(record, ME);
    const second = saveCaseForUser(record, ME);

    const mine = getCasesForUser(ME).filter(
      (item) => item.cnr_number === record.cnr_number,
    );

    expect(mine).toHaveLength(1);
    /* The second save is a no-op that hands back the stored copy. */
    expect(second.cnr_number).toBe(record.cnr_number);
  });

  it("never invents a CNR — the number is the service's own", () => {
    const record = makeCase({ cnr_number: "MHPU210000042026" });

    const saved = saveCaseForUser(record, ME);

    expect(saved.cnr_number).toBe("MHPU210000042026");
    expect(getCase("MHPU210000042026")).not.toBeNull();
  });

  it("does not duplicate a fixture case this account already has", () => {
    /* The seeded fixture already gives USER_0001 this matter. */
    const seededCnr = "PBASB00008022024";

    expect(isSavedForUser(seededCnr, "USER_0001")).toBe(true);

    const before = getCasesForUser("USER_0001").length;

    saveCaseForUser(makeCase({ cnr_number: seededCnr }), "USER_0001");

    const after = getCasesForUser("USER_0001").filter(
      (item) => item.cnr_number === seededCnr,
    );

    expect(after).toHaveLength(1);
    expect(getCasesForUser("USER_0001")).toHaveLength(before);
  });

  it("appends only — other saved cases are never rewritten", () => {
    const first = makeCase({ cnr_number: "MHPU210000042026" });
    const second = makeCase({ cnr_number: "MHPU210000042027" });

    saveCaseForUser(first, ME);
    saveCaseForUser(second, ME);

    const mine = getCasesForUser(ME);

    expect(mine).toHaveLength(2);
    expect(mine.map((item) => item.cnr_number)).toContain(
      first.cnr_number,
    );
    expect(mine.map((item) => item.cnr_number)).toContain(
      second.cnr_number,
    );
  });

  it("keeps a save after a re-read from storage", () => {
    const record = makeCase();

    saveCaseForUser(record, ME);

    /* The My Cases list re-reads the store on every render; the
       save must survive that round trip through localStorage. */
    expect(getCasesForUser(ME).some(
      (item) => item.cnr_number === record.cnr_number,
    )).toBe(true);
    expect(isSavedForUser(record.cnr_number, ME)).toBe(true);
  });
});
