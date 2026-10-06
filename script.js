const $ = (s) => document.querySelector(s);
const form = $("#form"), rows = $("#rows"), search = $("#search");
let editingId = null, students = [], debounce;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(url, method = "GET", data) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json;
}

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function showErrors(errors = {}) {
  form.querySelectorAll(".err").forEach((el) => (el.textContent = errors[el.dataset.for] || ""));
  form.querySelectorAll("input").forEach((i) => i.classList.toggle("bad", !!errors[i.name]));
}

async function load() {
  const q = search.value.trim();
  students = await api("/api/students?q=" + encodeURIComponent(q));
  rows.innerHTML = students.map((s) => `
    <tr class="${s.id === editingId ? "editing" : ""}">
      <td>${esc(s.roll_no)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.class)}</td>
      <td><span class="marks">${s.marks}<span class="bar"><i class="${s.marks < 40 ? "low" : ""}" style="width:${s.marks}%"></i></span></span></td>
      <td>${esc(s.contact)}</td>
      <td>
        <button class="link" data-edit="${s.id}">Edit</button>
        <button class="link del" data-del="${s.id}">Delete</button>
      </td>
    </tr>`).join("");

  const empty = $("#empty");
  empty.hidden = students.length > 0;
  empty.textContent = q
    ? `No student matches "${q}". Check the name or roll number.`
    : "No students yet. Add the first one using the form.";

  const avg = students.length ? (students.reduce((a, s) => a + s.marks, 0) / students.length).toFixed(1) : "0";
  $("#summary").textContent = `${students.length} ${students.length === 1 ? "student" : "students"} shown, average marks ${avg}`;
}

function resetForm() {
  editingId = null;
  form.reset();
  showErrors();
  $("#form-title").textContent = "Add student";
  $("#save").textContent = "Add student";
  $("#cancel").hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  try {
    if (editingId) {
      await api(`/api/students/${editingId}`, "PUT", data);
      toast("Changes saved");
    } else {
      await api("/api/students", "POST", data);
      toast("Student added");
    }
    resetForm();
    load();
  } catch (err) {
    showErrors(err.errors || {});
    if (err.error) toast(err.error);
  }
});

rows.addEventListener("click", async (e) => {
  const editId = e.target.dataset.edit, delId = e.target.dataset.del;
  if (editId) {
    const s = students.find((x) => x.id === +editId);
    editingId = s.id;
    for (const k of ["name", "roll_no", "class", "marks", "contact"]) form.elements[k].value = s[k];
    showErrors();
    $("#form-title").textContent = "Edit student";
    $("#save").textContent = "Save changes";
    $("#cancel").hidden = false;
    form.elements.name.focus();
    load();
  } else if (delId) {
    const s = students.find((x) => x.id === +delId);
    if (!confirm(`Delete ${s.name} (${s.roll_no})?`)) return;
    try {
      await api(`/api/students/${delId}`, "DELETE");
      if (editingId === +delId) resetForm();
      toast("Student deleted");
    } catch (err) {
      toast(err.error || "Could not delete student.");
    }
    load();
  }
});

$("#cancel").addEventListener("click", () => { resetForm(); load(); });
search.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(load, 200); });

load();
