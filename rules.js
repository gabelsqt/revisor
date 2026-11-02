(() => {
  "use strict";
  const KEY = "revisor-personal-rules-v1";
  const $ = (selector) => document.querySelector(selector);
  const segmentContainer = $("#segments");
  const ruleDialog = $("#rulesDialog");
  let rules = [];
  let editingId = null;

  // Correções locais básicas, sempre disponíveis e sem envio do texto.
  const BASIC_RULES = [
    ["ultimos", "últimos", "Acentuação"],
    ["ultimo", "último", "Acentuação"],
    ["faceis", "fáceis", "Acentuação"],
    ["importancia", "importância", "Acentuação"],
    ["duvida", "dúvida", "Acentuação"],
    ["rapido", "rápido", "Acentuação"],
    ["eficiencia", "eficiência", "Acentuação"],
    ["experiencia", "experiência", "Acentuação"],
    ["possivel", "possível", "Acentuação"],
    ["funcionarios", "funcionários", "Acentuação"],
    ["comunicaçao", "comunicação", "Ortografia"],
    ["presisamos", "precisamos", "Ortografia"],
    ["entreguee", "entregue", "Ortografia"],
    ["a disposição", "à disposição", "Crase"]
  ].map(([pattern, suggestion, note]) => ({
    kind: "literal", pattern, suggestion, note, enabled: true, wholeWord: true, caseSensitive: false
  })).concat([
    ["muitas\\s+pessoas\\s+prefere\\b", "muitas pessoas preferem", "Concordância verbal"],
    ["consumidores\\s+reclama\\b", "consumidores reclamam", "Concordância verbal"],
    ["ainda\\s+existe\\s+alguns\\b", "ainda existem alguns", "Concordância verbal"],
    ["respostas\\s+adequada\\b", "respostas adequadas", "Concordância nominal"],
    ["funcionários\\s+não\\s+estão\\s+preparado\\b", "funcionários não estão preparados", "Concordância nominal"],
    ["ser\\s+resolvido\\b", "ser resolvidos (conforme o sujeito)", "Verifique a concordância"],
    ["pessoas\\s+que\\s+busca\\b", "pessoas que buscam", "Concordância verbal"],
    ["clientes\\s+tenha\\b", "clientes tenham", "Concordância verbal"],
    ["clientes\\s+tenha\\b", "clientes tenham", "Concordância verbal"],
    ["problemas\\s+pela\\s+internet,\\s+mais\\s+nem", "problemas pela internet, mas nem", "Mas/mais"]
  ].map(([pattern, suggestion, note]) => ({
    kind: "regex", pattern, suggestion, note, enabled: true, wholeWord: false, caseSensitive: false
  })));
  const checkedSegments = new Map();

  const ruleId = () => "r-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  const escapeLiteral = (value) => Array.from(value, (char) =>
    ".*+?^$()[]{}|\\".includes(char) ? "\\" + char : char
  ).join("");

  function matcher(rule) {
    const expression = rule.kind === "regex" ? rule.pattern :
      (rule.wholeWord ? "(?<![\\p{L}\\p{N}_])" : "") +
      escapeLiteral(rule.pattern) +
      (rule.wholeWord ? "(?![\\p{L}\\p{N}_])" : "");
    return new RegExp(expression, rule.caseSensitive ? "gu" : "giu");
  }

  function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function loadRules() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(stored)) {
        rules = stored.filter((rule) => rule && typeof rule.pattern === "string" && rule.pattern.trim())
          .map((rule) => ({
            id: String(rule.id || ruleId()),
            kind: rule.kind === "regex" ? "regex" : "literal",
            pattern: rule.pattern.slice(0, 240),
            suggestion: String(rule.suggestion || "").slice(0, 240),
            note: String(rule.note || "").slice(0, 300),
            enabled: rule.enabled !== false,
            wholeWord: rule.wholeWord !== false,
            caseSensitive: rule.caseSensitive === true,
          }));
      }
    } catch {
      notify("Não foi possível ler as regras salvas.");
    }
    renderRuleList();
  }

  function saveRules() {
    try {
      localStorage.setItem(KEY, JSON.stringify(rules));
    } catch {
      notify("Não foi possível salvar suas regras neste navegador.");
    }
    renderRuleList();
    refreshAll();
  }



  function analyzeText(text, rowId) {
    const matches = [];
    const ranges = [];
    const source = String(text || "").slice(0, 10000);
    if (!source) return { matches, ranges };
    for (const [origin, group] of [["personalizada", rules], ["local", BASIC_RULES]]) {
      for (const rule of group) {
        if (!rule.enabled) continue;
        try {
          const regex = matcher(rule);
          let count = 0;
          let example = "";
          let found;
          while (count < 60 && (found = regex.exec(source)) !== null) {
            if (!found[0]) { regex.lastIndex += 1; continue; }
            count++;
            if (!example) example = found[0].slice(0, 90);
            if (ranges.length < 300) ranges.push({ start: found.index, end: found.index + found[0].length, origin });
          }
          if (count) matches.push({ rule, count, example, origin });
        } catch {
          // Regras inválidas são ignoradas para não interromper o editor.
        }
      }
    }
    const service = checkedSegments.get(rowId);
    if (service?.text === text) {
      for (const entry of service.matches) {
        const position = Number(entry.offset);
        const length = Number(entry.length);
        if (!Number.isInteger(position) || !Number.isInteger(length) || length < 1 ||
            position < 0 || position + length > source.length) continue;
        const suggestion = Array.isArray(entry.replacements) ?
          entry.replacements.slice(0, 3).map((replacement) => String(replacement.value || "")).filter(Boolean).join(" / ") : "";
        const rule = { suggestion, note: String(entry.message || "Rever esta passagem"), pattern: source.slice(position, position + length) };
        matches.push({ rule, count: 1, example: rule.pattern, origin: "gramática" });
        ranges.push({ start: position, end: position + length, origin: "gramática" });
      }
    }
    const priority = { gramática: 0, personalizada: 1, local: 2 };
    ranges.sort((a, b) => priority[a.origin] - priority[b.origin] || a.start - b.start || b.end - a.end);
    const selected = [];
    for (const range of ranges) {
      if (!selected.some((existing) => range.start < existing.end && existing.start < range.end)) selected.push(range);
    }
    selected.sort((a, b) => a.start - b.start);
    return { matches, ranges: selected };
  }

  function syncHighlightMirror(textarea) {
    const cell = textarea.closest(".segment-cell.revised");
    const mirror = cell && cell.querySelector(".rule-highlight-layer");
    if (!mirror) return;
    const computed = getComputedStyle(textarea);
    mirror.style.top = textarea.offsetTop + "px";
    mirror.style.left = textarea.offsetLeft + "px";
    mirror.style.width = textarea.clientWidth + "px";
    mirror.style.height = textarea.clientHeight + "px";
    mirror.style.font = computed.font;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.padding = computed.padding;
    mirror.style.textAlign = computed.textAlign;
    mirror.style.tabSize = computed.tabSize;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.scrollTop = textarea.scrollTop;
    mirror.scrollLeft = textarea.scrollLeft;
  }

  function updateHighlightMirror(textarea, ranges) {
    const cell = textarea.closest(".segment-cell.revised");
    if (!cell) return;
    let mirror = cell.querySelector(".rule-highlight-layer");
    if (!ranges.length) {
      if (mirror) mirror.remove();
      return;
    }
    if (!mirror) {
      mirror = document.createElement("div");
      mirror.className = "rule-highlight-layer";
      mirror.setAttribute("aria-hidden", "true");
      textarea.insertAdjacentElement("beforebegin", mirror);
    }
    mirror.replaceChildren();
    const value = textarea.value;
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) mirror.append(document.createTextNode(value.slice(cursor, range.start)));
      const mark = document.createElement("mark");
      mark.className = "rule-mark-" + (range.origin === "gramática" ? "grammar" : range.origin === "personalizada" ? "custom" : "basic");
      mark.textContent = value.slice(range.start, range.end);
      mirror.append(mark);
      cursor = range.end;
    }
    mirror.append(document.createTextNode(value.slice(cursor) + "\u200b"));
    syncHighlightMirror(textarea);
  }

  function refreshRow(row) {
    const revised = row.querySelector(".segment-cell.revised textarea");
    if (!revised) return;
    let feedback = row.querySelector(".rule-feedback");
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.className = "rule-feedback";
      feedback.setAttribute("aria-live", "polite");
      revised.insertAdjacentElement("afterend", feedback);
    }
    const { matches, ranges } = analyzeText(revised.value, row.dataset.id);
    updateHighlightMirror(revised, ranges);
    feedback.replaceChildren();
    feedback.hidden = !matches.length;
    if (!matches.length) return;
    const title = document.createElement("p");
    title.className = "rule-feedback-heading";
    title.textContent = matches.length === 1 ? "1 sugestão encontrada" :
      matches.length + " sugestões encontradas";
    feedback.append(title);
    const list = document.createElement("ul");
    list.className = "rule-feedback-list";
    for (const item of matches.slice(0, 8)) {
      const li = document.createElement("li");
      li.className = "rule-feedback-item";
      const matchLabel = document.createElement("span");
      matchLabel.textContent = "“" + item.example + "”" +
        (item.rule.suggestion ? " → “" + item.rule.suggestion + "”" : " · conferir");
      const context = document.createElement("small");
      context.textContent = (item.origin === "gramática" ? "LanguageTool" : item.origin === "local" ? "Verificador local" : "Regra pessoal") + " · " + (item.rule.note ? item.rule.note + " · " : "") +
        item.count + (item.count === 1 ? " ocorrência" : " ocorrências");
      li.append(matchLabel, context);
      list.append(li);
    }
    if (matches.length > 8) {
      const more = document.createElement("li");
      more.className = "rule-feedback-more";
      more.textContent = "Mais " + (matches.length - 8) + " regras encontradas";
      list.append(more);
    }
    feedback.append(list);
  }

  function refreshAll() {
    segmentContainer.querySelectorAll(".segment-row").forEach(refreshRow);
  }

  window.revisorReceiveCheck = (id, text, entries) => {
    checkedSegments.set(id, { text, matches: Array.isArray(entries) ? entries : [] });
    refreshAll();
  };


  function renderRuleList() {
    const list = $("#ruleList");
    const enabledCount = rules.filter((rule) => rule.enabled).length;
    $("#ruleCount").textContent = String(enabledCount);
    $("#ruleListSummary").textContent = rules.length ?
      enabledCount + " ativas de " + rules.length : "Nenhuma regra cadastrada";
    list.replaceChildren();
    if (!rules.length) {
      const empty = document.createElement("p");
      empty.className = "empty-documents";
      empty.textContent = "Você ainda não cadastrou regras. Adicione uma acima para começar.";
      list.append(empty);
      return;
    }
    for (const rule of rules) {
      const entry = document.createElement("div");
      entry.className = "rule-entry";
      if (!rule.enabled) entry.classList.add("rule-disabled");
      const info = document.createElement("div");
      info.className = "rule-entry-info";
      const name = document.createElement("strong");
      name.textContent = rule.pattern;
      const detail = document.createElement("span");
      detail.textContent = (rule.kind === "regex" ? "Regex" : "Texto") +
        (rule.suggestion ? " · Sugestão: " + rule.suggestion : " · Apenas sinalizar") +
        (rule.note ? " · " + rule.note : "");
      info.append(name, detail);

      const controls = document.createElement("div");
      controls.className = "rule-entry-actions";
      const enabledLabel = document.createElement("label");
      enabledLabel.className = "rule-toggle";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = rule.enabled;
      checkbox.setAttribute("aria-label", "Ativar regra " + rule.pattern);
      checkbox.addEventListener("change", () => {
        rule.enabled = checkbox.checked;
        saveRules();
      });
      enabledLabel.append(checkbox, document.createTextNode("Ativa"));
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "document-tool";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => editRule(rule.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "document-tool document-delete";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => {
        if (!window.confirm("Excluir a regra “" + rule.pattern + "”?")) return;
        rules = rules.filter((item) => item.id !== rule.id);
        if (editingId === rule.id) resetForm();
        saveRules();
        notify("Regra excluída.");
      });
      controls.append(enabledLabel, edit, remove);
      entry.append(info, controls);
      list.append(entry);
    }
  }

  function updateKindInput() {
    const isRegex = $("#ruleKind").value === "regex";
    $("#wholeWordField").classList.toggle("hidden", isRegex);
    $("#rulePattern").placeholder = isRegex ? "Ex.: \\b[a-z]+mente\\b" : "Ex.: pra";
  }

  function resetForm() {
    editingId = null;
    $("#ruleForm").reset();
    $("#saveRuleButton").textContent = "Adicionar regra";
    $("#cancelRuleEditButton").classList.add("hidden");
    updateKindInput();
  }

  function editRule(id) {
    const rule = rules.find((item) => item.id === id);
    if (!rule) return;
    editingId = id;
    $("#ruleKind").value = rule.kind;
    $("#rulePattern").value = rule.pattern;
    $("#ruleSuggestion").value = rule.suggestion;
    $("#ruleNote").value = rule.note;
    $("#ruleWholeWord").checked = rule.wholeWord;
    $("#ruleCaseSensitive").checked = rule.caseSensitive;
    $("#saveRuleButton").textContent = "Salvar alterações";
    $("#cancelRuleEditButton").classList.remove("hidden");
    updateKindInput();
    $("#rulePattern").focus();
  }

  function submitRule(event) {
    event.preventDefault();
    const pattern = $("#rulePattern").value.trim();
    const kind = $("#ruleKind").value === "regex" ? "regex" : "literal";
    if (!pattern) return notify("Preencha o campo Encontrar.");
    if (rules.some((rule) => rule.id !== editingId && rule.kind === kind &&
      rule.pattern.toLocaleLowerCase("pt-BR") === pattern.toLocaleLowerCase("pt-BR"))) {
      return notify("Essa regra já existe. Edite a regra cadastrada.");
    }
    const updated = {
      id: editingId || ruleId(),
      kind,
      pattern,
      suggestion: $("#ruleSuggestion").value.trim(),
      note: $("#ruleNote").value.trim(),
      wholeWord: $("#ruleWholeWord").checked,
      caseSensitive: $("#ruleCaseSensitive").checked,
      enabled: true,
    };
    try {
      matcher(updated);
    } catch {
      return notify("A expressão regular não é válida. Revise o padrão.");
    }
    if (editingId) {
      updated.enabled = rules.find((rule) => rule.id === editingId)?.enabled !== false;
      rules = rules.map((rule) => rule.id === editingId ? updated : rule);
    } else {
      rules.push(updated);
    }
    saveRules();
    resetForm();
    notify("Regra salva para todos os textos deste navegador.");
  }

  $("#rulesButton").addEventListener("click", () => {
    renderRuleList();
    ruleDialog.showModal();
  });
  $("#closeRulesButton").addEventListener("click", () => ruleDialog.close());
  ruleDialog.addEventListener("close", resetForm);
  $("#ruleKind").addEventListener("change", updateKindInput);
  $("#ruleForm").addEventListener("submit", submitRule);
  $("#cancelRuleEditButton").addEventListener("click", resetForm);

  segmentContainer.addEventListener("input", (event) => {
    if (event.target.matches(".segment-cell.revised textarea")) {
      const row = event.target.closest(".segment-row");
      if (row) refreshRow(row);
    }
  });
  // A camada visual acompanha a rolagem interna e o redimensionamento dos campos.
  segmentContainer.addEventListener("scroll", (event) => {
    if (event.target.matches && event.target.matches(".segment-cell.revised textarea")) {
      const textarea = event.target;
      const mirror = textarea.parentElement.querySelector(".rule-highlight-layer");
      if (mirror) {
        mirror.scrollTop = textarea.scrollTop;
        mirror.scrollLeft = textarea.scrollLeft;
      }
    }
  }, true);
  window.addEventListener("resize", () => {
    segmentContainer.querySelectorAll(".segment-cell.revised textarea").forEach(syncHighlightMirror);
  });
  segmentContainer.addEventListener("pointerup", (event) => {
    if (event.target.matches && event.target.matches(".segment-cell.revised textarea")) {
      requestAnimationFrame(() => syncHighlightMirror(event.target));
    }
  });

  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) =>
      node.nodeType === 1 && node.classList.contains("segment-row")))) refreshAll();
  }).observe(segmentContainer, { childList: true });

  loadRules();
  updateKindInput();
  refreshAll();
})();
