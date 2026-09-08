import { el, clear, on } from "./dom";
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
  ExtensionUser,
  FieldConflict,
  ImportedVia,
  PopupState,
} from "../types";

const root = document.getElementById("root") as HTMLElement;
const headerUser = document.getElementById("header-user") as HTMLElement;
const sqToolbar = document.getElementById("sq-toolbar") as HTMLElement;
const sqNav = document.getElementById("sq-nav") as HTMLElement;
const toolbarJob = document.getElementById("toolbar-job") as HTMLSelectElement;
const btnOpenAts = document.getElementById("btn-open-ats") as HTMLButtonElement;

type PanelTab = "candidate" | "assign" | "more";
type UploadStatus = "idle" | "uploading" | "parsing" | "parsed" | "failed";

interface AppContext {
  state: PopupState;
  session: AuthSession | null;
  page: PageContext | null;
  profile: CandidateProfile | null;
  /** LinkedIn-only snapshot before CV merge (kept if parse fails). */
  linkedinProfile: CandidateProfile | null;
  dropdowns: DropdownData | null;
  duplicate: DuplicateInfo | null;
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
  busyAction: string;
  /** Full scroll/section extract still running after quick preview. */
  enriching: boolean;
  /** Early duplicate hit (banner + sticky CTA) without leaving preview. */
  earlyDuplicate: DuplicateInfo | null;
  extractGeneration: number;
  panelTab: PanelTab;
}

const ctx: AppContext = {
  state: "loading",
  session: null,
  page: null,
  profile: null,
  linkedinProfile: null,
  dropdowns: null,
  duplicate: null,
  errorMessage: "",
  successUrl: null,
  selection: { jobId: null, ownerId: null, stage: null, tags: [] },
  uploadFile: null,
  uploadStatus: "idle",
  uploadError: "",
  conflicts: [],
  mergeMeta: null,
  busyAction: "",
  enriching: false,
  earlyDuplicate: null,
  extractGeneration: 0,
  panelTab: "candidate",
};

function setState(state: PopupState): void {
  ctx.state = state;
  render();
}

function syncShellChrome(): void {
  const showShell = ctx.state === "preview" && !!ctx.profile;
  sqNav.hidden = !showShell;
  sqToolbar.hidden = !showShell;

  if (showShell) {
    for (const btn of sqNav.querySelectorAll<HTMLButtonElement>(".sq-nav-item")) {
      btn.classList.toggle("active", btn.dataset.tab === ctx.panelTab);
    }
    syncToolbarJobSelect();
  }
}

function syncToolbarJobSelect(): void {
  clear(toolbarJob);
  toolbarJob.append(el("option", { value: "" }, ["— Select job —"]));
  for (const j of ctx.dropdowns?.jobs ?? []) {
    const label = j.clientName ? `${j.title} — ${j.clientName}` : j.title;
    const opt = el("option", { value: String(j.id) }, [label]) as HTMLOptionElement;
    if (ctx.selection.jobId === j.id) opt.selected = true;
    toolbarJob.append(opt);
  }
}

function infoRow(icon: string, label: string, value: string | null | undefined): HTMLElement {
  const empty = !value?.trim();
  return el("div", { class: "sq-row" }, [
    el("div", { class: "sq-row-icon", text: icon }),
    el("div", { class: "sq-row-body" }, [
      el("div", { class: "sq-row-label", text: label }),
      el("div", {
        class: empty ? "sq-row-value empty" : "sq-row-value",
        text: empty ? `No ${label.toLowerCase()} found` : value!.trim(),
      }),
    ]),
  ]);
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

async function runEarlyDuplicateCheck(profile: CandidateProfile): Promise<void> {
  if (!profile.linkedinUrl) return;
  try {
    const dup = await checkDuplicate(profile.linkedinUrl, profile.email);
    if (dup.duplicate && dup.existing) {
      ctx.earlyDuplicate = dup.existing;
      ctx.duplicate = dup.existing;
      if (ctx.state === "preview") render();
    }
  } catch {
    /* non-blocking */
  }
}

function renderHeaderUser(user: ExtensionUser | null): void {
  if (!user) {
    headerUser.hidden = true;
    headerUser.replaceChildren();
    return;
  }
  headerUser.hidden = false;
  headerUser.replaceChildren(
    el("span", {}, [el("strong", { text: user.name || user.email }), user.role]),
  );
}

function importedViaForFile(file: File | null): ImportedVia {
  if (!file) return "chrome_extension";
  return guessFileKind(file) === "linkedin_pdf" ? "linkedin_profile_pdf" : "chrome_extension_cv";
}

// ---- individual state views ------------------------------------------------

function viewLoading(message = "Loading…"): HTMLElement {
  return el("div", { class: "state-center" }, [el("div", { class: "spinner" }), el("p", { text: message })]);
}

function viewUnsupported(): HTMLElement {
  return el("div", { class: "state-center" }, [
    el("div", { class: "icon", text: "🔍" }),
    el("h2", { class: "title", text: "Open a LinkedIn profile" }),
    el("p", {
      class: "subtitle",
      text: "Navigate to a LinkedIn profile page (linkedin.com/in/…) to import a candidate.",
    }),
  ]);
}

function viewNotConnected(): HTMLElement {
  const container = el("div", {}, [
    el("h2", { class: "title", text: "Connect to RecruitPro" }),
    el("p", {
      class: "subtitle",
      text: "Open RecruitPro settings, generate a connection code, then paste it below.",
    }),
  ]);

  const openBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Open RecruitPro Settings"]);
  on(openBtn, "click", () => chrome.tabs.create({ url: environment.connectUrl }));
  container.append(openBtn);

  const codeInput = el("input", {
    class: "input",
    type: "text",
    placeholder: "Paste connection code",
    style: "margin-top:12px",
    autocomplete: "off",
  }) as HTMLInputElement;
  container.append(
    el("label", { class: "field", style: "margin-top:12px" }, [
      el("span", { text: "Connection code" }),
      codeInput,
    ]),
  );

  const err = el("div", { class: "field-error" });
  container.append(err);

  const connectBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Connect"]);
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
      class: "input",
      type: "password",
      placeholder: "Dev: paste JWT access token",
      style: "margin-top:16px",
      autocomplete: "off",
    }) as HTMLInputElement;
    const devBtn = el("button", { class: "btn btn-ghost", type: "button", style: "margin-top:6px" }, [
      "Connect with dev token",
    ]);
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
    );
    container.append(devInput, devBtn);
  }

  return container;
}

function selectField(
  labelText: string,
  options: { value: string; label: string }[],
  selected: string,
  onChange: (value: string) => void,
  placeholder = "— None —",
): HTMLElement {
  const select = el("select", { class: "select" }) as HTMLSelectElement;
  select.append(el("option", { value: "" }, [placeholder]));
  for (const opt of options) {
    const optionEl = el("option", { value: opt.value }, [opt.label]) as HTMLOptionElement;
    if (opt.value === selected) optionEl.selected = true;
    select.append(optionEl);
  }
  on(select, "change", () => onChange(select.value));
  return el("label", { class: "field" }, [el("span", { text: labelText }), select]);
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
    // Keep LinkedIn data; allow retry.
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

function viewExtractedSections(profile: CandidateProfile): HTMLElement {
  const wrap = el("div", {});

  const experiences = profile.experiences || [];
  const educations = profile.educations || [];
  const skills = profile.skills || [];
  const certifications = profile.certifications || [];
  const languages = profile.languages || [];

  const addBlock = (title: string, body: HTMLElement | string) => {
    wrap.append(
      el("div", { class: "sq-section" }, [
        el("div", { class: "sq-section-title", text: title }),
        typeof body === "string" ? el("div", { class: "sq-empty", text: body }) : body,
      ]),
    );
  };

  if (experiences.length) {
    const list = el("ul", { class: "sq-list" });
    for (const exp of experiences.slice(0, 8)) {
      const dates = [exp.start_date, exp.is_current ? "Present" : exp.end_date].filter(Boolean).join(" – ");
      list.append(
        el("li", {}, [
          el("strong", { text: exp.title }),
          el("span", { text: ` · ${exp.company}` }),
          dates ? el("div", { class: "sq-meta", text: dates }) : null,
        ]),
      );
    }
    if (experiences.length > 8) {
      list.append(el("li", { class: "sq-meta", text: `+${experiences.length - 8} more` }));
    }
    addBlock(`Experience (${experiences.length})`, list);
  } else if (!ctx.enriching) {
    addBlock("Experience", "None found on this page");
  }

  if (educations.length) {
    const list = el("ul", { class: "sq-list" });
    for (const edu of educations.slice(0, 6)) {
      list.append(
        el("li", {}, [
          el("strong", { text: edu.school }),
          edu.degree ? el("span", { text: ` · ${edu.degree}` }) : null,
        ]),
      );
    }
    addBlock(`Education (${educations.length})`, list);
  } else if (!ctx.enriching) {
    addBlock("Education", "None found on this page");
  }

  if (skills.length) {
    addBlock(
      `Skills (${skills.length})`,
      el("div", { class: "sq-skills", text: skills.slice(0, 24).join(" · ") }),
    );
  } else if (!ctx.enriching) {
    addBlock("Skills", "None found on this page");
  }

  if (certifications.length) {
    const list = el("ul", { class: "sq-list" });
    for (const cert of certifications.slice(0, 5)) {
      list.append(
        el("li", {}, [
          el("strong", { text: cert.name }),
          cert.issuing_organization ? el("span", { text: ` · ${cert.issuing_organization}` }) : null,
        ]),
      );
    }
    addBlock(`Certifications (${certifications.length})`, list);
  }

  if (languages.length) {
    addBlock(
      `Languages (${languages.length})`,
      el(
        "div",
        {
          class: "sq-skills",
          text: languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(" · "),
        },
      ),
    );
  }

  return wrap;
}

function viewUploadSection(): HTMLElement {
  const box = el("div", { class: "upload-box" });
  box.append(el("h3", { text: "Add CV or LinkedIn Profile PDF" }));
  box.append(
    el("p", {
      class: "upload-hint",
      text: "For more complete candidate information, open LinkedIn → More → Save to PDF, then upload the downloaded PDF here.",
    }),
  );

  const fileInput = el("input", {
    type: "file",
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    style: "display:none",
  }) as HTMLInputElement;

  on(fileInput, "change", () => {
    const f = fileInput.files?.[0];
    if (f) void handleSelectedFile(f);
  });

  on(box, "dragover", (ev) => {
    ev.preventDefault();
    box.classList.add("drag");
  });
  on(box, "dragleave", () => box.classList.remove("drag"));
  on(box, "drop", (ev) => {
    ev.preventDefault();
    box.classList.remove("drag");
    const dt = (ev as DragEvent).dataTransfer;
    const f = dt?.files?.[0];
    if (f) void handleSelectedFile(f);
  });

  if (!ctx.uploadFile) {
    const choose = el("button", { class: "btn btn-secondary btn-sm", type: "button" }, ["Choose file"]);
    on(choose, "click", () => fileInput.click());
    box.append(choose, fileInput);
  } else {
    box.append(
      el("div", { class: "upload-file" }, [
        el("strong", { text: ctx.uploadFile.name }),
        el("span", { text: formatFileSize(ctx.uploadFile.size) }),
      ]),
    );
    if (ctx.uploadStatus === "parsing" || ctx.uploadStatus === "uploading") {
      box.append(el("div", { class: "notice notice-info", text: "Parsing file…" }));
    } else if (ctx.uploadStatus === "parsed") {
      box.append(el("div", { class: "notice notice-info", text: "Parsed and merged. Review conflicts below if any." }));
    } else if (ctx.uploadStatus === "failed") {
      box.append(el("div", { class: "notice notice-error", text: ctx.uploadError || "Parse failed." }));
      const retry = el("button", { class: "btn btn-secondary btn-sm", type: "button" }, ["Retry parse"]);
      on(retry, "click", () => {
        if (ctx.uploadFile) void handleSelectedFile(ctx.uploadFile);
      });
      box.append(retry);
    }
    const remove = el("button", { class: "btn btn-ghost btn-sm", type: "button" }, ["Remove file"]);
    on(remove, "click", clearUpload);
    const replace = el("button", { class: "btn btn-ghost btn-sm", type: "button" }, ["Replace"]);
    on(replace, "click", () => fileInput.click());
    box.append(el("div", { class: "btn-row" }, [remove, replace]), fileInput);
  }
  return box;
}

function viewConflicts(): HTMLElement | null {
  if (!ctx.conflicts.length) return null;
  const wrap = el("div", {});
  wrap.append(el("h3", { style: "font-size:13px;margin:0 0 8px", text: "Resolve conflicts" }));
  for (const conflict of ctx.conflicts) {
    const block = el("div", { class: "conflict-block" });
    block.append(el("strong", { text: conflict.field }));
    const name = `conflict-${conflict.field}`;
    const makeRadio = (choice: FieldConflict["choice"], label: string, value: string) => {
      const input = el("input", { type: "radio", name, value: choice }) as HTMLInputElement;
      if (conflict.choice === choice) input.checked = true;
      on(input, "change", () => {
        conflict.choice = choice;
      });
      return el("label", {}, [input, ` ${label}: ${value || "(empty)"}`]);
    };
    block.append(makeRadio("linkedin", "Use LinkedIn", conflict.linkedinValue));
    block.append(makeRadio("cv", "Use CV/PDF", conflict.cvValue));
    const manualInput = el("input", {
      class: "input",
      type: "text",
      placeholder: "Enter manually",
      value: conflict.manualValue || "",
    }) as HTMLInputElement;
    const manualRadio = el("input", { type: "radio", name, value: "manual" }) as HTMLInputElement;
    if (conflict.choice === "manual") manualRadio.checked = true;
    on(manualRadio, "change", () => {
      conflict.choice = "manual";
    });
    on(manualInput, "input", () => {
      conflict.manualValue = manualInput.value;
      conflict.choice = "manual";
      manualRadio.checked = true;
    });
    block.append(el("label", {}, [manualRadio, " Enter manually"]));
    block.append(manualInput);
    wrap.append(block);
  }
  return wrap;
}

function viewPreview(): HTMLElement {
  const profile = ctx.profile!;
  const dropdowns = ctx.dropdowns;
  const container = el("div", {});

  if (ctx.panelTab === "assign") {
    return viewAssignTab(container, profile, dropdowns);
  }
  if (ctx.panelTab === "more") {
    return viewMoreTab(container, profile);
  }

  // ---- Candidate tab (SalesQL-style) ----
  const avatar = el("img", { class: "sq-avatar", src: "", alt: "" }) as HTMLImageElement;
  loadAvatar(avatar, profile.profileImageUrl || "");

  const card = el("div", { class: "sq-card" }, [
    el("div", { class: "sq-profile" }, [
      avatar,
      el("div", { class: "sq-who" }, [
        el("strong", { text: profile.fullName || "Unknown candidate" }),
        el("span", { text: profile.headline || "No headline found" }),
      ]),
    ]),
  ]);

  const formError = el("div", { class: "field-error" });
  const addBtn = el("button", { class: "sq-cta", type: "button" }, [
    ctx.earlyDuplicate ? "Add anyway" : "Add to RecruitPro",
  ]);
  const addOpenBtn = el("button", { class: "sq-cta sq-cta-secondary", type: "button" }, [
    "Add & open in ATS",
  ]);

  const doSave = async (openAfter: boolean) => {
    formError.textContent = "";
    applyConflictsToProfile();
    const result = validateProfile(profile);
    if (!result.valid) {
      formError.textContent = Object.values(result.errors)[0] || "Fix required fields in More tab.";
      ctx.panelTab = "more";
      render();
      return;
    }
    addBtn.setAttribute("disabled", "");
    addOpenBtn.setAttribute("disabled", "");
    await saveCandidate(openAfter);
    addBtn.removeAttribute("disabled");
    addOpenBtn.removeAttribute("disabled");
  };
  on(addBtn, "click", () => doSave(false));
  on(addOpenBtn, "click", () => doSave(true));
  card.append(addBtn, addOpenBtn, formError);
  container.append(card);

  if (ctx.enriching) {
    container.append(
      el("div", { class: "enrich-banner" }, [
        el("span", { class: "spinner-inline" }),
        el("span", { text: "Loading experience, education & skills…" }),
      ]),
    );
  }

  if (ctx.earlyDuplicate) {
    const openExisting = el("button", { class: "link-btn", type: "button" }, ["Open existing"]);
    on(openExisting, "click", () => {
      chrome.tabs.create({
        url: `${environment.appBaseUrl}/candidates/${ctx.earlyDuplicate!.id}`,
      });
    });
    container.append(
      el("div", { class: "notice notice-warn" }, [
        el("span", { text: `Already in RecruitPro: ${ctx.earlyDuplicate.name}. ` }),
        openExisting,
      ]),
    );
  }

  const company =
    profile.experiences?.[0]?.company ||
    (profile.experiences?.length ? `${profile.experiences.length} roles found` : "");
  container.append(
    el("div", { class: "sq-rows" }, [
      infoRow("✉", "Email", profile.email),
      infoRow("☎", "Phone", profile.phone),
      infoRow("🏢", "Company", company),
      infoRow("📍", "Location", profile.location),
    ]),
  );

  container.append(viewExtractedSections(profile));
  return container;
}

function viewAssignTab(
  container: HTMLElement,
  _profile: CandidateProfile,
  dropdowns: DropdownData | null,
): HTMLElement {
  container.append(el("h2", { class: "title", text: "Assign" }));
  container.append(
    el("p", {
      class: "subtitle",
      text: "Optional — attach this candidate to a job and pipeline stage.",
    }),
  );

  if (dropdowns) {
    container.append(
      selectField(
        "Job",
        dropdowns.jobs.map((j) => ({
          value: String(j.id),
          label: j.clientName ? `${j.title} — ${j.clientName}` : j.title,
        })),
        ctx.selection.jobId ? String(ctx.selection.jobId) : "",
        (v) => {
          ctx.selection.jobId = v ? Number(v) : null;
          syncToolbarJobSelect();
        },
      ),
    );
    container.append(
      selectField(
        "Pipeline stage",
        dropdowns.stages.map((s) => ({ value: s.id, label: s.name })),
        ctx.selection.stage ?? "",
        (v) => (ctx.selection.stage = v || null),
      ),
    );
    container.append(
      selectField(
        "Owner",
        dropdowns.team.map((m) => ({ value: String(m.id), label: m.name })),
        ctx.selection.ownerId ? String(ctx.selection.ownerId) : "",
        (v) => (ctx.selection.ownerId = v ? Number(v) : null),
        "— Me (default) —",
      ),
    );
  } else {
    container.append(el("div", { class: "notice notice-info", text: "Loading jobs…" }));
  }

  container.append(viewUploadSection());
  const conflictsUi = viewConflicts();
  if (conflictsUi) container.append(conflictsUi);

  const back = el("button", { class: "sq-cta", type: "button" }, ["Back to candidate"]);
  on(back, "click", () => {
    ctx.panelTab = "candidate";
    render();
  });
  container.append(back);
  return container;
}

function viewMoreTab(container: HTMLElement, profile: CandidateProfile): HTMLElement {
  container.append(el("h2", { class: "title", text: "Edit details" }));
  container.append(
    el("p", { class: "subtitle", text: "Fix name or contact fields before importing." }),
  );

  type ScalarField = "fullName" | "headline" | "location" | "email" | "phone" | "linkedinUrl" | "summary";
  const field = (
    key: ScalarField,
    labelText: string,
    opts: { required?: boolean; textarea?: boolean } = {},
  ) => {
    const value = String(profile[key] ?? "");
    const control = opts.textarea
      ? (el("textarea", { class: "textarea" }, [value]) as HTMLTextAreaElement)
      : (el("input", { class: "input", type: "text", value }) as HTMLInputElement);
    on(control as HTMLElement, "input", () => {
      profile[key] = (control as HTMLInputElement).value;
    });
    return el("label", { class: "field" }, [
      el("span", {}, [labelText, opts.required ? el("span", { class: "req", text: " *" }) : null]),
      control,
    ]);
  };

  container.append(field("fullName", "Full name", { required: true }));
  container.append(field("headline", "Headline"));
  container.append(field("location", "Location"));
  container.append(field("email", "Email"));
  container.append(field("phone", "Phone"));
  container.append(field("linkedinUrl", "LinkedIn URL"));
  container.append(field("summary", "Summary", { textarea: true }));

  if (!environment.isProduction) {
    container.append(el("div", { class: "env-badge", text: "dev" }));
  }

  const logoutBtn = el("button", { class: "btn btn-danger", type: "button" }, ["Disconnect"]);
  on(logoutBtn, "click", handleLogout);
  container.append(logoutBtn);
  return container;
}

function viewDuplicate(): HTMLElement {
  const dup = ctx.duplicate;
  const container = el("div", {}, [
    el("h2", { class: "title", text: "Candidate already exists" }),
    el("p", {
      class: "subtitle",
      text: "This profile matches an existing candidate in RecruitPro.",
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
      const openBtn = el("button", { class: "btn btn-primary", type: "button" }, [
        "Open Existing Candidate",
      ]);
      on(openBtn, "click", () =>
        chrome.tabs.create({ url: `${environment.appBaseUrl}/candidates/${dup.id}` }),
      );
      container.append(openBtn);

      if (ctx.uploadFile) {
        const attachBtn = el("button", {
          class: "btn btn-secondary",
          type: "button",
          style: "margin-top:8px",
        }, [ctx.busyAction === "attach" ? "Attaching…" : "Attach File to Existing Candidate"]);
        on(attachBtn, "click", async () => {
          if (!ctx.uploadFile || !dup.id) return;
          ctx.busyAction = "attach";
          render();
          try {
            await attachFileToCandidate(dup.id, ctx.uploadFile, {
              applyParsed: false,
              fileKind: guessFileKind(ctx.uploadFile),
            });
            ctx.successUrl = `${environment.appBaseUrl}/candidates/${dup.id}`;
            setState("success");
          } catch (e) {
            if (e instanceof ApiError && e.kind === "unauthorized") {
              setState("session-expired");
              return;
            }
            ctx.errorMessage = toUserMessage(e);
            setState("error");
          } finally {
            ctx.busyAction = "";
          }
        });
        container.append(attachBtn);

        const updateBtn = el("button", {
          class: "btn btn-secondary",
          type: "button",
          style: "margin-top:8px",
        }, [
          ctx.busyAction === "update" ? "Updating…" : "Update Missing Fields from CV/PDF",
        ]);
        on(updateBtn, "click", async () => {
          if (!ctx.uploadFile || !dup.id) return;
          ctx.busyAction = "update";
          render();
          try {
            await attachFileToCandidate(dup.id, ctx.uploadFile, {
              applyParsed: true,
              fileKind: guessFileKind(ctx.uploadFile),
            });
            ctx.successUrl = `${environment.appBaseUrl}/candidates/${dup.id}`;
            setState("success");
          } catch (e) {
            if (e instanceof ApiError && e.kind === "unauthorized") {
              setState("session-expired");
              return;
            }
            ctx.errorMessage = toUserMessage(e);
            setState("error");
          } finally {
            ctx.busyAction = "";
          }
        });
        container.append(updateBtn);
      }

      if (ctx.selection.jobId) {
        const assocBtn = el("button", {
          class: "btn btn-secondary",
          type: "button",
          style: "margin-top:8px",
        }, [
          ctx.busyAction === "assoc" ? "Associating…" : "Associate Candidate with Selected Job",
        ]);
        on(assocBtn, "click", async () => {
          if (!dup.id || !ctx.selection.jobId) return;
          ctx.busyAction = "assoc";
          render();
          try {
            await updateMissingFields(dup.id, {
              job_id: ctx.selection.jobId,
              stage: ctx.selection.stage,
            });
            ctx.successUrl = `${environment.appBaseUrl}/candidates/${dup.id}`;
            setState("success");
          } catch (e) {
            if (e instanceof ApiError && e.kind === "unauthorized") {
              setState("session-expired");
              return;
            }
            ctx.errorMessage = toUserMessage(e);
            setState("error");
          } finally {
            ctx.busyAction = "";
          }
        });
        container.append(assocBtn);
      }
    }
  }
  const backBtn = el("button", { class: "btn btn-secondary", type: "button", style: "margin-top:8px" }, [
    "Back",
  ]);
  on(backBtn, "click", () => setState("preview"));
  container.append(backBtn);
  return container;
}

function viewSuccess(): HTMLElement {
  const container = el("div", { class: "state-center" }, [
    el("div", { class: "icon success-check", text: "✓" }),
    el("h2", { class: "title", text: "Candidate successfully added to ATS" }),
    el("p", { class: "subtitle", text: "The candidate was imported into RecruitPro." }),
  ]);
  if (ctx.successUrl) {
    const openBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Open candidate"]);
    on(openBtn, "click", () => chrome.tabs.create({ url: ctx.successUrl! }));
    container.append(openBtn);
  }
  const doneBtn = el("button", { class: "btn btn-secondary", type: "button", style: "margin-top:8px" }, [
    "Import another",
  ]);
  on(doneBtn, "click", startExtraction);
  container.append(doneBtn);
  return container;
}

function viewError(): HTMLElement {
  const container = el("div", { class: "state-center" }, [
    el("div", { class: "notice notice-error", text: ctx.errorMessage || "Something went wrong." }),
  ]);
  const retry = el("button", { class: "btn btn-primary", type: "button" }, ["Try again"]);
  on(retry, "click", startExtraction);
  container.append(retry);
  const tip = el("p", {
    class: "subtitle",
    text: "Open a LinkedIn profile (linkedin.com/in/…), then click Try again.",
  });
  container.append(tip);
  return container;
}

function viewSessionExpired(): HTMLElement {
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
  renderHeaderUser(ctx.session?.user ?? null);
  syncShellChrome();

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
      root.append(viewLoading("Reading profile…"));
      break;
    case "preview":
      root.append(viewPreview());
      break;
    case "duplicate":
      root.append(viewDuplicate());
      break;
    case "saving":
      root.append(viewLoading("Saving candidate…"));
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

// ---- flow orchestration ----------------------------------------------------

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
        // Candidate already created; file attach failure should still show success with note.
      }
    }
    ctx.successUrl = `${environment.appBaseUrl}${result.detailUrl}`;
    if (openAfter) chrome.tabs.create({ url: ctx.successUrl });
    setState("success");
  } catch (e) {
    if (e instanceof ApiError && e.kind === "duplicate") {
      const existing = (e.data as { existing?: DuplicateInfo } | null)?.existing ?? null;
      ctx.duplicate = existing;
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
  ctx.panelTab = "candidate";
  ctx.page = await getPageContext();
  if (!ctx.page?.tabId || !ctx.page.supported) {
    setState("unsupported");
    return;
  }
  setState("extracting");
  try {
    const quick = await requestQuickExtraction(ctx.page.tabId);
    if (generation !== ctx.extractGeneration) return;
    const normalized = normalizeCandidateProfile(quick.profile);
    debugLog("popup quick profile", {
      fullName: normalized.fullName,
      experiences: normalized.experiences.length,
      educations: normalized.educations.length,
      skills: normalized.skills.length,
      url: normalized.linkedinUrl,
    });
    ctx.profile = normalized;
    ctx.linkedinProfile = cloneProfile(normalized);
    ctx.enriching = true;
    setState("preview");
    void runEarlyDuplicateCheck(normalized);

    // Background enrich — does not block Add CTA
    void (async () => {
      try {
        const full = await requestExtraction(ctx.page!.tabId!);
        if (generation !== ctx.extractGeneration) return;
        const richer = preferRicherProfile(ctx.linkedinProfile || normalized, normalizeCandidateProfile(full.profile));
        debugLog("popup full profile", {
          fullName: richer.fullName,
          experiences: richer.experiences.length,
          educations: richer.educations.length,
          skills: richer.skills.length,
        });
        ctx.linkedinProfile = cloneProfile(richer);
        if (ctx.uploadStatus === "parsed" && ctx.uploadFile) {
          // Keep CV merge; refresh LinkedIn base only
          ctx.profile = richer;
        } else {
          ctx.profile = richer;
        }
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
  renderHeaderUser(ctx.session?.user ?? null);
  loadDropdowns()
    .then((data) => {
      ctx.dropdowns = data;
      if (ctx.state === "preview") render();
    })
    .catch(() => {
      /* preview still works without dropdowns */
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
  on(btnOpenAts, "click", () => {
    chrome.tabs.create({ url: environment.appBaseUrl });
  });

  on(toolbarJob, "change", () => {
    ctx.selection.jobId = toolbarJob.value ? Number(toolbarJob.value) : null;
  });

  for (const btn of sqNav.querySelectorAll<HTMLButtonElement>(".sq-nav-item")) {
    on(btn, "click", () => {
      const tab = btn.dataset.tab as PanelTab | undefined;
      if (!tab) return;
      ctx.panelTab = tab;
      render();
    });
  }

  render();
  ctx.page = await getPageContext();
  ctx.session = await getActiveSession();

  if (!ctx.session) {
    setState("not-connected");
  } else {
    await bootstrapConnected();
  }

  // Side panel: re-extract when the active LinkedIn tab changes
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
    if (changeInfo.status === "complete" && tab.active && tab.url?.includes("linkedin.com/in/")) {
      void refreshFromActiveTab();
    }
  });
}

void init();
