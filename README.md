# Armazém MAcaé

Base inicial de desenvolvimento web com HTML, CSS, JavaScript e dados em JSON.
Inclui dois servidores locais alternativos: Node.js e Java. A página é um ponto
de partida editável; ainda não implementa catálogo comercial, pedidos ou pagamentos.

## Abrir sem instalar nada

Abra o arquivo **`index.html` da raiz do projeto** por duplo clique. Ele contém
o HTML, o CSS, o JavaScript e os dados em um só arquivo, funcionando sem internet,
Node ou Java. Essa é uma cópia pronta para visualização.

Para editar os fontes, use a pasta `public/`. Seu `index.html` também pode ser
aberto diretamente, desde que `app.js` e `styles.css` permaneçam ao lado dele.
Nesse modo, usa os dados iniciais embutidos no HTML. Para atualizar a cópia
independente com alterações nos fontes ou em `public/data/site.json`, execute
`npm run export` e reabra o `index.html` da raiz.

Baixe o projeto pelo GitHub: na branch que contém estes arquivos, escolha
**Code → Download ZIP**, extraia a pasta e abra o `index.html` da raiz. Links
com caminhos internos de um ambiente na nuvem não são downloads do GitHub.

## Começar

Requisitos: Node.js 22 ou superior (recomendado: 24, indicado em `.nvmrc`) e npm.
O servidor Java requer um JDK 21 ou superior com suporte à execução de arquivos-fonte.
Não há dependências externas, banco de dados ou credenciais obrigatórias.

Na raiz do repositório:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

O servidor Node usa a porta 3000 e reinicia quando o código do servidor muda.
Atualize o navegador para ver as alterações de HTML, CSS, JavaScript ou JSON.
Use `npm start` para executar sem o monitoramento de arquivos. Encerre com `Ctrl+C`.

Para usar Java em vez de Node como servidor:

```sh
npm run dev:java
```

Esse comando executa `java server/DevServer.java` na porta 3001. Também pode ser
executado diretamente, sem npm. O Java compila o arquivo-fonte em memória; não
é necessário instalar Maven, Gradle ou executar `javac` separadamente.
Reinicie o comando quando alterar o código Java.

`HOST` e `PORT` são opcionais. Por padrão, ambos os servidores escutam apenas
na interface local. Para mudar a porta, por exemplo:

```sh
PORT=4000 npm start
```

Esses exemplos de variáveis usam sintaxe de Bash. Os servidores são ferramentas
de desenvolvimento; a saída estática é a opção prevista para hospedagem do site.

## Onde editar

| Arquivo | Uso |
| --- | --- |
| `index.html` | Cópia independente, pronta para abrir por duplo clique |
| `public/index.html` | Estrutura e conteúdo inicial da página |
| `public/styles.css` | Cores, tipografia, temas e layout responsivo |
| `public/app.js` | Interações no navegador e leitura do JSON |
| `public/data/site.json` | Conteúdo editável dos componentes dinâmicos |
| `scripts/server.mjs` | Servidor Node e rota de diagnóstico |
| `server/DevServer.java` | Servidor alternativo em Java |
| `tests/server.test.mjs` | Testes HTTP dos dois servidores |

JavaScript é a linguagem executada no navegador. Java é uma linguagem diferente,
usada aqui como alternativa para servir os mesmos arquivos. Não é preciso
manter ambos os servidores ligados.

## Verificações

```sh
npm run check
npm test
npm run test:java
npm run build
```

`check` verifica a sintaxe JavaScript. Os testes HTTP iniciam um servidor em
porta temporária e verificam HTML, CSS, JavaScript, JSON, métodos HTTP, arquivos
inexistentes e proteção contra leitura de arquivos fora de `public/`. O comando
`test:java` exige o JDK e executa os mesmos testes usando o servidor Java.

Enquanto um servidor estiver ligado, `GET /api/health` retorna um JSON com
`status: "ok"`, o projeto e o runtime em uso. A página também precisa entregar
seu conteúdo e carregar `data/site.json`; uma porta aberta sozinha não valida
o funcionamento do projeto.

## Preparar a publicação

`npm run build` gera `dist/` com os arquivos estáticos e um `index.html`
independente, com estilos, scripts e dados embutidos. O comando pode ser
repetido e substitui somente a saída gerada. Essa pasta pode ser enviada a uma
hospedagem estática, como GitHub Pages. Não é necessário hospedar Node ou Java
para a página funcionar. Os caminhos dos recursos são relativos, permitindo
hospedagem em uma subpasta. Para atualizar também a cópia `index.html` na raiz,
use `npm run export`; esse comando substitui a cópia gerada, então edite os fontes
em `public/` e não o HTML independente.

A rota `/api/health` pertence aos servidores locais e não existe na publicação
estática; a página não depende dela. O build prepara os arquivos, mas não os
publica e não envia alterações ao GitHub.

## Ambiente na nuvem

O checkout esperado neste ambiente é `/workspace/armazemacae`. Use o checkout
existente: cada tarefa já é isolada, portanto não crie um Git worktree sem pedido
explícito. Os arquivos e as dependências podem fazer parte do snapshot do
ambiente; os processos precisam ser iniciados novamente em cada sessão.

Nenhum segredo deve ser salvo no código ou no JSON público. As instruções de
instalação e inicialização do ambiente são salvas separadamente nas configurações
para revisão. Publicar o ambiente e publicar o site são ações diferentes.
