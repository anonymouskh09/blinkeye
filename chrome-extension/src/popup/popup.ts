import { el, clear, on } from "./dom";
import { environment } from "../config/environment";
import { getActiveSession, exchangeCode, connectWithDevToken, logout } from "../services/auth";
import { getPageContext, requestExtraction, type PageContext } from "../services/tabs";
import { loadDropdowns } from "../services/dropdowns";
import {
  checkDuplicate,
  importCandidate,
  parseResumeFile,
  attachFileToCandidate,
  updateMissingFields,
} from "../services/candidates";
import { validateProfile, toImportPayload } from "../utils/validators";
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
  SectionAvailability,
} from "../types";

const root = document.getElementById("root") as HTMLElement;
const headerUser = document.getElementById("header-user") as HTMLElement;
const envBadge = document.getElementById("env-badge") as HTMLElement;

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
};

function setState(state: PopupState): void {
  ctx.state = state;
  render();
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

function statusLabel(s: SectionAvailability | undefined): string {
  if (s === "detected") return "Detected";
  if (s === "partial") return "Partial";
  return "Not available";
}

function pillClass(s: SectionAvailability | undefined): string {
  if (s === "detected") return "pill ok";
  if (s === "partial") return "pill partial";
  return "pill";
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

  const avatar = el("img", { class: "avatar", src: "", alt: "" }) as HTMLImageElement;
  const rawPhoto = profile.profileImageUrl?.trim() || "";
  if (rawPhoto.startsWith("data:")) {
    avatar.src = rawPhoto;
  } else if (rawPhoto) {
    void chrome.runtime
      .sendMessage({ type: "FETCH_IMAGE_DATA_URL", url: rawPhoto })
      .then((res: { ok?: boolean; dataUrl?: string } | undefined) => {
        if (res?.ok && res.dataUrl) avatar.src = res.dataUrl;
        else avatar.src = rawPhoto;
      })
      .catch(() => {
        avatar.src = rawPhoto;
      });
  }

  container.append(
    el("div", { class: "preview-head" }, [
      avatar,
      el("div", { class: "who" }, [
        el("strong", { text: profile.fullName || "Unknown candidate" }),
        el("span", { text: profile.headline || "" }),
      ]),
    ]),
  );

  const statuses = profile.sectionStatuses;
  if (statuses) {
    const row = el("div", { class: "section-status" });
    for (const [key, label] of [
      ["experience", "Experience"],
      ["education", "Education"],
      ["skills", "Skills"],
      ["certifications", "Certifications"],
      ["languages", "Languages"],
    ] as const) {
      row.append(
        el("span", {
          class: pillClass(statuses[key]),
          text: `${label}: ${statusLabel(statuses[key])}`,
        }),
      );
    }
    container.append(row);
  }

  const expCount = profile.experiences?.length ?? 0;
  const eduCount = profile.educations?.length ?? 0;
  const skillCount = profile.skills?.length ?? 0;
  const certCount = profile.certifications?.length ?? 0;
  const langCount = profile.languages?.length ?? 0;
  const bits = [
    expCount ? `${expCount} experience` : null,
    eduCount ? `${eduCount} education` : null,
    skillCount ? `${skillCount} skills` : null,
    certCount ? `${certCount} certifications` : null,
    langCount ? `${langCount} languages` : null,
    profile.summary ? "summary" : null,
  ].filter(Boolean);
  container.append(
    el("div", { class: bits.length ? "notice notice-info" : "notice notice-warn" }, [
      bits.length
        ? `Also detected: ${bits.join(" · ")}`
        : "Only basic fields found. Scroll the LinkedIn profile to load sections, then reopen the extension.",
    ]),
  );

  container.append(viewUploadSection());
  const conflictsUi = viewConflicts();
  if (conflictsUi) container.append(conflictsUi);

  const errors: Record<string, HTMLElement> = {};
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
    const errEl = el("div", { class: "field-error" });
    errors[key] = errEl;
    return el("label", { class: "field" }, [
      el("span", {}, [labelText, opts.required ? el("span", { class: "req", text: " *" }) : null]),
      control,
      errEl,
    ]);
  };

  container.append(field("fullName", "Full name", { required: true }));
  container.append(field("headline", "Headline"));
  container.append(field("location", "Location"));
  container.append(field("email", "Email"));
  container.append(field("phone", "Phone"));
  container.append(field("linkedinUrl", "LinkedIn URL"));
  container.append(field("summary", "Summary", { textarea: true }));

  if (dropdowns) {
    container.append(
      selectField(
        "Assign to job",
        dropdowns.jobs.map((j) => ({
          value: String(j.id),
          label: j.clientName ? `${j.title} — ${j.clientName}` : j.title,
        })),
        ctx.selection.jobId ? String(ctx.selection.jobId) : "",
        (v) => (ctx.selection.jobId = v ? Number(v) : null),
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
  }

  const formError = el("div", { class: "field-error" });
  container.append(formError);

  const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save candidate"]);
  const saveOpenBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Save & open"]);

  const doSave = async (openAfter: boolean) => {
    formError.textContent = "";
    Object.values(errors).forEach((e) => (e.textContent = ""));
    applyConflictsToProfile();
    const result = validateProfile(profile);
    if (!result.valid) {
      for (const [key, msg] of Object.entries(result.errors)) {
        if (errors[key]) errors[key].textContent = msg as string;
      }
      return;
    }
    saveBtn.setAttribute("disabled", "");
    saveOpenBtn.setAttribute("disabled", "");
    await saveCandidate(openAfter);
    saveBtn.removeAttribute("disabled");
    saveOpenBtn.removeAttribute("disabled");
  };

  on(saveBtn, "click", () => doSave(false));
  on(saveOpenBtn, "click", () => doSave(true));
  container.append(el("div", { class: "btn-row" }, [saveBtn, saveOpenBtn]));

  const logoutBtn = el("button", { class: "btn btn-danger", type: "button", style: "margin-top:8px" }, [
    "Disconnect",
  ]);
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
    el("h2", { class: "title", text: "Candidate saved" }),
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
  const container = el("div", {}, [
    el("div", { class: "notice notice-error", text: ctx.errorMessage || "Something went wrong." }),
  ]);
  const retry = el("button", { class: "btn btn-primary", type: "button" }, ["Try again"]);
  on(retry, "click", startExtraction);
  container.append(retry);
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
  envBadge.textContent = environment.isProduction ? "" : "dev";
  renderHeaderUser(ctx.session?.user ?? null);

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
      root.append(viewLoading("Reading LinkedIn profile…"));
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
  ctx.duplicate = null;
  ctx.successUrl = null;
  ctx.uploadFile = null;
  ctx.uploadStatus = "idle";
  ctx.uploadError = "";
  ctx.conflicts = [];
  ctx.mergeMeta = null;
  ctx.linkedinProfile = null;
  if (!ctx.page?.tabId || !ctx.page.supported) {
    setState("unsupported");
    return;
  }
  setState("extracting");
  try {
    const extraction = await requestExtraction(ctx.page.tabId);
    ctx.profile = {
      ...extraction.profile,
      certifications: extraction.profile.certifications || [],
      languages: extraction.profile.languages || [],
    };
    ctx.linkedinProfile = { ...ctx.profile };
    setState("preview");
  } catch (e) {
    ctx.errorMessage = e instanceof Error ? e.message : "Could not read this profile.";
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
  render();
  ctx.page = await getPageContext();
  ctx.session = await getActiveSession();

  if (!ctx.session) {
    setState("not-connected");
    return;
  }
  await bootstrapConnected();
}

void init();
