(() => {
  const STORAGE_KEY = "revisor-draft-v1";
  const $ = (selector) => document.querySelector(selector);
  const intro = $("#intro");
  const workspace = $("#workspace");
  const sourceInput = $("#sourceInput");
  const segmentsEl = $("#segments");
  let segments = [];
  let saveTimer;
  let toastTimer;

  function persist() {
    clearTimeout(saveTimer);
    $("#saveStatus").textContent = "Salvando…";
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ segments }));
      $("#saveStatus").textContent = "Salvo neste navegador";
    }, 250);
  }

  function announce(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function updateCount() {
    const count = segments.length;
    $("#segmentCount").textContent = `${count} ${count === 1 ? "segmento" : "segmentos"}`;
  }

  function makeSegment(original = "", comments = "", revised = "") {
    return { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`, original, comments, revised };
  }

  function render() {
    segmentsEl.replaceChildren();
    segments.forEach((segment, index) => {
      const row = document.createElement("article");
      row.className = "segment-row";
      row.dataset.id = segment.id;
      const cells = [
        ["original", "Original", segment.original, "Trecho original"],
        ["comments", "Comentários", segment.comments, "Anote o que precisa mudar…"],
        ["revised", "Texto revisado", segment.revised, "Escreva a versão revisada…"],
      ];
      cells.forEach(([key, label, value, placeholder]) => {
        const cell = document.createElement("div");
        cell.className = `segment-cell ${key}`;
        const caption = document.createElement("p");
        caption.className = "cell-label";
        caption.textContent = `${String(index + 1).padStart(2, "0")} · ${label}`;
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.placeholder = placeholder;
        if (key === "original") textarea.readOnly = true;
        textarea.setAttribute("aria-label", `${label}, segmento ${index + 1}`);
        textarea.rows = Math.max(3, Math.min(8, Math.ceil((value.length || 55) / 48)));
        textarea.addEventListener("input", () => {
          segment[key] = textarea.value;
          textarea.rows = Math.max(3, Math.min(8, Math.ceil((textarea.value.length || 55) / 48)));
          persist();
        });
        cell.append(caption, textarea);
        row.append(cell);
      });
      const remove = document.createElement("button");
      remove.className = "remove-segment";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Remover segmento";
      remove.setAttribute("aria-label", `Remover segmento ${index + 1}`);
      remove.addEventListener("click", () => {
        segments = segments.filter((item) => item.id !== segment.id);
        render();
        persist();
      });
      row.append(remove);
      segmentsEl.append(row);
    });
    updateCount();
  }

  function showWorkspace() {
    intro.classList.add("hidden");
    workspace.classList.remove("hidden");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startReview() {
    const text = sourceInput.value.trim();
    if (!text) {
      sourceInput.focus();
      announce("Cole o texto que você quer revisar primeiro.");
      return;
    }
    segments = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => makeSegment(part, "", part));
    persist();
    showWorkspace();
  }

  function setNewDraft() {
    segments = [];
    sourceInput.value = "";
    localStorage.removeItem(STORAGE_KEY);
    workspace.classList.add("hidden");
    intro.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    sourceInput.focus();
  }

  function finalText() {
    return segments.map((segment) => (segment.revised.trim() || segment.original.trim())).filter(Boolean).join("\n\n");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[character]);
  }

  function reportHtml() {
    const rows = segments.map((segment, index) => `
      <tr>
        <td class="number">${String(index + 1).padStart(2, "0")}</td>
        <td>${escapeHtml(segment.original || "—")}</td>
        <td>${escapeHtml(segment.comments || "—")}</td>
        <td>${escapeHtml(segment.revised.trim() || segment.original || "—")}</td>
      </tr>`).join("");
    const today = new Date().toLocaleDateString("pt-BR");
    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório de revisão — Revisor</title>
<style>
@page{size:landscape;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#20231f;margin:32px auto;max-width:1200px;padding:0 18px}header{border-bottom:3px solid #344f43;padding-bottom:18px;margin-bottom:24px}header p{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#68736a;margin:0 0 9px}h1{font-size:28px;margin:0 0 7px}header small{color:#73776e}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}th{background:#344f43;color:#fff;text-align:left;padding:10px;border:1px solid #344f43}td{vertical-align:top;padding:11px;border:1px solid #d8d9d1;white-space:pre-wrap;line-height:1.55;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f6f6f1}.number{width:38px;color:#81877e;font-family:monospace}th:first-child{width:44px}footer{margin-top:22px;color:#83877f;font-size:10px}@media screen{body{background:#f5f4ef}table{background:#fff}}
</style></head><body><header><p>Revisor · relatório de revisão</p><h1>Correções da copy</h1><small>${today} · ${segments.length} ${segments.length === 1 ? "segmento" : "segmentos"}</small></header>
<table><thead><tr><th>#</th><th>Original</th><th>Comentários</th><th>Texto revisado</th></tr></thead><tbody>${rows}</tbody></table>
<footer>Relatório gerado pelo Revisor.</footer></body></html>`;
  }

  function downloadReport(format) {
    if (!segments.length) return announce("Adicione pelo menos um segmento antes de baixar.");
    const content = reportHtml();
    const isWord = format === "doc";
    const blob = new Blob([content], { type: isWord ? "application/msword;charset=utf-8" : "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const date = new Date();
    const dateLabel = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    link.href = url;
    link.download = `relatorio-revisao-${dateLabel}.${isWord ? "doc" : "html"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(isWord ? "Relatório Word baixado." : "Relatório HTML baixado.");
  }

  $("#startButton").addEventListener("click", startReview);
  $("#backButton").addEventListener("click", () => {
    workspace.classList.add("hidden");
    intro.classList.remove("hidden");
    sourceInput.value = segments.map((segment) => segment.original).join("\n\n");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#clearButton").addEventListener("click", setNewDraft);
  $("#addButton").addEventListener("click", () => {
    const segment = makeSegment();
    segments.push(segment);
    render();
    persist();
    segmentsEl.lastElementChild?.querySelector(".original textarea")?.focus();
  });
  $("#copyButton").addEventListener("click", async () => {
    const text = finalText();
    if (!text) return announce("Adicione texto revisado antes de copiar.");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement("textarea");
        temporary.value = text;
        temporary.style.position = "fixed";
        temporary.style.opacity = "0";
        document.body.append(temporary);
        temporary.select();
        const copied = document.execCommand("copy");
        temporary.remove();
        if (!copied) throw new Error("copy failed");
      }
      announce("Versão final copiada.");
    } catch {
      announce("Não foi possível acessar a área de transferência.");
    }
  });
  $("#exportButton").addEventListener("click", () => {
    const text = finalText();
    if (!text) return announce("Adicione texto revisado antes de baixar.");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "copy-revisada.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  $("#exportHtmlButton").addEventListener("click", () => downloadReport("html"));
  $("#exportWordButton").addEventListener("click", () => downloadReport("doc"));

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.segments?.length) {
      segments = saved.segments;
      sourceInput.value = segments.map((segment) => segment.original).join("\n\n");
      showWorkspace();
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
})();
