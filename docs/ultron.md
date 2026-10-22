# Integração privada Ultron → Jarvis — 0.6.0

Esta ponte permite que um agente autorizado use cinco ferramentas do Jarvis aberto no Windows. O Ultron continua sendo o Dot pessoal no ChatGPT; o Jarvis conserva sua interface e a voz já configurada. A ponte começa desligada e não envia mensagens ao Ultron. O [CI 0.6.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109) aprovou 491/491 testes, TypeScript, build, pacote e abertura nativa do Jarvis. Windows e plugin foram baixados e conferidos. O plugin privado foi instalado e habilitado pela CLI oficial. Após o usuário ativar a conexão na interface, cinco ferramentas MCP reais ficaram disponíveis nesta conversa no turno seguinte, sem reiniciar o host. O status confirmou conexão com o Jarvis 0.6.0 e cidade/voz configuradas. Um pedido de abrir o site solicitado retornou despacho `unverified`; isso não comprovou a janela. O Dot pessoal Ultron não foi chamado; clima e voz ao vivo pela ponte permanecem pendentes.

Não foi encontrado um endpoint oficial documentado para um aplicativo externo conversar com um Dot pessoal existente preservando sua identidade e memória. A documentação descreve [canais de mensagens](https://learn.chatgpt.com/docs/dots/channels) e a possibilidade de o Dot usar [plugins e um computador conectado](https://learn.chatgpt.com/docs/dots/computers-and-apps). Este projeto usa essa segunda direção de integração.

## O que está incluído

| Ferramenta | Entrada | Efeito |
| --- | --- | --- |
| `jarvis_status` | `{}` | Estado limitado da ponte e disponibilidade do Jarvis. |
| `jarvis_weather` | `{}` | Consulta atual para a cidade privada já configurada. |
| `jarvis_open_browser` | `{}` | Encaminha a URL fixa `https://www.google.com/` ao navegador padrão do Windows. |
| `jarvis_open_website` | `{ "url": "example.org" }` | Abre o domínio ou endereço HTTP(S) pedido no navegador padrão; completa HTTPS quando não há esquema. |
| `jarvis_speak` | `{ "text": "texto solicitado" }` | Solicita narração de até 600 caracteres com a voz Jarvis configurada. |

Para “abra este site”, use `jarvis_open_website` com o endereço pedido. Essa operação não deve trocar o destino pelo Google nem fazer uma pesquisa. `jarvis_open_browser` continua sendo apenas a abertura genérica no Google. Nenhuma das duas ferramentas lê a página, fornece cookies ao agente ou controla formulários e logins. O retorno distingue despacho ao Windows de confirmação independente da janela.

Não há ferramenta para receber comandos de voz e enviá-los ao Dot, ler suas memórias, obter chaves, ligar microfone, capturar câmera ou executar comandos livres. A instalação do plugin não habilita a ponte no Jarvis. As operações continuam sujeitas ao estado do aplicativo e às permissões do cliente que chama o MCP.

O servidor MCP usa STDIO e se conecta a um named pipe privado do usuário Windows. O arquivo de descoberta fica em `%APPDATA%\Projeto GleysonSilva-Jarvis\ultron-bridge.json`; ele não pertence ao plugin, não deve ser enviado a uma conversa e não deve entrar no GitHub. A ponte não exige abrir uma porta TCP para a rede ou mudar o Firewall. Chaves dos provedores permanecem no armazenamento do Jarvis.

## Pacote local

```text
plugins/jarvis-ultron/
  plugin.json
  mcp.json
  server.mjs
  bridge.mjs
  skills/jarvis/SKILL.md
```

O manifesto portátil identifica o plugin; `mcp.json` inicia `node` com `${PLUGIN_ROOT}/server.mjs`. `requires_local_executor: true` marca a necessidade de execução local. Essa estrutura e a distribuição por marketplace privado seguem [Package your plugin](https://developers.openai.com/plugins/build/plugins) e a configuração local de [plugins para desktop](https://developers.openai.com/plugins/deploy/desktop-only).

É necessário Windows, Node.js 24 disponível para o processo do ChatGPT e uma versão do Jarvis que inclua a ponte. O pacote não instala Node, não instala um segundo Jarvis e não copia arquivos privados. Se `node` não for encontrado pelo aplicativo, selecione o executável Node instalado no computador na cópia privada da configuração; não use um caminho de outro usuário. Neste computador de desenvolvimento, o executável foi localizado em `C:\Program Files\nodejs\node.exe`.

## Plano de instalação privada

Os passos abaixo permitem reproduzir a instalação em outro ambiente. A instalação local já conferida não comprova que as ferramentas foram carregadas em uma nova conversa ou que o Ultron já as utilizou.

1. Concluir a revisão do servidor e da ponte e validar as cinco ferramentas em uma sessão local de teste. Não incluir o arquivo privado de descoberta no pacote.
2. Colocar o pacote completo sob `plugins/jarvis-ultron/` de um diretório de marketplace local e criar `.agents/plugins/marketplace.json` nesse diretório. O exemplo abaixo torna o pacote disponível sem instalá-lo automaticamente.
3. Registrar o diretório por `codex plugin marketplace add <diretorio-do-marketplace>` ou abrir esse projeto no cliente local que reconhece seu marketplace. Reiniciar o aplicativo quando solicitado, abrir **Plugins**, escolher **Jarvis privado**, revisar **Jarvis · Ultron** e instalar. A ajuda da CLI instalada também oferece `codex plugin add jarvis-ultron@jarvis-private`; este comando realiza uma instalação, não uma verificação.
4. Abrir uma conversa nova no ChatGPT desktop/Codex local e conferir se as cinco ferramentas aparecem. Fazer primeiro uma consulta de estado, ainda com a ponte desligada, e verificar uma resposta honesta de indisponibilidade. Depois abrir **Ajustes → Conexão privada com Ultron**, marcar **Permitir que Ultron use o Jarvis neste computador**, salvar e testar cada operação solicitada. O teste no navegador não oferece essa opção nativa.
5. Para usar com o Dot, conectar esse computador pelo perfil do Ultron e validar uma tarefa que execute localmente. Só considerar a integração com o Dot concluída depois de uma chamada real dele, com resultado observado.

Exemplo de catálogo, relativo à raiz do marketplace:

```json
{
  "name": "jarvis-private",
  "interface": { "displayName": "Jarvis privado" },
  "plugins": [
    {
      "name": "jarvis-ultron",
      "source": { "source": "local", "path": "./plugins/jarvis-ultron" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

O catálogo não concede acesso ao computador. A instalação altera o cache e as preferências privadas do cliente; este procedimento não exige editar `.codex/config.toml` manualmente nem publicar o plugin no diretório público. Atualizações devem atingir o pacote completo que o marketplace referencia; valide a cópia instalada, pois o cliente pode usar uma cópia em cache.

## Limites do Dot e da execução na nuvem

Um MCP por STDIO precisa rodar no mesmo computador Windows do Jarvis. Um processo em um contêiner na nuvem não encontra o named pipe local. A documentação marca plugins locais como **Desktop only**, usados em tarefas locais; ela não comprova que toda conversa principal de um Dot carregará um marketplace privado. Não trate a instalação local como confirmação desse acesso.

O Dot pode criar tarefas locais no computador conectado, mas o PC precisa estar online com o ChatGPT aberto na conta correta. Sua autorização ao computador é separada da conexão com Codex. Veja [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps) e [Local computer access for Work Cloud and dots](https://learn.chatgpt.com/docs/enterprise/cloud-local-access). A disponibilidade das ferramentas na tarefa do Ultron deve ser verificada no aplicativo e pode depender da conta e da superfície usada.

Não existe fallback por cookies, automação de login, envio a um canal de mensagens, túnel público ou cópia de credenciais. Se o Dot não receber essas ferramentas em uma tarefa local suportada, a ponte continua útil nas conversas locais compatíveis, e a ligação específica com o Dot permanece não validada.

## Validação e desligamento

Verificação no [CI 2adf71d](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109): **491/491 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa do Jarvis. O ensaio local separado teve 480 aprovados e 11 falhas EPERM conhecidas de links/junções no sandbox. A instalação privada, o handshake, o status conectado e o despacho de navegação foram confirmados em etapas separadas. Eles não comprovam uma resposta do Dot pessoal, clima consultado ou som ouvido pela ponte. Veja [registro de validação](validation.md) e [pacotes/hashes](../AI_INSTALL.md#pacotes-060-conferidos).

Na máquina de validação, a ativação foi realizada pelo usuário na interface do Jarvis 0.6.0, após o ambiente recusar escrita direta no diretório privado. `jarvis_status` real retornou `connected: true`, `appVersion: "0.6.0"`, `weatherConfigured: true` e `voiceConfigured: true`, com cinco ferramentas disponíveis neste chat. `jarvis_open_website` real retornou `ok: true` e `status: "unverified"` para o site solicitado; houve despacho, sem confirmação da janela. Esses testes não consultaram clima, não reproduziram voz e não enviaram mensagens ao Dot pessoal.

Uma tentativa real de `jarvis_speak` com uma frase curta retornou **BUSY**, sem confirmação de reprodução. Não houve nova tentativa nem interrupção da conversa/recepção existentes. O áudio efetivamente ouvido pela ponte e o teste feito pelo próprio Dot permanecem pendentes.

Registrar separadamente: manifesto/configuração legíveis; handshake MCP e lista exata das cinco ferramentas; ponte desligada e Jarvis fechado; pedido de estado e clima; uma abertura genérica de navegador; um site exato, com e sem HTTPS explícito; reprodução observada de uma frase autorizada; interrupção ou aplicativo ocupado; teste feito pelo próprio Ultron. Testes simulados do protocolo não comprovam som ouvido ou uso pelo Dot.

A narração só começa se o Jarvis estiver livre. Voz, recepção, teste de microfone e tarefa digitada ativos devem produzir estado ocupado antes de chamar a síntese. O áudio usa a voz ElevenLabs configurada, reprodução a 0,95× com altura preservada e efeito fixo 0,78, sem música, transcrição ou nova captura. A confirmação técnica de reprodução depende do evento de fim do áudio no renderer; ela não comprova que a pessoa ouviu. **Interromper**, cancelamento, troca de configuração/perfil e fechamento descartam síntese ou áudio atrasados.

Para interromper o acesso, desabilite a ponte no Jarvis ou feche o aplicativo. Para retirar o plugin, use a remoção na mesma interface onde ele foi instalado. Não apague as configurações privadas do Jarvis para desinstalar o plugin. A versão da ponte não altera a voz, o efeito metálico, a cidade, as palmas ou a saudação aprovados.
