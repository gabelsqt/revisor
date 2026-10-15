(() => {
  const STORAGE_KEY = "revisor-draft-v1";
  const $ = (selector) => document.querySelector(selector);
  const intro = $("#intro");
  const workspace = $("#workspace");
  const sourceInput = $("#sourceInput");
  const segmentsEl = $("#segments");
  let segments = [];
  let documents = [];
  let currentDocumentId = null;
  let saveTimer;
  let toastTimer;
  let pendingDeleteId = null;
  let pendingDeleteTimer;

  function saveLibrary() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documents, activeDocumentId: currentDocumentId }));
    $("#documentCount").textContent = String(documents.length);
  }

  function persistNow() {
    clearTimeout(saveTimer);
    if (!currentDocumentId) return;
    const active = documents.find((document) => document.id === currentDocumentId);
    if (!active) return;
    active.segments = segments;
    active.updatedAt = new Date().toISOString();
    saveLibrary();
    $("#saveStatus").textContent = "Salvo neste navegador";
    renderDocumentList();
  }

  function persist() {
    if (!currentDocumentId) return;
    clearTimeout(saveTimer);
    $("#saveStatus").textContent = "Salvando…";
    saveTimer = setTimeout(persistNow, 250);
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

  function makeId() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderDocumentList() {
    const list = $("#documentList");
    if (!list) return;
    list.replaceChildren();
    $("#documentCount").textContent = String(documents.length);
    if (!documents.length) {
      const empty = document.createElement("p");
      empty.className = "empty-documents";
      empty.textContent = "Seus textos salvos aparecerão aqui.";
      list.append(empty);
      return;
    }
    [...documents].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).forEach((document) => {
      const row = document.createElement("article");
      row.className = `document-entry${document.id === currentDocumentId ? " is-active" : ""}`;
      const open = document.createElement("button");
      open.className = "document-open";
      open.type = "button";
      const title = document.createElement("strong");
      title.textContent = document.title || "Texto sem título";
      const detail = document.createElement("small");
      const count = document.segments?.length || 0;
      const updated = document.updatedAt ? new Date(document.updatedAt).toLocaleDateString("pt-BR") : "agora";
      detail.textContent = `${count} ${count === 1 ? "segmento" : "segmentos"} · ${updated}`;
      open.append(title, detail);
      open.addEventListener("click", () => openDocument(document.id));
      const tools = document.createElement("div");
      tools.className = "document-tools";
      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "document-tool";
      rename.textContent = "Renomear";
      rename.addEventListener("click", () => renameDocument(document.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "document-tool document-delete";
      remove.textContent = pendingDeleteId === document.id ? "Confirmar exclusão" : "Apagar";
      remove.addEventListener("click", () => deleteDocument(document.id));
      tools.append(rename, remove);
      row.append(open, tools);
      list.append(row);
    });
  }

  function openDocument(id) {
    persistNow();
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    currentDocumentId = document.id;
    segments = document.segments || [];
    sourceInput.value = segments.map((segment) => segment.original).join("\n\n");
    $("#documentsDialog").close();
    showWorkspace();
    saveLibrary();
    $("#saveStatus").textContent = "Salvo neste navegador";
    renderDocumentList();
  }

  function startNewDocument() {
    persistNow();
    currentDocumentId = null;
    segments = [];
    sourceInput.value = "";
    $("#documentsDialog").close();
    workspace.classList.add("hidden");
    intro.classList.remove("hidden");
    renderDocumentList();
    window.scrollTo({ top: 0, behavior: "smooth" });
    sourceInput.focus();
  }

  function renameDocument(id) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const name = window.prompt("Nome deste texto:", document.title || "Texto sem título");
    if (name === null || !name.trim()) return;
    document.title = name.trim().slice(0, 80);
    document.updatedAt = new Date().toISOString();
    saveLibrary();
    renderDocumentList();
  }

  function deleteDocument(id) {
    if (pendingDeleteId !== id) {
      pendingDeleteId = id;
      renderDocumentList();
      announce("Clique em “Confirmar exclusão” para apagar este texto.");
      clearTimeout(pendingDeleteTimer);
      pendingDeleteTimer = setTimeout(() => { pendingDeleteId = null; renderDocumentList(); }, 5000);
      return;
    }
    clearTimeout(pendingDeleteTimer);
    pendingDeleteId = null;
    documents = documents.filter((document) => document.id !== id);
    if (currentDocumentId === id) {
      currentDocumentId = null;
      segments = [];
      sourceInput.value = "";
      workspace.classList.add("hidden");
      intro.classList.remove("hidden");
    }
    saveLibrary();
    renderDocumentList();
    announce("Texto apagado.");
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
    if (!currentDocumentId) {
      const suggestedTitle = segments[0]?.original.split(/\s+/).slice(0, 7).join(" ").slice(0, 52) || "Texto sem título";
      const document = { id: makeId(), title: suggestedTitle, segments, updatedAt: new Date().toISOString() };
      documents.push(document);
      currentDocumentId = document.id;
      saveLibrary();
    }
    persist();
    showWorkspace();
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

  function xmlEscape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;",
    })[character]);
  }

  function docxParagraph(value, options = {}) {
    const lines = String(value).split(/\r?\n/);
    const runStyle = `${options.bold ? "<w:b/>" : ""}${options.color ? `<w:color w:val="${options.color}"/>` : ""}${options.size ? `<w:sz w:val="${options.size}"/>` : ""}`;
    const runs = lines.map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r>${runStyle ? `<w:rPr>${runStyle}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(line || " ")}</w:t></w:r>`).join("");
    const after = options.after ?? 100;
    return `<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr>${runs}</w:p>`;
  }

  function docxCell(value, width, header = false) {
    const fill = header ? '<w:shd w:fill="344F43"/><w:tcMar><w:top w:w="110" w:type="dxa"/><w:start w:w="100" w:type="dxa"/><w:bottom w:w="110" w:type="dxa"/><w:end w:w="100" w:type="dxa"/></w:tcMar>' : '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:start w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:end w:w="100" w:type="dxa"/></w:tcMar>';
    const text = docxParagraph(value, { bold: header, color: header ? "FFFFFF" : "27352C", after: 0 });
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill}<w:vAlign w:val="top"/></w:tcPr>${text}</w:tc>`;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipFiles(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    let centralSize = 0;
    files.forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true); local.set(nameBytes, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, localOffset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      localOffset += local.length + data.length;
      centralSize += central.length;
    });
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true); ev.setUint32(16, localOffset, true); ev.setUint16(20, 0, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  function reportDocx() {
    const widths = [700, 4900, 4400, 5400];
    const border = '<w:tblBorders><w:top w:val="single" w:sz="5" w:color="D8D9D1"/><w:left w:val="single" w:sz="5" w:color="D8D9D1"/><w:bottom w:val="single" w:sz="5" w:color="D8D9D1"/><w:right w:val="single" w:sz="5" w:color="D8D9D1"/><w:insideH w:val="single" w:sz="5" w:color="D8D9D1"/><w:insideV w:val="single" w:sz="5" w:color="D8D9D1"/></w:tblBorders>';
    const headers = ["#", "Original", "Comentários", "Texto revisado"];
    const headerRow = `<w:tr>${headers.map((value, index) => docxCell(value, widths[index], true)).join("")}</w:tr>`;
    const rows = segments.map((segment, index) => {
      const values = [String(index + 1).padStart(2, "0"), segment.original || "—", segment.comments || "—", segment.revised.trim() || segment.original || "—"];
      return `<w:tr>${values.map((value, cellIndex) => docxCell(value, widths[cellIndex])).join("")}</w:tr>`;
    }).join("");
    const date = new Date().toLocaleDateString("pt-BR");
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${docxParagraph("Correções da copy", { bold: true, color: "263D33", size: 36, after: 80 })}${docxParagraph(`Relatório de revisão · ${date} · ${segments.length} ${segments.length === 1 ? "segmento" : "segmentos"}`, { after: 260 })}<w:tbl><w:tblPr><w:tblW w:w="15400" w:type="dxa"/><w:tblLayout w:type="fixed"/>${border}</w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${headerRow}${rows}</w:tbl><w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    const relationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    return zipFiles([["[Content_Types].xml", contentTypes], ["_rels/.rels", relationships], ["word/document.xml", documentXml]]);
  }

  function downloadReport(format) {
    if (!segments.length) return announce("Adicione pelo menos um segmento antes de baixar.");
    const isWord = format === "docx";
    const blob = isWord ? reportDocx() : new Blob([reportHtml()], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const date = new Date();
    const dateLabel = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    link.href = url;
    link.download = `relatorio-revisao-${dateLabel}.${isWord ? "docx" : "html"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("#downloadMenu").open = false;
    announce(isWord ? "Relatório Word (.docx) baixado." : "Relatório HTML baixado.");
  }

  $("#startButton").addEventListener("click", startReview);
  $("#backButton").addEventListener("click", () => {
    workspace.classList.add("hidden");
    intro.classList.remove("hidden");
    sourceInput.value = segments.map((segment) => segment.original).join("\n\n");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#documentsButton").addEventListener("click", () => {
    renderDocumentList();
    $("#documentsDialog").showModal();
  });
  $("#closeDocumentsButton").addEventListener("click", () => $("#documentsDialog").close());
  $("#newDocumentButton").addEventListener("click", startNewDocument);
  $("#dialogNewDocumentButton").addEventListener("click", startNewDocument);
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
  $("#exportWordButton").addEventListener("click", () => downloadReport("docx"));

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved?.documents)) {
      documents = saved.documents;
      const active = documents.find((document) => document.id === saved.activeDocumentId);
      if (active) openDocument(active.id);
      else renderDocumentList();
    } else if (saved?.segments?.length) {
      const document = { id: makeId(), title: "Texto salvo", segments: saved.segments, updatedAt: new Date().toISOString() };
      documents = [document];
      currentDocumentId = document.id;
      segments = document.segments;
      saveLibrary();
      sourceInput.value = segments.map((segment) => segment.original).join("\n\n");
      showWorkspace();
    } else {
      renderDocumentList();
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    renderDocumentList();
  }
})();
