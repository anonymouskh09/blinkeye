/**
 * RecruitPro Chrome Side Panel UI (native chrome.sidePanel — right dock).
 * Reuses auth, tabs, candidates, validators — not an action popup.
 */
import { el, clear, on } from "../popup/dom";
import { environment } from "../config/environment";
import { getActiveSession, exchangeCode, connectWithDevToken, logout } from "../services/auth";
import {
  getPageContext,
  requestExtraction,
  requestQuickExtraction,
  type PageContext,
} from "../services/tabs";
import { loadDropdowns } from "../services/dropdowns";
import {
  checkDuplicate,
  importCandidate,
  parseResumeFile,
  attachFileToCandidate,
  updateMissingFields,
} from "../services/candidates";
import { validateProfile, toImportPayload } from "../utils/validators";
import { cloneProfile, debugLog, normalizeCandidateProfile } from "../utils/normalizeProfile";
import { validateUploadFile, formatFileSize, guessFileKind } from "../utils/fileValidation";
import { mergeLinkedInAndCv, applyConflictChoices } from "../utils/mergeProfile";
import { toUserMessage, ApiError } from "../utils/errors";
import type {
  AuthSession,
  CandidateProfile,
  DropdownData,
  DuplicateInfo,
  FieldConflict,
  ImportedVia,
  PopupState,
} from "../types";

const root = document.getElementById("root") as HTMLElement;
const footer = document.getElementById("sp-footer") as HTMLElement;
const statusEl = document.getElementById("sp-status") as HTMLElement;
const btnOpenAts = document.getElementById("btn-open-ats") as HTMLButtonElement;

type UploadStatus = "idle" | "uploading" | "parsing" | "parsed" | "failed";

interface AppContext {
  state: PopupState;
  session: AuthSession | null;
  page: PageContext | null;
  profile: CandidateProfile | null;
  linkedinProfile: CandidateProfile | null;
  dropdowns: DropdownData | null;
  duplicate: DuplicateInfo | null;
  earlyDuplicate: DuplicateInfo | null;
  errorMessage: string;
  successUrl: string | null;
  selection: { jobId: number | null; ownerId: number | null; stage: string | null; tags: string[] };
  uploadFile: File | null;
  uploadStatus: UploadStatus;
  uploadError: string;
  conflicts: FieldConflict[];
  mergeMeta: {
    linkedinTitle: string;
    linkedinCompany: string;
    cvTitle: string;
    cvCompany: string;
  } | null;
  enriching: boolean;
  extractGeneration: number;
  showAllExp: boolean;
  showAllEdu: boolean;
  dropdownsError: string;
}

const ctx: AppContext = {
  state: "loading",
  session: null,
  page: null,
  profile: null,
  linkedinProfile: null,
  dropdowns: null,
  duplicate: null,
  earlyDuplicate: null,
  errorMessage: "",
  successUrl: null,
  selection: { jobId: null, ownerId: null, stage: null, tags: [] },
  uploadFile: null,
  uploadStatus: "idle",
  uploadError: "",
  conflicts: [],
  mergeMeta: null,
  enriching: false,
  extractGeneration: 0,
  showAllExp: false,
  showAllEdu: false,
  dropdownsError: "",
};

function setState(state: PopupState): void {
  ctx.state = state;
  render();
}

function setStatus(kind: "idle" | "loading" | "ok" | "warn" | "new", text: string): void {
  clear(statusEl);
  const dotClass =
    kind === "ok" || kind === "new"
      ? "sp-dot ok"
      : kind === "warn"
        ? "sp-dot warn"
        : kind === "loading"
          ? "sp-dot loading"
          : "sp-dot";
  statusEl.append(el("span", { class: dotClass }), document.createTextNode(text));
}

function preferRicherProfile(quick: CandidateProfile, full: CandidateProfile): CandidateProfile {
  const pickArr = <T>(a: T[] | undefined, b: T[] | undefined): T[] => {
    const left = a ?? [];
    const right = b ?? [];
    return right.length >= left.length ? right : left;
  };
  return normalizeCandidateProfile({
    ...quick,
    ...full,
    fullName: full.fullName || quick.fullName,
    headline: full.headline || quick.headline,
    location: full.location || quick.location,
    email: full.email || quick.email,
    phone: full.phone || quick.phone,
    summary: full.summary || quick.summary,
    profileImageUrl: full.profileImageUrl || quick.profileImageUrl,
    linkedinUrl: full.linkedinUrl || quick.linkedinUrl,
    experiences: pickArr(quick.experiences, full.experiences),
    educations: pickArr(quick.educations, full.educations),
    skills: pickArr(quick.skills, full.skills),
    certifications: pickArr(quick.certifications, full.certifications),
    languages: pickArr(quick.languages, full.languages),
    sectionStatuses: full.sectionStatuses || quick.sectionStatuses,
  });
}

function loadAvatar(img: HTMLImageElement, url: string): void {
  const raw = url.trim();
  if (!raw) return;
  if (raw.startsWith("data:")) {
    img.src = raw;
    return;
  }
  void chrome.runtime
    .sendMessage({ type: "FETCH_IMAGE_DATA_URL", url: raw })
    .then((res: { ok?: boolean; dataUrl?: string } | undefined) => {
      img.src = res?.ok && res.dataUrl ? res.dataUrl : raw;
    })
    .catch(() => {
      img.src = raw;
    });
}

async function runEarlyDuplicateCheck(profile: CandidateProfile): Promise<void> {
  if (!profile.linkedinUrl) return;
  try {
    const dup = await checkDuplicate(profile.linkedinUrl, profile.email);
    if (dup.duplicate && dup.existing) {
      ctx.earlyDuplicate = dup.existing;
      ctx.duplicate = dup.existing;
      if (ctx.state === "preview") render();
    } else {
      ctx.earlyDuplicate = null;
      if (ctx.state === "preview") render();
    }
  } catch {
    /* non-blocking */
  }
}

function importedViaForFile(file: File | null): ImportedVia {
  if (!file) return "chrome_extension";
  return guessFileKind(file) === "linkedin_pdf" ? "linkedin_profile_pdf" : "chrome_extension_cv";
}

function clearFooter(): void {
  footer.hidden = true;
  clear(footer);
}

function selectField(
  labelText: string,
  options: { value: string; label: string }[],
  selected: string,
  onChange: (value: string) => void,
  placeholder = "— None —",
): HTMLElement {
  const select = el("select", { class: "sp-select" }) as HTMLSelectElement;
  select.append(el("option", { value: "" }, [placeholder]));
  for (const opt of options) {
    const optionEl = el("option", { value: opt.value }, [opt.label]) as HTMLOptionElement;
    if (opt.value === selected) optionEl.selected = true;
    select.append(optionEl);
  }
  on(select, "change", () => onChange(select.value));
  return el("label", { class: "sp-field" }, [el("span", { text: labelText }), select]);
}

// ---- views ---------------------------------------------------------------

function viewLoading(message = "Loading…"): HTMLElement {
  return el("div", { class: "state-center" }, [
    el("div", { class: "spinner" }),
    el("p", { text: message }),
  ]);
}

function viewUnsupported(): HTMLElement {
  setStatus("idle", "Open a LinkedIn profile");
  return el("div", { class: "state-center" }, [
    el("h2", { text: "Open a LinkedIn profile" }),
    el("p", { text: "Navigate to linkedin.com/in/… — this side panel stays open beside the page." }),
  ]);
}

function viewNotConnected(): HTMLElement {
  setStatus("idle", "Connect to RecruitPro");
  const container = el("div", {}, [
    el("h2", { class: "title", text: "Connect to RecruitPro", style: "font-size:15px;margin:0 0 6px" }),
    el("p", {
      style: "color:var(--muted);font-size:12px;margin:0 0 12px",
      text: "Open RecruitPro settings, generate a connection code, then paste it below.",
    }),
  ]);

  const openBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Open RecruitPro Settings"]);
  on(openBtn, "click", () => chrome.tabs.create({ url: environment.connectUrl }));
  container.append(openBtn);

  const codeInput = el("input", {
    class: "sp-input",
    type: "text",
    placeholder: "Paste connection code",
    style: "margin-top:12px",
    autocomplete: "off",
  }) as HTMLInputElement;
  container.append(
    el("label", { class: "sp-field", style: "margin-top:12px" }, [
      el("span", { text: "Connection code" }),
      codeInput,
    ]),
  );

  const err = el("div", { class: "field-error" });
  container.append(err);

  const connectBtn = el("button", { class: "btn btn-primary", type: "button", style: "margin-top:8px" }, [
    "Connect",
  ]);
  on(connectBtn, "click", async () => {
    err.textContent = "";
    connectBtn.setAttribute("disabled", "");
    try {
      ctx.session = await exchangeCode(codeInput.value);
      await bootstrapConnected();
    } catch (e) {
      err.textContent = toUserMessage(e);
      connectBtn.removeAttribute("disabled");
    }
  });
  container.append(connectBtn);

  if (environment.allowDevToken) {
    const devInput = el("input", {
      class: "sp-input",
      type: "password",
      placeholder: "Dev: paste JWT access token",
      style: "margin-top:16px",
      autocomplete: "off",
    }) as HTMLInputElement;
    const devBtn = el("button", { class: "btn btn-ghost", type: "button" }, ["Connect with dev token"]);
    on(devBtn, "click", async () => {
      err.textContent = "";
      try {
        ctx.session = await connectWithDevToken(devInput.value);
        await bootstrapConnected();
      } catch (e) {
        err.textContent = toUserMessage(e);
      }
    });
    container.append(
      el("div", { class: "notice notice-info", style: "margin-top:16px" }, ["Developer mode enabled."]),
      devInput,
      devBtn,
    );
  }

  return container;
}

function viewSkeletonIdentity(): HTMLElement {
  return el("div", { class: "sp-identity" }, [
    el("div", { class: "sk sk-avatar" }),
    el("div", { style: "flex:1" }, [
      el("div", { class: "sk sk-line sk-title" }),
      el("div", { class: "sk sk-line sk-sub" }),
      el("div", { class: "sk sk-line", style: "width:40%" }),
    ]),
  ]);
}

function viewSectionSkeleton(title: string): HTMLElement {
  return el("div", { class: "sp-section" }, [
    el("div", { class: "sp-section-head" }, [el("div", { class: "sp-section-title", text: title })]),
    el("div", { class: "sk sk-line", style: "width:85%" }),
    el("div", { class: "sk sk-line", style: "width:70%" }),
  ]);
}

async function handleSelectedFile(file: File): Promise<void> {
  const check = validateUploadFile(file);
  if (!check.ok) {
    ctx.uploadError = check.error || "Invalid file.";
    ctx.uploadFile = null;
    ctx.uploadStatus = "failed";
    render();
    return;
  }
  ctx.uploadFile = file;
  ctx.uploadError = "";
  ctx.uploadStatus = "parsing";
  render();
  try {
    const parsed = await parseResumeFile(file);
    const base = ctx.linkedinProfile || ctx.profile;
    if (!base) throw new Error("No LinkedIn profile to merge.");
    const merged = mergeLinkedInAndCv(base, parsed);
    ctx.profile = merged.profile;
    ctx.conflicts = merged.conflicts;
    ctx.mergeMeta = {
      linkedinTitle: merged.linkedinTitle,
      linkedinCompany: merged.linkedinCompany,
      cvTitle: merged.cvTitle,
      cvCompany: merged.cvCompany,
    };
    ctx.uploadStatus = "parsed";
  } catch (e) {
    if (ctx.linkedinProfile) ctx.profile = { ...ctx.linkedinProfile };
    ctx.conflicts = [];
    ctx.mergeMeta = null;
    ctx.uploadStatus = "failed";
    ctx.uploadError = toUserMessage(e) || "Parse failed.";
  }
  render();
}

function clearUpload(): void {
  ctx.uploadFile = null;
  ctx.uploadStatus = "idle";
  ctx.uploadError = "";
  ctx.conflicts = [];
  ctx.mergeMeta = null;
  if (ctx.linkedinProfile) ctx.profile = { ...ctx.linkedinProfile };
  render();
}

function applyConflictsToProfile(): void {
  if (!ctx.profile || !ctx.mergeMeta || !ctx.conflicts.length) return;
  ctx.profile = applyConflictChoices(ctx.profile, ctx.conflicts, ctx.mergeMeta);
}

function viewUploadSection(): HTMLElement {
  const box = el("div", { class: "upload-box" });
  box.append(el("h3", { text: "CV / LinkedIn PDF (optional)" }));
  box.append(
    el("p", {
      class: "upload-hint",
      text: "Upload a CV or LinkedIn Save-as-PDF to enrich missing fields.",
    }),
  );
  const fileInput = el("input", {
    type: "file",
    accept: ".pdf,.doc,.docx,application/pdf",
    style: "display:none",
  }) as HTMLInputElement;
  on(fileInput, "change", () => {
    const f = fileInput.files?.[0];
    if (f) void handleSelectedFile(f);
  });
  if (!ctx.uploadFile) {
    const choose = el("button", { class: "btn btn-secondary", type: "button" }, ["Choose file"]);
    on(choose, "click", () => fileInput.click());
    box.append(choose, fileInput);
  } else {
    box.append(
      el("div", {}, [
        el("strong", { text: ctx.uploadFile.name }),
        el("span", { style: "display:block;color:var(--muted);font-size:11px", text: formatFileSize(ctx.uploadFile.size) }),
      ]),
    );
    if (ctx.uploadStatus === "parsing") {
      box.append(el("div", { class: "notice notice-info", text: "Parsing…" }));
    } else if (ctx.uploadStatus === "failed") {
      box.append(el("div", { class: "notice notice-error", text: ctx.uploadError || "Parse failed." }));
    }
    const remove = el("button", { class: "btn btn-ghost", type: "button" }, ["Remove"]);
    on(remove, "click", clearUpload);
    box.append(remove, fileInput);
  }
  return box;
}

function viewConflicts(): HTMLElement | null {
  if (!ctx.conflicts.length) return null;
  const wrap = el("div", {});
  wrap.append(el("div", { class: "sp-section-title", text: "Resolve conflicts", style: "margin-bottom:8px" }));
  for (const conflict of ctx.conflicts) {
    const block = el("div", { class: "notice notice-info" });
    block.append(el("strong", { text: conflict.field }));
    const name = `conflict-${conflict.field}`;
    const makeRadio = (choice: FieldConflict["choice"], label: string, value: string) => {
      const input = el("input", { type: "radio", name, value: choice }) as HTMLInputElement;
      if (conflict.choice === choice) input.checked = true;
      on(input, "change", () => {
        conflict.choice = choice;
      });
      return el("label", { style: "display:block;margin:4px 0" }, [input, ` ${label}: ${value || "(empty)"}`]);
    };
    block.append(makeRadio("linkedin", "LinkedIn", conflict.linkedinValue));
    block.append(makeRadio("cv", "CV/PDF", conflict.cvValue));
    wrap.append(block);
  }
  return wrap;
}

function viewPreview(): HTMLElement {
  const profile = ctx.profile!;
  const container = el("div", {});

  // Status in header
  if (ctx.earlyDuplicate) {
    setStatus("warn", "Already in ATS");
  } else if (ctx.enriching) {
    setStatus("loading", "Loading profile sections…");
  } else {
    setStatus("new", "New candidate");
  }

  // Identity
  const avatar = el("img", { class: "sp-avatar", src: "", alt: "" }) as HTMLImageElement;
  loadAvatar(avatar, profile.profileImageUrl || "");
  const who = el("div", { class: "sp-who" }, [
    el("h1", { text: profile.fullName || "Unknown candidate" }),
    el("div", { class: "headline", text: profile.headline || "" }),
  ]);
  const metaBits: string[] = [];
  if (profile.location) metaBits.push(profile.location);
  who.append(
    el("div", { class: "meta" }, [
      metaBits.length ? document.createTextNode(metaBits.join(" · ") + " · ") : null,
      profile.linkedinUrl
        ? (() => {
            const a = el("a", { href: profile.linkedinUrl, target: "_blank", rel: "noreferrer" }, [
              "LinkedIn",
            ]);
            return a;
          })()
        : null,
    ]),
  );
  container.append(el("div", { class: "sp-identity" }, [avatar, who]));

  if (ctx.earlyDuplicate) {
    container.append(
      el("div", { class: "notice notice-warn" }, [
        `Already in RecruitPro: ${ctx.earlyDuplicate.name}`,
      ]),
    );
  } else {
    container.append(el("div", { class: "notice notice-ok" }, ["New candidate — ready to import"]));
  }

  // Experience
  const experiences = profile.experiences || [];
  if (ctx.enriching && !experiences.length) {
    container.append(viewSectionSkeleton("Experience"));
  } else {
    const sec = el("div", { class: "sp-section" });
    const head = el("div", { class: "sp-section-head" }, [
      el("div", { class: "sp-section-title", text: experiences.length ? `Experience (${experiences.length})` : "Experience" }),
    ]);
    sec.append(head);
    if (!experiences.length) {
      sec.append(el("div", { class: "sp-empty", text: "No experience found" }));
    } else {
      const limit = ctx.showAllExp ? experiences.length : Math.min(3, experiences.length);
      for (const exp of experiences.slice(0, limit)) {
        const dates = [exp.start_date, exp.is_current ? "Present" : exp.end_date].filter(Boolean).join(" – ");
        sec.append(
          el("div", { class: "sp-exp-card" }, [
            el("strong", { text: exp.title }),
            el("div", { class: "company", text: exp.company }),
            dates ? el("div", { class: "dates", text: dates }) : null,
            exp.location ? el("div", { class: "loc", text: exp.location }) : null,
          ]),
        );
      }
      if (experiences.length > 3) {
        const toggle = el("button", {
          class: "sp-section-action",
          type: "button",
          text: ctx.showAllExp ? "Show less" : `Show all ${experiences.length}`,
        });
        on(toggle, "click", () => {
          ctx.showAllExp = !ctx.showAllExp;
          render();
        });
        head.append(toggle);
      }
    }
    container.append(sec);
  }

  // Education
  const educations = profile.educations || [];
  if (ctx.enriching && !educations.length) {
    container.append(viewSectionSkeleton("Education"));
  } else {
    const sec = el("div", { class: "sp-section" });
    const head = el("div", { class: "sp-section-head" }, [
      el("div", {
        class: "sp-section-title",
        text: educations.length ? `Education (${educations.length})` : "Education",
      }),
    ]);
    sec.append(head);
    if (!educations.length) {
      sec.append(el("div", { class: "sp-empty", text: "No education found" }));
    } else {
      const limit = ctx.showAllEdu ? educations.length : Math.min(2, educations.length);
      for (const edu of educations.slice(0, limit)) {
        sec.append(
          el("div", { class: "sp-edu-card" }, [
            el("strong", { text: edu.school }),
            edu.degree || edu.field_of_study
              ? el("div", {
                  class: "degree",
                  text: [edu.degree, edu.field_of_study].filter(Boolean).join(" · "),
                })
              : null,
          ]),
        );
      }
      if (educations.length > 2) {
        const toggle = el("button", {
          class: "sp-section-action",
          type: "button",
          text: ctx.showAllEdu ? "Show less" : `Show all ${educations.length}`,
        });
        on(toggle, "click", () => {
          ctx.showAllEdu = !ctx.showAllEdu;
          render();
        });
        head.append(toggle);
      }
    }
    container.append(sec);
  }

  // Skills chips
  const skills = profile.skills || [];
  if (ctx.enriching && !skills.length) {
    container.append(viewSectionSkeleton("Skills"));
  } else {
    const sec = el("div", { class: "sp-section" });
    sec.append(el("div", { class: "sp-section-head" }, [el("div", { class: "sp-section-title", text: "Skills" })]));
    if (!skills.length) {
      sec.append(el("div", { class: "sp-empty", text: "No skills found" }));
    } else {
      const chips = el("div", { class: "sp-chips" });
      for (const skill of skills.slice(0, 40)) {
        const remove = el("button", { type: "button", text: "×", title: "Remove" });
        on(remove, "click", () => {
          profile.skills = (profile.skills || []).filter((s) => s !== skill);
          render();
        });
        chips.append(el("span", { class: "sp-chip" }, [skill, remove]));
      }
      sec.append(chips);
    }
    const addWrap = el("div", { class: "sp-chip-add" });
    const addInput = el("input", {
      class: "sp-input",
      type: "text",
      placeholder: "Add skill",
    }) as HTMLInputElement;
    const addBtn = el("button", { class: "btn btn-secondary", type: "button", style: "width:auto;padding:8px 10px" }, [
      "Add",
    ]);
    const addSkill = () => {
      const v = addInput.value.trim();
      if (!v) return;
      if (!(profile.skills || []).includes(v)) {
        profile.skills = [...(profile.skills || []), v];
      }
      addInput.value = "";
      render();
    };
    on(addBtn, "click", addSkill);
    on(addInput, "keydown", (ev) => {
      if ((ev as KeyboardEvent).key === "Enter") {
        ev.preventDefault();
        addSkill();
      }
    });
    addWrap.append(addInput, addBtn);
    sec.append(addWrap);
    container.append(sec);
  }

  // Contact (optional edits) — Job/Stage live in sticky footer
  const contact = el("div", { class: "sp-section" });
  contact.append(el("div", { class: "sp-section-head" }, [el("div", { class: "sp-section-title", text: "Contact" })]));
  for (const [key, label] of [
    ["fullName", "Full name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["location", "Location"],
  ] as const) {
    const input = el("input", {
      class: "sp-input",
      type: "text",
      value: String(profile[key] ?? ""),
    }) as HTMLInputElement;
    on(input, "input", () => {
      profile[key] = input.value;
    });
    contact.append(el("label", { class: "sp-field" }, [el("span", { text: label }), input]));
  }
  container.append(contact);

  container.append(viewUploadSection());
  const conflictsUi = viewConflicts();
  if (conflictsUi) container.append(conflictsUi);

  const logoutBtn = el("button", { class: "btn btn-danger", type: "button" }, ["Disconnect"]);
  on(logoutBtn, "click", handleLogout);
  container.append(logoutBtn);

  if (!environment.isProduction) {
    container.append(el("div", { class: "env-badge", text: "dev", style: "margin-top:8px" }));
  }

  // Sticky footer: Job + Stage + CTA (always visible)
  clear(footer);
  footer.hidden = false;
  const formError = el("div", { class: "field-error" });

  const assignBox = el("div", { class: "sp-footer-assign" });
  const dropdowns = ctx.dropdowns;
  if (dropdowns) {
    if (!dropdowns.jobs.length) {
      assignBox.append(
        el("div", {
          class: "notice notice-warn",
          text: "No open jobs found. Create a job in RecruitPro first.",
        }),
      );
    } else {
      assignBox.append(
        selectField(
          "Job",
          dropdowns.jobs.map((j) => ({
            value: String(j.id),
            label: j.clientName ? `${j.title} — ${j.clientName}` : j.title,
          })),
          ctx.selection.jobId ? String(ctx.selection.jobId) : "",
          (v) => {
            ctx.selection.jobId = v ? Number(v) : null;
          },
          "Select job",
        ),
      );
    }
    assignBox.append(
      selectField(
        "Stage",
        dropdowns.stages.map((s) => ({ value: s.id, label: s.name })),
        ctx.selection.stage ?? "",
        (v) => {
          ctx.selection.stage = v || null;
        },
        "Select stage",
      ),
    );
  } else if (ctx.dropdownsError) {
    assignBox.append(el("div", { class: "notice notice-error", text: ctx.dropdownsError }));
    const retry = el("button", { class: "btn btn-secondary", type: "button" }, ["Retry load jobs"]);
    on(retry, "click", () => {
      void loadDropdowns(true)
        .then((data) => {
          ctx.dropdowns = data;
          ctx.dropdownsError = "";
          render();
        })
        .catch((e) => {
          ctx.dropdownsError = toUserMessage(e);
          render();
        });
    });
    assignBox.append(retry);
  } else {
    assignBox.append(el("div", { class: "notice notice-info", text: "Loading jobs…" }));
  }
  footer.append(assignBox);

  if (ctx.earlyDuplicate?.id) {
    const openBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Open candidate"]);
    on(openBtn, "click", () =>
      chrome.tabs.create({ url: `${environment.appBaseUrl}/candidates/${ctx.earlyDuplicate!.id}` }),
    );
    const updateBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Update existing"]);
    on(updateBtn, "click", () => void updateExistingCandidate(formError, updateBtn));
    footer.append(openBtn, updateBtn, formError);
  } else {
    const saveOpen = el("button", { class: "btn btn-secondary", type: "button" }, ["Save & open ATS"]);
    const addBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Add to RecruitPro"]);
    const doSave = async (openAfter: boolean, btn: HTMLButtonElement) => {
      formError.textContent = "";
      applyConflictsToProfile();
      const result = validateProfile(profile);
      if (!result.valid) {
        formError.textContent = Object.values(result.errors)[0] || "Fix required fields.";
        return;
      }
      btn.setAttribute("disabled", "");
      await saveCandidate(openAfter);
      btn.removeAttribute("disabled");
    };
    on(saveOpen, "click", () => doSave(true, saveOpen));
    on(addBtn, "click", () => doSave(false, addBtn));
    footer.append(saveOpen, addBtn, formError);
  }

  return container;
}

async function updateExistingCandidate(formError: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  if (!ctx.earlyDuplicate?.id || !ctx.profile) return;
  formError.textContent = "";
  btn.setAttribute("disabled", "");
  applyConflictsToProfile();
  try {
    const p = ctx.profile;
    await updateMissingFields(ctx.earlyDuplicate.id, {
      headline: p.headline || undefined,
      location: p.location || undefined,
      email: p.email || undefined,
      phone: p.phone || undefined,
      summary: p.summary || undefined,
      experiences: p.experiences,
      educations: p.educations,
      skills: p.skills,
      certifications: p.certifications,
      languages: p.languages,
      job_id: ctx.selection.jobId,
      stage: ctx.selection.stage,
    });
    if (ctx.uploadFile) {
      try {
        await attachFileToCandidate(ctx.earlyDuplicate.id, ctx.uploadFile, {
          applyParsed: false,
          fileKind: guessFileKind(ctx.uploadFile),
        });
      } catch {
        /* ignore attach failure after update */
      }
    }
    ctx.successUrl = `${environment.appBaseUrl}/candidates/${ctx.earlyDuplicate.id}`;
    setState("success");
  } catch (e) {
    if (e instanceof ApiError && e.kind === "unauthorized") {
      setState("session-expired");
      return;
    }
    formError.textContent = toUserMessage(e);
  } finally {
    btn.removeAttribute("disabled");
  }
}

function viewDuplicate(): HTMLElement {
  clearFooter();
  setStatus("warn", "Already in ATS");
  const dup = ctx.duplicate;
  const container = el("div", {}, [
    el("h2", { style: "font-size:15px;margin:0 0 6px", text: "Candidate already exists" }),
    el("p", {
      style: "color:var(--muted);font-size:12px;margin:0 0 12px",
      text: "This LinkedIn profile matches a candidate in RecruitPro.",
    }),
  ]);
  if (dup) {
    container.append(
      el("div", { class: "dup-row" }, [
        el("strong", { text: dup.name }),
        el("span", { text: dup.email || dup.linkedinUrl || "" }),
      ]),
    );
    if (dup.id) {
      const openBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Open candidate"]);
      on(openBtn, "click", () =>
        chrome.tabs.create({ url: `${environment.appBaseUrl}/candidates/${dup.id}` }),
      );
      container.append(openBtn);
    }
  }
  const back = el("button", { class: "btn btn-secondary", type: "button", style: "margin-top:8px" }, [
    "Back",
  ]);
  on(back, "click", () => setState("preview"));
  container.append(back);
  return container;
}

function viewSuccess(): HTMLElement {
  clearFooter();
  setStatus("ok", "Saved");
  const container = el("div", { class: "state-center" }, [
    el("h2", { text: "Saved to RecruitPro" }),
    el("p", { text: "Candidate is in your ATS." }),
  ]);
  if (ctx.successUrl) {
    const openBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Open candidate"]);
    on(openBtn, "click", () => chrome.tabs.create({ url: ctx.successUrl! }));
    container.append(openBtn);
  }
  const again = el("button", { class: "btn btn-secondary", type: "button", style: "margin-top:8px" }, [
    "Import another",
  ]);
  on(again, "click", () => void startExtraction());
  container.append(again);
  return container;
}

function viewError(): HTMLElement {
  clearFooter();
  setStatus("warn", "Something went wrong");
  const container = el("div", {}, [
    el("div", { class: "notice notice-error", text: ctx.errorMessage || "Something went wrong." }),
  ]);
  const retry = el("button", { class: "btn btn-primary", type: "button" }, ["Try again"]);
  on(retry, "click", () => void startExtraction());
  container.append(retry);
  return container;
}

function viewSessionExpired(): HTMLElement {
  clearFooter();
  setStatus("warn", "Session expired");
  const container = el("div", {}, [
    el("div", { class: "notice notice-warn", text: "Your session expired. Please reconnect." }),
  ]);
  const btn = el("button", { class: "btn btn-primary", type: "button" }, ["Reconnect"]);
  on(btn, "click", () => setState("not-connected"));
  container.append(btn);
  return container;
}

function render(): void {
  clear(root);
  if (ctx.state !== "preview") clearFooter();

  switch (ctx.state) {
    case "loading":
      root.append(viewLoading());
      break;
    case "unsupported":
      root.append(viewUnsupported());
      break;
    case "not-connected":
      root.append(viewNotConnected());
      break;
    case "extracting":
      setStatus("loading", "Reading profile…");
      root.append(viewSkeletonIdentity());
      root.append(viewSectionSkeleton("Experience"));
      root.append(viewSectionSkeleton("Education"));
      root.append(viewSectionSkeleton("Skills"));
      break;
    case "preview":
      root.append(viewPreview());
      break;
    case "duplicate":
      root.append(viewDuplicate());
      break;
    case "saving":
      clearFooter();
      root.append(viewLoading("Saving…"));
      break;
    case "success":
      root.append(viewSuccess());
      break;
    case "session-expired":
      root.append(viewSessionExpired());
      break;
    case "error":
    default:
      root.append(viewError());
      break;
  }
}

async function saveCandidate(openAfter: boolean): Promise<void> {
  setState("saving");
  applyConflictsToProfile();
  const payload = toImportPayload(ctx.profile!, {
    ...ctx.selection,
    importedVia: importedViaForFile(ctx.uploadFile),
  });
  try {
    if (payload.linkedinUrl) {
      const dup = await checkDuplicate(payload.linkedinUrl, payload.email);
      if (dup.duplicate && dup.existing) {
        ctx.duplicate = dup.existing;
        ctx.earlyDuplicate = dup.existing;
        setState("duplicate");
        return;
      }
    }
    const result = await importCandidate(payload);
    if (ctx.uploadFile) {
      try {
        await attachFileToCandidate(result.id, ctx.uploadFile, {
          applyParsed: false,
          fileKind: guessFileKind(ctx.uploadFile),
        });
      } catch {
        /* candidate created */
      }
    }
    ctx.successUrl = `${environment.appBaseUrl}${result.detailUrl}`;
    if (openAfter) chrome.tabs.create({ url: ctx.successUrl });
    setState("success");
  } catch (e) {
    if (e instanceof ApiError && e.kind === "duplicate") {
      const existing = (e.data as { existing?: DuplicateInfo } | null)?.existing ?? null;
      ctx.duplicate = existing;
      ctx.earlyDuplicate = existing;
      setState("duplicate");
      return;
    }
    if (e instanceof ApiError && e.kind === "unauthorized") {
      setState("session-expired");
      return;
    }
    ctx.errorMessage = toUserMessage(e);
    setState("error");
  }
}

async function startExtraction(): Promise<void> {
  const generation = ++ctx.extractGeneration;
  ctx.duplicate = null;
  ctx.earlyDuplicate = null;
  ctx.successUrl = null;
  ctx.uploadFile = null;
  ctx.uploadStatus = "idle";
  ctx.uploadError = "";
  ctx.conflicts = [];
  ctx.mergeMeta = null;
  ctx.linkedinProfile = null;
  ctx.enriching = false;
  ctx.showAllExp = false;
  ctx.showAllEdu = false;
  ctx.page = await getPageContext();
  if (!ctx.page?.tabId || !ctx.page.supported) {
    setState("unsupported");
    return;
  }

  // Immediate skeleton — do not block on full scrape
  setState("extracting");

  try {
    const quick = await requestQuickExtraction(ctx.page.tabId);
    if (generation !== ctx.extractGeneration) return;
    const normalized = normalizeCandidateProfile(quick.profile);
    debugLog("sidepanel quick", {
      fullName: normalized.fullName,
      experiences: normalized.experiences.length,
      url: normalized.linkedinUrl,
    });
    ctx.profile = normalized;
    ctx.linkedinProfile = cloneProfile(normalized);
    ctx.enriching = true;
    setState("preview");
    void runEarlyDuplicateCheck(normalized);

    void (async () => {
      try {
        const full = await requestExtraction(ctx.page!.tabId!);
        if (generation !== ctx.extractGeneration) return;
        const richer = preferRicherProfile(
          ctx.linkedinProfile || normalized,
          normalizeCandidateProfile(full.profile),
        );
        debugLog("sidepanel full", {
          experiences: richer.experiences.length,
          educations: richer.educations.length,
          skills: richer.skills.length,
        });
        ctx.linkedinProfile = cloneProfile(richer);
        ctx.profile = richer;
      } catch (e) {
        debugLog("full extract failed (keeping quick)", e);
      } finally {
        if (generation === ctx.extractGeneration) {
          ctx.enriching = false;
          if (ctx.state === "preview") render();
        }
      }
    })();
  } catch (e) {
    if (generation !== ctx.extractGeneration) return;
    ctx.enriching = false;
    ctx.errorMessage = e instanceof Error ? e.message : "Unable to extract candidate information.";
    setState("error");
  }
}

async function bootstrapConnected(): Promise<void> {
  loadDropdowns(true)
    .then((data) => {
      ctx.dropdowns = data;
      ctx.dropdownsError = "";
      if (ctx.state === "preview") render();
    })
    .catch((e) => {
      ctx.dropdownsError = toUserMessage(e) || "Could not load jobs.";
      if (ctx.state === "preview") render();
    });

  if (ctx.page?.supported) {
    await startExtraction();
  } else {
    setState("unsupported");
  }
}

async function handleLogout(): Promise<void> {
  await logout();
  ctx.session = null;
  ctx.dropdowns = null;
  ctx.profile = null;
  ctx.linkedinProfile = null;
  setState("not-connected");
}

async function init(): Promise<void> {
  on(btnOpenAts, "click", () => chrome.tabs.create({ url: environment.appBaseUrl }));

  render();
  ctx.page = await getPageContext();
  ctx.session = await getActiveSession();

  if (!ctx.session) {
    setState("not-connected");
  } else {
    await bootstrapConnected();
  }

  const refreshFromActiveTab = async () => {
    if (!ctx.session) return;
    const next = await getPageContext();
    const prevUrl = ctx.page?.url ?? "";
    ctx.page = next;
    if (!next.supported) {
      if (ctx.state !== "unsupported" && ctx.state !== "not-connected") setState("unsupported");
      return;
    }
    if (next.url && next.url !== prevUrl) {
      await startExtraction();
    }
  };

  chrome.tabs.onActivated.addListener(() => {
    void refreshFromActiveTab();
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url?.includes("linkedin.com/in/") || (changeInfo.status === "complete" && tab.active && tab.url?.includes("linkedin.com/in/"))) {
      void refreshFromActiveTab();
    }
  });
}

void init();
