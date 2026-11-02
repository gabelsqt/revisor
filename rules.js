(() => {
  "use strict";
  const KEY = "revisor-personal-rules-v1";
  const $ = (selector) => document.querySelector(selector);
  const segmentContainer = $("#segments");
  const ruleDialog = $("#rulesDialog");
  let rules = [];
  let editingId = null;

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

  function matchesFor(text) {
    const matches = [];
    const source = String(text || "").slice(0, 10000);
    if (!source) return matches;

    for (const rule of rules) {
      if (!rule.enabled) continue;
      try {
        const regex = matcher(rule);
        let count = 0;
        let example = "";
        let found;
        while (count < 100 && (found = regex.exec(source)) !== null) {
          if (!found[0]) {
            regex.lastIndex += 1;
            continue;
          }
          count += 1;
          if (!example) example = found[0].slice(0, 90);
        }
        if (count) matches.push({ rule, count, example });
      } catch {
        // Uma regra inválida não deve interromper a revisão.
      }
    }
    return matches;
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
    const matched = matchesFor(revised.value);
    feedback.replaceChildren();
    feedback.hidden = !matched.length;
    if (!matched.length) return;

    const title = document.createElement("p");
    title.className = "rule-feedback-heading";
    title.textContent = matched.length === 1 ? "1 regra personalizada encontrada" :
      matched.length + " regras personalizadas encontradas";
    feedback.append(title);
    const list = document.createElement("ul");
    list.className = "rule-feedback-list";
    for (const item of matched.slice(0, 8)) {
      const li = document.createElement("li");
      li.className = "rule-feedback-item";
      const matchLabel = document.createElement("span");
      matchLabel.textContent = "“" + item.example + "”" +
        (item.rule.suggestion ? " → “" + item.rule.suggestion + "”" : " · conferir");
      const context = document.createElement("small");
      context.textContent = (item.rule.note ? item.rule.note + " · " : "") +
        item.count + (item.count === 1 ? " ocorrência" : " ocorrências");
      li.append(matchLabel, context);
      list.append(li);
    }
    if (matched.length > 8) {
      const more = document.createElement("li");
      more.className = "rule-feedback-more";
      more.textContent = "Mais " + (matched.length - 8) + " regras encontradas";
      list.append(more);
    }
    feedback.append(list);
  }

  function refreshAll() {
    segmentContainer.querySelectorAll(".segment-row").forEach(refreshRow);
  }

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
  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) =>
      node.nodeType === 1 && node.classList.contains("segment-row")))) refreshAll();
  }).observe(segmentContainer, { childList: true });

  loadRules();
  updateKindInput();
  refreshAll();
})();
