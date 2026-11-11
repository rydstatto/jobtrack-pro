const STATUS_CLASSES = {
  Aplicado: "status-applied",
  Entrevista: "status-interview",
  Oferta: "status-offer",
  "En espera": "status-waiting",
  Rechazado: "status-rejected",
};

const state = {
  mode: "landing",
  authMode: "login",
  user: null,
  applications: [],
  reminders: [],
  noteCache: new Map(),
  editingId: null,
  showAllReminders: false,
};

const elements = Object.fromEntries(
  [
    "year", "landing", "workspace", "login-button", "logout-button", "user-email", "demo-button",
    "create-account-button", "exit-demo-button", "demo-badge", "demo-notice",
    "workspace-kicker", "workspace-subtitle", "new-application-button", "new-reminder-button",
    "all-reminders-button", "application-list", "application-count", "search-input",
    "status-filter", "empty-state", "reminder-list", "workspace-error", "auth-dialog",
    "auth-title", "auth-description", "auth-form", "auth-email", "auth-password",
    "auth-message", "auth-submit", "login-tab", "register-tab", "application-dialog",
    "application-form", "application-title", "application-id", "company-input",
    "position-input", "application-status", "applied-on-input", "location-input",
    "work-type-input", "salary-input", "url-input", "application-message",
    "application-submit", "detail-dialog", "detail-content", "reminder-dialog",
    "reminder-form", "reminder-title-input", "reminder-date-input",
    "reminder-application-input", "reminder-message",
  ].map(id => [id, document.getElementById(id)]),
);

elements["year"].textContent = String(new Date().getFullYear());

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function dateOnly(date = new Date(), offsetDays = 0) {
  const result = new Date(date);
  result.setDate(result.getDate() + offsetDays);
  return [
    result.getFullYear(),
    String(result.getMonth() + 1).padStart(2, "0"),
    String(result.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat("es", options).format(date);
}

function formatReminderDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toLocaleUpperCase("es"))
    .join("");
}

function statusClass(status) {
  return STATUS_CLASSES[status] || "status-applied";
}

function showError(message) {
  elements["workspace-error"].textContent = message;
  elements["workspace-error"].hidden = false;
}

function clearError() {
  elements["workspace-error"].textContent = "";
  elements["workspace-error"].hidden = true;
}

function showFormMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
  element.hidden = !message;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data.detail || "No se pudo completar la solicitud.");
  return data;
}

function setMode(mode) {
  state.mode = mode;
  const inWorkspace = mode === "demo" || mode === "private";
  elements.landing.hidden = inWorkspace;
  elements.workspace.hidden = !inWorkspace;
  elements["login-button"].hidden = mode === "private";
  elements["logout-button"].hidden = mode !== "private";
  elements["user-email"].hidden = mode !== "private";
  elements["user-email"].textContent = state.user?.email || "";
  elements["demo-badge"].hidden = mode !== "demo";
  elements["demo-notice"].hidden = mode !== "demo";
  elements["workspace-kicker"].textContent = mode === "demo" ? "MODO DEMO" : "ESPACIO PRIVADO";
  elements["workspace-subtitle"].textContent =
    mode === "demo"
      ? "Explora las funciones con información inventada."
      : "Un vistazo claro a cada oportunidad.";
  if (inWorkspace) {
    clearError();
    renderWorkspace();
  }
}

function makeDemoData() {
  const today = new Date();
  state.applications = [
    { id: "demo-novatech", company: "NovaTech", position: "Product Designer", status: "Entrevista", location: "Remoto", work_type: "Remoto", salary: "$1.800 - $2.200", url: "https://example.com/jobs/product-designer", applied_on: dateOnly(today, -8), created_at: today.toISOString() },
    { id: "demo-atlas", company: "Atlas Studio", position: "Diseñador UX/UI", status: "Aplicado", location: "Bogotá", work_type: "Híbrido", salary: "$1.500", url: "", applied_on: dateOnly(today, -5), created_at: today.toISOString() },
    { id: "demo-lumen", company: "Lumen Labs", position: "Frontend Developer", status: "En espera", location: "Remoto", work_type: "Remoto", salary: "$2.000", url: "", applied_on: dateOnly(today, -12), created_at: today.toISOString() },
    { id: "demo-north", company: "North Creative", position: "Visual Designer", status: "Oferta", location: "Medellín", work_type: "Híbrido", salary: "$1.700", url: "", applied_on: dateOnly(today, -18), created_at: today.toISOString() },
    { id: "demo-orbit", company: "Orbit Systems", position: "UI Designer", status: "Rechazado", location: "Remoto", work_type: "Remoto", salary: "", url: "", applied_on: dateOnly(today, -24), created_at: today.toISOString() },
  ];
  state.reminders = [
    { id: "demo-reminder-1", title: "Preparar entrevista con NovaTech", due_at: new Date(today.getTime() + 1000 * 60 * 60 * 24).toISOString(), completed: 0, application_id: "demo-novatech", company: "NovaTech", position: "Product Designer" },
    { id: "demo-reminder-2", title: "Enviar seguimiento a Atlas Studio", due_at: new Date(today.getTime() + 1000 * 60 * 60 * 48).toISOString(), completed: 0, application_id: "demo-atlas", company: "Atlas Studio", position: "Diseñador UX/UI" },
  ];
  state.noteCache = new Map([
    ["demo-novatech", [{ id: "demo-note-1", content: "Primera entrevista con el equipo de diseño. Preparar ejemplos del portafolio.", created_at: today.toISOString() }]],
    ["demo-atlas", [{ id: "demo-note-2", content: "Postulación enviada desde el sitio de la empresa.", created_at: today.toISOString() }]],
  ]);
}

async function loadPrivateData() {
  clearError();
  try {
    const [applications, reminders] = await Promise.all([
      apiRequest("/api/applications"),
      apiRequest("/api/reminders"),
    ]);
    state.applications = applications.applications || [];
    state.reminders = reminders.reminders || [];
    state.noteCache.clear();
    renderWorkspace();
  } catch (error) {
    showError(error.message);
  }
}

function renderWorkspace() {
  renderMetrics();
  renderApplications();
  renderReminders();
}

function renderMetrics() {
  const apps = state.applications;
  document.getElementById("metric-total").textContent = String(apps.length);
  document.getElementById("metric-applied").textContent = String(apps.filter(app => app.status === "Aplicado").length);
  document.getElementById("metric-interviews").textContent = String(apps.filter(app => app.status === "Entrevista").length);
  document.getElementById("metric-offers").textContent = String(apps.filter(app => app.status === "Oferta").length);
}

function visibleApplications() {
  const query = elements["search-input"].value.trim().toLocaleLowerCase("es");
  const status = elements["status-filter"].value;
  return state.applications.filter(application => {
    const searchable = `${application.company} ${application.position} ${application.location || ""}`.toLocaleLowerCase("es");
    return (!query || searchable.includes(query)) && (!status || application.status === status);
  });
}

function renderApplications() {
  const applications = visibleApplications();
  elements["application-count"].textContent = String(applications.length);
  elements["application-list"].innerHTML = applications.map(application => `
    <tr data-application-id="${escapeHtml(application.id)}" tabindex="0">
      <td>
        <div class="application-company">
          <span class="company-icon ${hashColor(application.company)}">${escapeHtml(initials(application.company))}</span>
          <span class="application-company-copy"><strong>${escapeHtml(application.company)}</strong><small>${escapeHtml(application.position)}</small></span>
        </div>
      </td>
      <td><span class="status-pill ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
      <td>${escapeHtml(formatDate(application.applied_on, { day: "numeric", month: "short" }))}</td>
      <td><span class="row-menu"><button type="button" data-open-detail="${escapeHtml(application.id)}" aria-label="Ver ${escapeHtml(application.company)}">···</button></span></td>
    </tr>
  `).join("");
  elements["empty-state"].hidden = applications.length > 0;
  elements["application-list"].closest("table").hidden = applications.length === 0;
}

function hashColor(value) {
  const colors = ["company-blue", "company-purple", "company-green", "company-amber"];
  let hash = 0;
  for (const character of String(value)) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function renderReminders() {
  const pending = state.reminders
    .filter(reminder => state.showAllReminders || !reminder.completed)
    .sort((left, right) => Number(left.completed) - Number(right.completed) || left.due_at.localeCompare(right.due_at));
  const visible = state.showAllReminders ? pending : pending.slice(0, 4);
  elements["reminder-list"].innerHTML = visible.length
    ? visible.map(reminder => `
      <article class="reminder-item ${reminder.completed ? "is-completed" : ""}">
        <button class="reminder-check ${reminder.completed ? "completed" : ""}" type="button" data-toggle-reminder="${escapeHtml(reminder.id)}" aria-label="${reminder.completed ? "Marcar pendiente" : "Completar"}: ${escapeHtml(reminder.title)}">${reminder.completed ? "✓" : ""}</button>
        <span class="reminder-copy"><strong>${escapeHtml(reminder.title)}</strong><small>${escapeHtml(reminder.company || "Recordatorio personal")}</small></span>
        <time class="reminder-date" datetime="${escapeHtml(reminder.due_at)}">${escapeHtml(formatReminderDate(reminder.due_at))}</time>
        <button class="reminder-remove" type="button" data-delete-reminder="${escapeHtml(reminder.id)}" aria-label="Eliminar recordatorio">×</button>
      </article>
    `).join("")
    : `<div class="reminder-empty"><span aria-hidden="true">◷</span><p>${state.showAllReminders ? "Aún no tienes recordatorios." : "No tienes próximos pasos pendientes."}</p></div>`;
  const completedCount = state.reminders.filter(reminder => reminder.completed).length;
  elements["all-reminders-button"].hidden = !state.reminders.length;
  elements["all-reminders-button"].textContent = state.showAllReminders
    ? "Mostrar próximos pasos"
    : `Ver todos los recordatorios (${state.reminders.length})`;
  elements["all-reminders-button"].dataset.completedCount = String(completedCount);
}

function openAuth(mode = "login") {
  state.authMode = mode;
  updateAuthDialog();
  showFormMessage(elements["auth-message"], "");
  elements["auth-form"].reset();
  elements["auth-dialog"].showModal();
}

function updateAuthDialog() {
  const registering = state.authMode === "register";
  elements["auth-title"].textContent = registering ? "Crea tu espacio" : "Bienvenido de nuevo";
  elements["auth-description"].textContent = registering
    ? "Tus postulaciones privadas, siempre bajo tu control."
    : "Inicia sesión para continuar con tu búsqueda.";
  elements["auth-submit"].innerHTML = registering
    ? 'Crear cuenta <span aria-hidden="true">→</span>'
    : 'Iniciar sesión <span aria-hidden="true">→</span>';
  elements["auth-password"].autocomplete = registering ? "new-password" : "current-password";
  elements["auth-password"].minLength = registering ? 12 : 1;
  elements["login-tab"].classList.toggle("active", !registering);
  elements["register-tab"].classList.toggle("active", registering);
  elements["login-tab"].setAttribute("aria-selected", String(!registering));
  elements["register-tab"].setAttribute("aria-selected", String(registering));
}

async function submitAuth(event) {
  event.preventDefault();
  showFormMessage(elements["auth-message"], "");
  const submit = elements["auth-submit"];
  submit.disabled = true;
  const registering = state.authMode === "register";
  try {
    const result = await apiRequest(`/api/auth/${registering ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify({
        email: elements["auth-email"].value,
        password: elements["auth-password"].value,
      }),
    });
    state.user = result.user;
    state.showAllReminders = false;
    elements["auth-dialog"].close();
    setMode("private");
    await loadPrivateData();
  } catch (error) {
    showFormMessage(elements["auth-message"], error.message);
  } finally {
    submit.disabled = false;
  }
}

function openApplicationForm(application = null) {
  state.editingId = application?.id || null;
  elements["application-title"].textContent = application ? "Editar postulación" : "Nueva postulación";
  elements["application-submit"].textContent = application ? "Guardar cambios" : "Guardar postulación";
  elements["application-id"].value = application?.id || "";
  elements["company-input"].value = application?.company || "";
  elements["position-input"].value = application?.position || "";
  elements["application-status"].value = application?.status || "Aplicado";
  elements["applied-on-input"].value = application?.applied_on || dateOnly();
  elements["location-input"].value = application?.location || "";
  elements["work-type-input"].value = application?.work_type || "";
  elements["salary-input"].value = application?.salary || "";
  elements["url-input"].value = application?.url || "";
  showFormMessage(elements["application-message"], "");
  elements["application-dialog"].showModal();
}

function applicationFormValue() {
  return {
    company: elements["company-input"].value,
    position: elements["position-input"].value,
    status: elements["application-status"].value,
    applied_on: elements["applied-on-input"].value,
    location: elements["location-input"].value,
    work_type: elements["work-type-input"].value,
    salary: elements["salary-input"].value,
    url: elements["url-input"].value,
  };
}

async function saveApplication(event) {
  event.preventDefault();
  const submit = elements["application-submit"];
  submit.disabled = true;
  showFormMessage(elements["application-message"], "");
  const values = applicationFormValue();
  try {
    if (state.mode === "demo") {
      if (state.editingId) {
        state.applications = state.applications.map(application =>
          application.id === state.editingId ? { ...application, ...values } : application,
        );
      } else {
        state.applications.unshift({ id: `demo-${crypto.randomUUID()}`, ...values, created_at: new Date().toISOString() });
      }
    } else {
      const updating = Boolean(state.editingId);
      const result = await apiRequest(
        updating ? `/api/applications/${encodeURIComponent(state.editingId)}` : "/api/applications",
        { method: updating ? "PUT" : "POST", body: JSON.stringify(values) },
      );
      if (updating) {
        state.applications = state.applications.map(application => application.id === result.id ? result : application);
      } else {
        state.applications.unshift(result);
      }
    }
    elements["application-dialog"].close();
    renderWorkspace();
  } catch (error) {
    showFormMessage(elements["application-message"], error.message);
  } finally {
    submit.disabled = false;
  }
}

async function loadNotes(application) {
  if (state.noteCache.has(application.id)) return state.noteCache.get(application.id);
  if (state.mode === "demo") return [];
  const result = await apiRequest(`/api/applications/${encodeURIComponent(application.id)}/notes`);
  state.noteCache.set(application.id, result.notes || []);
  return state.noteCache.get(application.id);
}

async function openDetail(applicationId) {
  const application = state.applications.find(item => item.id === applicationId);
  if (!application) return;
  elements["detail-content"].innerHTML = `
    <div class="detail-top">
      <div class="detail-company">
        <span class="company-icon ${hashColor(application.company)}">${escapeHtml(initials(application.company))}</span>
        <div><h2>${escapeHtml(application.company)}</h2><p>${escapeHtml(application.position)}</p></div>
      </div>
      <span class="status-pill ${statusClass(application.status)}">${escapeHtml(application.status)}</span>
    </div>
    <div class="detail-meta">
      <span>${escapeHtml(formatDate(application.applied_on))}</span>
      ${application.location ? `<span>${escapeHtml(application.location)}</span>` : ""}
      ${application.work_type ? `<span>${escapeHtml(application.work_type)}</span>` : ""}
      ${application.salary ? `<span>${escapeHtml(application.salary)}</span>` : ""}
      ${application.url ? `<a href="${escapeHtml(application.url)}" target="_blank" rel="noopener noreferrer">Ver oferta ↗</a>` : ""}
    </div>
    <div class="detail-actions">
      <button type="button" data-edit-application="${escapeHtml(application.id)}">Editar</button>
      <button class="danger-button" type="button" data-delete-application="${escapeHtml(application.id)}">Eliminar</button>
    </div>
    <div class="detail-notes-heading"><h3>Notas y seguimiento</h3><span class="note-count"></span></div>
    <div class="note-list" aria-live="polite"><p class="note-empty">Cargando notas…</p></div>
    <form class="note-form">
      <label class="sr-only" for="note-input">Escribe una nota</label>
      <textarea id="note-input" maxlength="2000" required placeholder="Anota una idea, contacto o próximo paso…"></textarea>
      <button type="submit">Agregar</button>
    </form>
    <p class="form-message detail-message" role="alert" hidden></p>
  `;
  elements["detail-dialog"].showModal();
  try {
    const notes = await loadNotes(application);
    renderNotes(notes);
  } catch (error) {
    const list = elements["detail-content"].querySelector(".note-list");
    list.innerHTML = `<p class="note-empty">${escapeHtml(error.message)}</p>`;
  }
}

function renderNotes(notes) {
  const list = elements["detail-content"].querySelector(".note-list");
  const count = elements["detail-content"].querySelector(".note-count");
  if (!list || !count) return;
  count.textContent = `${notes.length} ${notes.length === 1 ? "nota" : "notas"}`;
  list.innerHTML = notes.length
    ? notes.map(note => `<article class="note-item"><p>${escapeHtml(note.content)}</p><time datetime="${escapeHtml(note.created_at)}">${escapeHtml(new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at)))}</time></article>`).join("")
    : '<p class="note-empty">Todavía no hay notas para esta postulación.</p>';
}

async function submitNote(event) {
  if (!event.target.matches(".note-form")) return;
  event.preventDefault();
  const applicationId = elements["detail-content"].querySelector("[data-edit-application]")?.dataset.editApplication;
  const input = elements["detail-content"].querySelector("#note-input");
  const content = input?.value.trim();
  if (!applicationId || !content) return;
  const submit = event.target.querySelector("button");
  submit.disabled = true;
  const message = elements["detail-content"].querySelector(".detail-message");
  showFormMessage(message, "");
  try {
    let note;
    if (state.mode === "demo") {
      note = { id: `demo-note-${crypto.randomUUID()}`, content, created_at: new Date().toISOString() };
    } else {
      note = await apiRequest(`/api/applications/${encodeURIComponent(applicationId)}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    }
    const notes = state.noteCache.get(applicationId) || [];
    state.noteCache.set(applicationId, [note, ...notes]);
    input.value = "";
    renderNotes(state.noteCache.get(applicationId));
  } catch (error) {
    showFormMessage(message, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function deleteApplication(applicationId) {
  if (!window.confirm("¿Eliminar esta postulación y sus notas y recordatorios?")) return;
  try {
    if (state.mode === "private") {
      await apiRequest(`/api/applications/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
    }
    state.applications = state.applications.filter(application => application.id !== applicationId);
    state.reminders = state.reminders.filter(reminder => reminder.application_id !== applicationId);
    state.noteCache.delete(applicationId);
    elements["detail-dialog"].close();
    renderWorkspace();
  } catch (error) {
    showFormMessage(elements["detail-content"].querySelector(".detail-message"), error.message);
  }
}

function openReminderForm() {
  elements["reminder-form"].reset();
  showFormMessage(elements["reminder-message"], "");
  elements["reminder-application-input"].innerHTML = '<option value="">Ninguna</option>' +
    state.applications.map(application =>
      `<option value="${escapeHtml(application.id)}">${escapeHtml(application.company)} · ${escapeHtml(application.position)}</option>`,
    ).join("");
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  soon.setMinutes(Math.ceil(soon.getMinutes() / 15) * 15, 0, 0);
  elements["reminder-date-input"].value = `${dateOnly(soon)}T${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  elements["reminder-dialog"].showModal();
}

async function saveReminder(event) {
  event.preventDefault();
  showFormMessage(elements["reminder-message"], "");
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  const values = {
    title: elements["reminder-title-input"].value,
    due_at: new Date(elements["reminder-date-input"].value).toISOString(),
    application_id: elements["reminder-application-input"].value || null,
  };
  try {
    let reminder;
    if (state.mode === "demo") {
      const application = state.applications.find(item => item.id === values.application_id);
      reminder = { id: `demo-reminder-${crypto.randomUUID()}`, ...values, completed: 0, company: application?.company || "", position: application?.position || "" };
    } else {
      reminder = await apiRequest("/api/reminders", { method: "POST", body: JSON.stringify(values) });
      const application = state.applications.find(item => item.id === values.application_id);
      reminder.company = application?.company || "";
    }
    state.reminders.push(reminder);
    elements["reminder-dialog"].close();
    renderReminders();
  } catch (error) {
    showFormMessage(elements["reminder-message"], error.message);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function toggleReminder(reminderId) {
  const reminder = state.reminders.find(item => item.id === reminderId);
  if (!reminder) return;
  const completed = !Boolean(reminder.completed);
  try {
    if (state.mode === "private") {
      await apiRequest(`/api/reminders/${encodeURIComponent(reminderId)}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
    }
    reminder.completed = completed ? 1 : 0;
    renderReminders();
  } catch (error) {
    showError(error.message);
  }
}

async function deleteReminder(reminderId) {
  try {
    if (state.mode === "private") {
      await apiRequest(`/api/reminders/${encodeURIComponent(reminderId)}`, { method: "DELETE" });
    }
    state.reminders = state.reminders.filter(reminder => reminder.id !== reminderId);
    renderReminders();
  } catch (error) {
    showError(error.message);
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
  } catch (error) {
    showError(error.message);
    return;
  }
  state.user = null;
  state.applications = [];
  state.reminders = [];
  state.noteCache.clear();
  setMode("landing");
}

function exitDemo() {
  state.applications = [];
  state.reminders = [];
  state.noteCache.clear();
  elements["search-input"].value = "";
  elements["status-filter"].value = "";
  setMode("landing");
}

elements["demo-button"].addEventListener("click", () => {
  makeDemoData();
  state.showAllReminders = false;
  setMode("demo");
});
elements["create-account-button"].addEventListener("click", () => openAuth("register"));
elements["login-button"].addEventListener("click", () => openAuth("login"));
elements["logout-button"].addEventListener("click", logout);
elements["exit-demo-button"].addEventListener("click", exitDemo);
elements["login-tab"].addEventListener("click", () => { state.authMode = "login"; updateAuthDialog(); showFormMessage(elements["auth-message"], ""); });
elements["register-tab"].addEventListener("click", () => { state.authMode = "register"; updateAuthDialog(); showFormMessage(elements["auth-message"], ""); });
elements["auth-form"].addEventListener("submit", submitAuth);
elements["new-application-button"].addEventListener("click", () => openApplicationForm());
elements["application-form"].addEventListener("submit", saveApplication);
elements["new-reminder-button"].addEventListener("click", openReminderForm);
elements["reminder-form"].addEventListener("submit", saveReminder);
elements["search-input"].addEventListener("input", renderApplications);
elements["status-filter"].addEventListener("change", renderApplications);
elements["all-reminders-button"].addEventListener("click", () => {
  state.showAllReminders = !state.showAllReminders;
  renderReminders();
});
elements["application-list"].addEventListener("click", event => {
  const row = event.target.closest("[data-application-id]");
  const id = event.target.closest("[data-open-detail]")?.dataset.openDetail || row?.dataset.applicationId;
  if (id) openDetail(id);
});
elements["application-list"].addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-application-id]");
  if (!row || event.target.closest("button")) return;
  event.preventDefault();
  openDetail(row.dataset.applicationId);
});
elements["detail-content"].addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-application]");
  const remove = event.target.closest("[data-delete-application]");
  if (edit) {
    const application = state.applications.find(item => item.id === edit.dataset.editApplication);
    elements["detail-dialog"].close();
    if (application) openApplicationForm(application);
  }
  if (remove) deleteApplication(remove.dataset.deleteApplication);
});
elements["detail-content"].addEventListener("submit", submitNote);
elements["reminder-list"].addEventListener("click", event => {
  const toggle = event.target.closest("[data-toggle-reminder]");
  const remove = event.target.closest("[data-delete-reminder]");
  if (toggle) toggleReminder(toggle.dataset.toggleReminder);
  if (remove) deleteReminder(remove.dataset.deleteReminder);
});
document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close());
});

async function restoreSession() {
  try {
    const result = await apiRequest("/api/auth/me");
    if (!result.authenticated) return;
    state.user = result.user;
    setMode("private");
    await loadPrivateData();
  } catch (error) {
    if (!error.message.includes("Inicia sesión") && !error.message.includes("sesión venció")) {
      console.warn("No se pudo restaurar la sesión privada:", error.message);
    }
  }
}

restoreSession();
