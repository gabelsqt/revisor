# Revisor

Um espaço simples para revisar copy trecho por trecho, mantendo original, comentários e versão revisada alinhados.

## Primeira versão

- Cole uma copy e separe-a automaticamente em segmentos por parágrafo.
- Edite o original, registre comentários e escreva a revisão em colunas paralelas.
- Adicione ou remova segmentos.
- Copie ou baixe a versão final.
- Mantenha vários textos em uma biblioteca local, com títulos, abertura, renomeação e exclusão com confirmação em duas etapas.
- Os textos são salvos automaticamente no armazenamento local do navegador; não há login nem sincronização entre aparelhos.

## Executar

Abra `index.html` em um navegador moderno. Não é necessário instalar dependências nem iniciar um servidor.

## Publicar no GitHub Pages

O repositório inclui um workflow que publica o site sempre que houver um push para `main`.

1. Crie no GitHub um repositório **público** chamado `revisor`. Deixe-o vazio, sem README, licença ou `.gitignore` inicial.
2. Na pasta deste projeto, conecte o repositório e envie os arquivos:

   ```sh
   git remote add origin https://github.com/SEU-USUARIO/revisor.git
   git push -u origin main
   ```

3. No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** em **Build and deployment → Source**.
4. Aguarde a execução do workflow na aba **Actions**. O endereço será `https://SEU-USUARIO.github.io/revisor/`.

Depois da primeira publicação, cada novo push para `main` atualiza o site. O repositório público contém os arquivos do projeto; os textos colados no Revisor ficam salvos no armazenamento local do navegador e não são enviados ao GitHub.

## Estrutura

- `index.html`: estrutura da interface.
- `styles.css`: estilos responsivos.
- `app.js`: divisão em segmentos, edição, persistência e exportação.

## Limites atuais

Os textos ficam no navegador e não sincronizam entre dispositivos. Esta primeira versão organiza a revisão; ela não sugere alterações automaticamente.
