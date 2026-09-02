# Conferência de Folha

Sistema que **compara a folha de dois meses (competências)** e aponta diferenças no pró-labore de
EMPREGADOS e CONTRIBUINTES, gerando um relatório final em PDF.

**Este sistema não calcula pró-labore e não possui pró-labore variável.** Ele apenas lê, compara e aponta
diferenças entre duas folhas já existentes.

Desde a adição de autenticação, o sistema **exige um servidor rodando** (não é mais só abrir o
`index.html` direto no navegador) — veja "Como iniciar o sistema" abaixo.

**Navegador oficial: Google Chrome.** É o único navegador testado neste sistema; use-o para
garantir compatibilidade (Edge, por ser baseado no mesmo motor, também tende a funcionar).

## Como iniciar o sistema

Requer [Node.js](https://nodejs.org) (versão 22 ou superior) e o **Google Chrome** instalados.

### Opção 1 — atalho (recomendado)

Dê duplo clique no atalho **"Conferência de Folha"** na Área de Trabalho (ou em
`Iniciar Conferência de Folha.bat`, na pasta do sistema). Ele inicia o servidor automaticamente e
abre o sistema numa janela do Chrome no modo app — sem abas nem barra de endereço, como um
programa separado. Feche essa janela para sair; o servidor continua rodando em segundo plano até
você fechar a janela minimizada do terminal (ou reiniciar o computador).

### Opção 2 — manual

1. Configure as credenciais (só na primeira vez — veja "Configuração do administrador" abaixo).
2. Abra um terminal na pasta `server/` e rode:
   ```
   npm install
   npm start
   ```
3. Acesse `http://localhost:3000` no **Chrome** (ou a porta que você definir em `PORT`, no `.env`).
4. Deixe esse terminal aberto enquanto o sistema estiver em uso — fechar a janela derruba o servidor.

## Configuração do administrador

1. Copie `server/.env.example` para `server/.env`.
2. Gere o hash da sua senha (dentro da pasta `server/`):
   ```
   npm run hash-password -- "sua-senha-aqui"
   ```
3. Preencha `server/.env`:
   - `ADMIN_USERNAME` — seu nome de usuário.
   - `ADMIN_PASSWORD_HASH` — a saída do comando acima (nunca a senha em texto puro).
   - `ADMIN_ACCESS_KEY` — uma segunda chave, só sua, diferente da senha (string longa e aleatória).
     Necessária **além** da senha para entrar como administrador.
   - `SESSION_SECRET` — uma string longa e aleatória qualquer (assina o cookie de sessão).
   - `ANTHROPIC_API_KEY` — opcional; só necessária para ler fotos/PDFs digitalizados.
4. **Nunca** commite o `.env` (já está no `.gitignore`) nem compartilhe essas variáveis.

Não existe cadastro de administrador pela tela — é sempre essa única conta, definida pelo `.env`.

## Como criar um colaborador

1. Entre em `http://localhost:3000/login` com seu usuário, senha **e** a chave de administrador.
2. No painel administrativo, vá em **Usuários** → preencha usuário/senha → **Criar colaborador**.
3. O colaborador entra em `/login` só com usuário e senha (sem a chave, que é exclusiva do admin).

Pela mesma tela é possível bloquear/desbloquear, trocar senha e excluir colaboradores.

## Como usar (colaborador)

1. Entre com usuário e senha em `/login`.
2. Envie a folha do **mês anterior** e a folha do **mês atual** (PDF, XLS, XLSX, CSV, TXT, JPG ou PNG — cada
   uma pode estar em um formato diferente).
3. Clique em **REALIZAR CONFERÊNCIA**.
4. Veja o resultado separado em **EMPREGADOS** e **CONTRIBUINTES** — as tabelas mostram só as
   **divergências** (aumento, redução, novo, não identificado no mês atual); quem ficou sem alteração só
   entra na contagem do resumo.
5. Clique em **BAIXAR RELATÓRIO PDF**.
6. Clique em **Sair** ao terminar.

## Autenticação e controle de acesso

Dois níveis: **ADMIN** (só a conta definida no `.env`, sem cadastro pela tela) e **COLLABORATOR**
(criados pelo admin, acesso só às funcionalidades operacionais).

- A role de cada usuário é decidida **inteiramente pelo backend**, na sessão criada no login — nada que o
  navegador envie depois é usado pra isso. `/admin` e as rotas `/api/admin/*` verificam autenticação e
  `role === 'ADMIN'` no servidor a cada requisição; um colaborador que tentar acessar recebe 403 (API) ou
  a página "Acesso negado" (tela), mesmo digitando a URL direto.
- Senhas: hash com `scrypt` (nativo do Node) — nunca texto puro, nunca em log.
- Sessão: cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, expira após inatividade
  (`SESSION_MAX_AGE_MINUTES`, padrão 30 min), persistida em SQLite (sobrevive a reinício do servidor).
- Login: limite de tentativas (`LOGIN_MAX_ATTEMPTS`, padrão 5) com bloqueio temporário
  (`LOGIN_LOCKOUT_MINUTES`, padrão 15 min); mensagem de erro sempre genérica ("Usuário ou senha
  inválidos."), sem indicar qual dado estava errado.
- `ADMIN_ACCESS_KEY` é uma credencial exclusiva do administrador — diferente da senha e diferente da
  `ANTHROPIC_API_KEY` — e nunca sai do servidor.
- Painel administrativo (`/admin`): Dashboard, Usuários, Configurações, API/IA, Logs, Segurança. Segredos
  (chave da Anthropic) aparecem sempre mascarados (ex.: `••••••••ABCD`), nunca completos.

## Como o sistema lê os arquivos

- **PDF nativo, XLS/XLSX, CSV, TXT**: leitura 100% local e determinística no navegador, sem custo. O
  sistema localiza os cabeçalhos "EMPREGADOS" e "CONTRIBUINTES" no documento e extrai código, nome e valor
  de cada linha dentro dessas seções.
- **Fotos e PDFs digitalizados (sem texto selecionável)**: lidos via Claude (API da Anthropic), calibrado
  para o relatório "Relação Geral dos Líquidos". A chamada à API acontece **no servidor**
  (`POST /api/vision/extract`, usando `ANTHROPIC_API_KEY` do `.env`) — o navegador nunca tem acesso a essa
  chave. Sem `ANTHROPIC_API_KEY` configurada, esse tipo de arquivo mostra um erro claro em vez de travar.

## Como o sistema decide se um aviso é necessário

Quando uma seção (EMPREGADOS ou CONTRIBUINTES) é encontrada no documento mas nenhum registro é extraído
dela, o sistema usa a linha de **resumo por empresa** ("Empregados: N", "Contribuintes: N"), quando ela
existe no documento, como fonte de certeza:

- resumo bate com o que foi extraído (inclusive 0 = 0) → confirmado correto, **sem aviso**;
- resumo diverge do extraído (ex.: resumo diz 3, só foram lidos 0) → falha de leitura **confirmada**;
- sem resumo disponível para conferir → mantém uma checagem cautelosa internamente.

Textos administrativos comuns em quebra de página (rodapé com cidade/data, "Responsável:", "Página: X / Y",
cabeçalho de empresa repetido) são ignorados e nunca aparecem como "linha não reconhecida".

## Limitações conhecidas

- O parser de EMPREGADOS/CONTRIBUINTES é calibrado para o layout do relatório "Relação Geral dos Líquidos"
  descrito pelo escritório; outras variações de formatação podem exigir ajuste.
- Se uma linha de dado não puder ser interpretada com segurança, o sistema nunca inventa o valor — ele
  não a inclui na comparação.
- A chamada real à API da Anthropic (leitura de fotos/scans) não foi testada de ponta a ponta nesta sessão
  por falta de uma chave real — só a validação/conversão de dados foi testada com respostas simuladas.

## Estrutura

```
Iniciar Conferência de Folha.bat   inicia o servidor e abre o Chrome em modo app
index.html                     shell operacional (upload, resultado) — só acessível autenticado
login.html                     tela de login
admin.html                     painel administrativo — só acessível como ADMIN
acesso-negado.html             página de erro 403 (colaborador tentando acessar /admin)
css/app.css                    estilos da área operacional
css/login.css                  estilos da tela de login/acesso negado
css/admin.css                  estilos do painel administrativo
js/authGuard.js                checa sessão e liga o botão "Sair" (index.html e admin.html)
js/login.js                    lógica da tela de login
js/admin.js                    lógica do painel administrativo
js/config.js, js/utils.js      configuração e utilitários (dinheiro, CNPJ, competência, nomes)
js/fileTypeDetector.js         detecção de tipo de arquivo
js/extractors/                 leitura bruta por formato (pdf, xlsx, csv/txt, visão via backend)
js/normalize/                  segmentação por empresa + localização de EMPREGADOS/CONTRIBUINTES
js/identity/matcher.js         chave de identidade (CNPJ + código, ou nome)
js/compare/engine.js           motor de comparação (determinístico)
js/validate/validator.js       validações antes da conferência
js/report/pdfReport.js         geração do PDF final (pdfmake)
js/ui/render.js                renderização das telas

server/                        backend (Node.js + Express) — autenticação, admin, proxy da API da Anthropic
  .env.example                 modelo de variáveis de ambiente (copiar para .env)
  scripts/hash-password.js     gera ADMIN_PASSWORD_HASH a partir de uma senha
  src/config/env.js            carrega e valida variáveis de ambiente
  src/db/database.js           SQLite (nativo do Node) — usuários, logs, sessões
  src/auth/                    hashing de senha, identidade do admin, sessão, rate limit, middlewares
  src/controllers/, routes/    login/logout, CRUD de usuários, dashboard/logs/configurações, proxy de visão
  src/app.js, src/server.js    montagem do Express e ponto de entrada
```

## Custos

A leitura de PDF nativo, Excel, CSV e TXT é 100% local e sem custo. Fotos e PDFs digitalizados usam a API
da Anthropic (cobrada por token na conta associada à `ANTHROPIC_API_KEY` configurada no servidor).
