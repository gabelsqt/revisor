(() => {
  "use strict";
  const button = document.querySelector("#grammarCheckButton");
  const segments = document.querySelector("#segments");
  if (!button || !segments) return;
  let approvedThisSession = false;
  let checking = false;

  function showMessage(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => toast.classList.remove("show"), 3800);
  }

  async function checkSelectedSegment() {
    if (checking) return;
    const row = segments.querySelector(".segment-row.is-selected");
    if (!row) {
      showMessage("Selecione primeiro um trecho clicando na linha que deseja verificar.");
      return;
    }
    const textarea = row.querySelector(".segment-cell.revised textarea");
    const text = textarea?.value || "";
    if (!text.trim()) {
      showMessage("Este trecho ainda não tem texto revisado.");
      return;
    }
    if (new TextEncoder().encode(text).byteLength > 18000) {
      showMessage("Este trecho é grande demais para a verificação gratuita. Divida-o em partes menores.");
      return;
    }
    if (!approvedThisSession) {
      const approved = window.confirm(
        "A verificação completa usa o LanguageTool, um serviço externo.\n\n" +
        "Ao continuar, apenas o texto da coluna REVISADO deste trecho será enviado ao LanguageTool para análise. " +
        "Não enviaremos seus comentários nem outros trechos.\n\n" +
        "As regras locais continuam funcionando sem enviar textos.\n\nAutorizar esta verificação?"
      );
      if (!approved) return;
      approvedThisSession = true;
    }

    checking = true;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Verificando…";
    try {
      const body = new URLSearchParams({ text, language: "pt-BR" });
      const response = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("O limite do serviço gratuito foi atingido. Tente novamente mais tarde.");
        throw new Error("O serviço de revisão respondeu com o código " + response.status + ".");
      }
      const result = await response.json();
      const entries = Array.isArray(result.matches) ? result.matches : [];
      if (typeof window.revisorReceiveCheck !== "function") throw new Error("O mecanismo de destaque não foi carregado.");
      window.revisorReceiveCheck(row.dataset.id, text, entries);
      if (textarea.value !== text) {
        showMessage("O trecho foi alterado durante a análise. Verifique novamente.");
      } else {
        showMessage(entries.length ? entries.length + " sugestões adicionais de ortografia e gramática." :
          "Nenhuma ocorrência adicional encontrada pelo serviço.");
      }
    } catch (error) {
      showMessage("Não foi possível consultar o LanguageTool. Os avisos locais continuam disponíveis.");
      console.warn("Falha na verificação externa do Revisor:", error);
    } finally {
      checking = false;
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
  button.addEventListener("click", checkSelectedSegment);
})();