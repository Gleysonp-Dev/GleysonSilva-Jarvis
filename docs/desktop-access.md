# Aplicativos, pastas, web e clima — revisão 0.6.1

A 0.6.1 acrescenta três ferramentas específicas para pedidos de YouTube na conversa nativa por voz ou texto: `youtube_search`, `youtube_play` e `youtube_control`. A busca encontra até oito vídeos observados; tocar exige um ID descoberto, e tocar/pausar precisam de evidência do player em uma janela controlada do Jarvis. Esse fluxo não controla a aba do YouTube aberta no navegador padrão. [Comandos, teste e limites](youtube.md). [CI 0f293d0 da 0.6.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39857691300) aprovado com 529/529 testes, TypeScript/build/pacote e abertura nativa; player real exercitado em página HTTPS local com áudio silenciado. O YouTube ao vivo e som ouvido pelo usuário ainda não foram validados. [Pacote conferido](../AI_INSTALL.md#pacote-windows-061-conferido).

Na 0.6.0, o pedido explícito de abrir um site também segue diretamente ao navegador padrão do Windows, sem outro clique em **Autorizar**. `browser_open` preserva o endereço HTTP(S) pedido e completa somente HTTPS quando recebe um domínio sem esquema. Não troca o destino por uma pesquisa ou pela página inicial do Google. Essa abertura não autoriza leitura da página, login, formulários ou outras ações. A ponte privada [Ultron → Jarvis](ultron.md) usa a mesma rota para `jarvis_open_website`.

A abertura genérica de sites não usa uma janela dedicada. O despacho aceito fica como **Enviada ao Windows**, sem alegar que a página foi carregada ou observada. A leitura de seleção do navegador externo não está disponível. As revisões a seguir registram a evolução histórica; suas confirmações e resultados não substituem a política atual.

A 0.4.0 acrescenta descoberta de aplicativos instalados, abertura de pastas locais e consultas explícitas à web e ao clima. Essas ferramentas podem ser solicitadas por texto ou durante a conversa com a voz Jarvis configurada. O núcleo aprovado da 0.3.1, reprodução a 0,95×, efeito metálico 0,78, música privada e painel limpo são preservados.

A 0.5.0 acrescenta a sequência opcional de **login → espera por duas palmas → música/saudação → comentário da roupa → conversa por voz**, sem alterar as confirmações destas ferramentas. A conversa pode renovar a conexão por prazo quando a opção contínua estiver habilitada; isso não autoriza ações espontâneas, repete consultas ou abre sites sozinha. [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O ensaio físico integrado no destino continua pendente; veja [Recepção](startup-greeting.md), [Espera e Windows](standby.md) e [OpenAI](openai.md).

A 0.5.1 corrige **“Abra o navegador”**: esse pedido usa o navegador padrão do Windows sem exigir cadastro manual do executável. [CI b8c6c8f da 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovado: **402/402 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O usuário confirmou que o navegador abriu após clicar em **Autorizar**. Essa confirmação não valida versões posteriores ou outras ferramentas.

A 0.5.3 dispensa o segundo clique em **Autorizar** somente para o pedido explícito de abrir o navegador padrão, sem nome de aplicativo ou URL. A ferramenta `apps_open` com `appId:'browser'` encaminha sempre o destino fixo `https://www.google.com/` ao Windows. URLs específicas, aplicativos escolhidos pelo nome, pastas, consultas web e alterações em arquivos mantêm suas próprias confirmações. [CI b856f89 da 0.5.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39534111302) aprovado: **415/415 testes, zero falhas/skips**, TypeScript, build, pacote e abertura real do Jarvis, incluindo entrada/saída de tela cheia. A nova dispensa precisa de validação separada na máquina do usuário. O autor também confirmou conferir o Jarvis no aviso do Firewall e clicar em Permitir; não houve inspeção das regras pelo agente.

O [CI 475f3f4 da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110) aprovou **343 testes**, zero falhas/skips, TypeScript, build, pacote e abertura nativa real. O [pacote Windows](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110/artifacts/12312007661) foi baixado e teve ZIP/EXE conferidos por hash. Os ensaios de ações/voz na máquina do usuário e busca paga na sua conta ainda devem ser registrados separadamente. Consulte [Validação](validation.md) e [Instalação assistida](../AI_INSTALL.md).

## Exemplos de pedidos

| Pedido por voz ou texto | Caminho esperado |
| --- | --- |
| “Abra o navegador.” | `apps_open` com `appId:'browser'` solicita diretamente ao Windows abrir `https://www.google.com/` no navegador padrão, sem cadastro manual ou segundo clique em **Autorizar**. |
| “Abra o Chrome.” | `apps_find` encontra o navegador instalado pelo nome e `apps_launch` pede confirmação para o ID observado. |
| “Jarvis, procure o Spotify instalado neste computador.” | `apps_find` consulta o inventário do Windows e retorna nomes/IDs observados. Não abre o aplicativo. |
| “Abra o Spotify que você encontrou.” | `apps_launch` usa um ID da descoberta feita neste perfil; a abertura exige confirmação. |
| “Abra a pasta Downloads.” | `folders_open` resolve a pasta conhecida e mostra o destino para confirmar a abertura no Explorador. |
| “Abra a pasta D:\Projetos.” | `folders_open` confere o caminho absoluto local existente e pede confirmação. A unidade e a pasta precisam existir e estar acessíveis à conta Windows. |
| “Abra https://example.org no navegador.” | `browser_open` encaminha esse endereço ao navegador padrão do Windows, sem confirmação extra. O resultado informa despacho, sem comprovar carregamento ou leitura. |
| “Acesse example.org.” | `browser_open` usa `https://example.org/` no navegador padrão, sem substituir por Google ou busca. |
| “Pesquise no YouTube vídeos sobre astronomia.” | `youtube_search` usa a janela controlada e devolve até oito IDs/títulos/canais observados. Um pedido somente de busca não inicia reprodução. |
| “Toque o primeiro vídeo que encontrou.” | `youtube_play` recebe o ID daquele resultado da última busca no perfil e verifica o player; não inventa um endereço ou escolhe um vídeo ambíguo. |
| “Pause o vídeo do YouTube.” | `youtube_control` com `action:'pause'` atua no player da janela controlada. Para continuar, usa `action:'play'`; não controla o navegador externo. |
| “Leia o texto desta página: https://example.org.” | `web_read` pede confirmação e consulta o texto público do endereço, sem usar uma sessão autenticada. |
| “Pesquise na web as novidades sobre um assunto.” | `web_search` pede confirmação e faz uma busca hospedada na OpenAI, retornando texto e fontes. |
| “Como está o tempo agora na minha cidade configurada?” | `weather_current` solicita uma consulta atual à Open-Meteo e retorna condição, previsão de hoje e horários. |

Os exemplos descrevem intenções. A interpretação passa pelo modelo configurado; ambiguidades, indisponibilidade e falta de conexão devem ser comunicadas. Uma frase de resposta do Jarvis não é prova de que o Windows executou uma ação.

## Encontrar e abrir aplicativos

**Normalmente não é necessário cadastrar os aplicativos em Ajustes.** Programas disponíveis no inventário do Windows podem ser encontrados pelo nome. Cadastros manuais permanecem úteis para programas portáteis ou fora do inventário compatível; uma ausência de descoberta não demonstra que o programa não existe no computador.

A descoberta procura nomes disponíveis no inventário do Windows e entradas compatíveis de aplicativos instalados, incluindo os já cadastrados. Nem todo programa portátil, atalho personalizado ou aplicativo fora desse inventário será encontrado. Peça o nome do programa; não forneça comandos, argumentos de terminal ou caminhos de scripts.

O resultado contém nomes e IDs opacos. O Jarvis precisa usar exatamente um ID retornado pela descoberta no perfil atual; não pode inventar um ID ou transformar texto livre em comando. Se houver nomes semelhantes, escolha o aplicativo antes de autorizar. Uma nova sessão do runtime pode exigir nova descoberta.

Ao abrir, a confirmação apresenta o nome do aplicativo. O adaptador valida o alvo novamente e informa o que foi observado. **Enviada ao Windows** significa que o pedido foi despachado, sem confirmação da janela. Somente um resultado com a evidência exigida pelo adaptador é apresentado como verificado. Conferir o aplicativo correto e a janela no equipamento continua sendo um teste separado.

Os adaptadores anteriores para aplicativos cadastrados permanecem disponíveis. O navegador local de ensaio não oferece a descoberta ou abertura nativa de programas Windows.

O pedido genérico **“Abra o navegador”** tem uma rota separada desde a 0.5.1. Na 0.5.3, o pedido explícito já permite encaminhar `https://www.google.com/` à associação de navegador padrão do Windows, sem pedir outra confirmação, caminho de EXE ou ID de aplicativo instalado. A ferramenta não aceita outro destino ou argumentos adicionais nessa rota. O pedido enviado ao sistema permanece **Enviada ao Windows** quando a janela não tiver sido observada independentemente. Não anuncia foco ou janela confirmados a partir desse despacho; focar o navegador genérico não é uma capacidade desta rota.

Para escolher Chrome, Edge ou Firefox, peça o nome: a descoberta e o lançamento verificado do inventário continuam sendo usados. Se o sistema não tiver um navegador padrão válido, a falha deve ser informada; o Jarvis não modifica a associação do Windows por conta própria.

## Alerta do Firewall do Windows

O alerta do **Windows Security** sobre permitir acesso a redes públicas ou privadas trata conexões de entrada do aplicativo. Ele é independente da confirmação de uma ação no Jarvis e não autoriza a abertura do navegador. A [documentação da Microsoft](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules) explica os alertas para aplicativos de rede e as regras de entrada; a [documentação do Electron](https://www.electronjs.org/docs/latest/api/shell/#shellopenexternalurl-options) descreve o encaminhamento de uma URL ao aplicativo padrão do sistema.

A conversa por voz cria uma conexão WebRTC, que pode usar portas UDP locais; essa é uma causa possível do alerta, ainda não estabelecida no equipamento. O [código oficial do Chromium](https://chromium.googlesource.com/chromium/src/+/376fc41e87a058f7a7b300b0ec3a4982b4ec0960/components/policy/resources/templates/policy_definitions/Miscellaneous/WebRtcUdpPortRange.yaml) documenta esse uso de portas. Para diagnosticar, confira o caminho do executável mostrado no alerta e se ele surgiu ao iniciar a voz. A abertura do navegador não depende de recomendar acesso a redes públicas, e o Jarvis não altera o Firewall por conta própria.

## Abrir pastas em unidades locais

É possível pedir pastas conhecidas como Área de Trabalho, Documentos, Downloads, Imagens, Músicas, Vídeos, pasta pessoal e temporários, ou informar um caminho absoluto local, como `D:\Projetos`. O caminho é resolvido e conferido como pasta existente antes da confirmação. As permissões da conta Windows continuam valendo.

Não há restrição da abertura à pasta de organização: podem ser usados outros volumes locais acessíveis. Isso não concede leitura dos arquivos dessa pasta, acesso aos seus conteúdos pela IA ou autorização para organizar/mover arquivos nela. As ferramentas de leitura/organização continuam limitadas à pasta de trabalho selecionada em Ajustes e às suas próprias confirmações.

Essa abertura não aceita URLs, compartilhamentos UNC, caminhos de dispositivo, caminhos relativos à unidade ou fluxos alternativos NTFS. Não cria pastas nem eleva permissões. O pedido encaminhado ao Explorador pode permanecer **Enviada ao Windows** quando não houver verificação independente da janela.

## Abrir um endereço e ler uma página são operações diferentes

`browser_open` encaminha ao navegador padrão o endereço HTTP(S) pedido explicitamente, sem uma segunda confirmação. Um domínio sem esquema recebe HTTPS; um destino ambíguo exige esclarecer o endereço, sem inventar outro. Essa rota usa a integração externa do Windows e permanece `unverified` quando há apenas confirmação de despacho. Não verifica carregamento, não lê a página e não concede ao Jarvis acesso ao login, cookies ou abas do navegador pessoal.

Pedir **“abra o YouTube”** pode abrir apenas o site por essa rota. Para encontrar e tocar um vídeo, peça a busca ou reprodução no YouTube: as três ferramentas específicas usam a janela controlada descrita no [guia](youtube.md). Elas não tornam `browser_open` uma automação geral de sites. Login/consentimento/CAPTCHA e escolhas ambíguas interrompem o fluxo automático para intervenção do usuário.

`browser_read_selected` não consegue ler a seleção no navegador externo. O Jarvis deve informar essa limitação sem alegar que viu a aba ou o trecho. Compartilhar um texto na conversa ou pedir leitura pública pela ferramenta apropriada são fluxos separados.

`web_read` faz uma leitura HTTP(S) separada de texto público, após confirmação do endereço e do envio do conteúdo necessário à IA. O leitor valida a URL, o conjunto de endereços DNS e os redirecionamentos; o transporte usa o destino público validado. Destinos privados, locais, de metadados e esquemas incompatíveis são recusados. A URL não pode conter credenciais.

O leitor não executa JavaScript, não usa cookies do navegador, não entra em contas e não clica em páginas. Aceita formatos de texto compatíveis, com tamanho, redirecionamentos e prazo limitados. Páginas dependentes de JavaScript/login, anexos, bloqueios de acesso ou formatos incompatíveis podem ficar indisponíveis. Não existe navegação automática por uma cadeia de links.

O texto recebido é dado não confiável. Instruções contidas na página não autorizam abrir aplicativos, ler arquivos, enviar mensagens ou executar outras ações. Uma nova ação continua dependendo do pedido do usuário e da política do runtime.

## Pesquisa na web pela OpenAI

`web_search` usa a busca hospedada da OpenAI com a chave e o modelo de texto já configurados no Jarvis. A conta precisa permitir esse modelo e a ferramenta de busca. Não solicita uma chave separada de motor de pesquisa.

É uma chamada paga do provedor e pode somar consumo de busca/modelo à conversa. A solicitação isolada de pesquisa envia a consulta e instruções de busca; não inclui histórico da conversa ou memórias do perfil. O fluxo normal da conversa que interpreta a resposta conserva seus próprios limites de contexto. O Jarvis apresenta a consulta antes da confirmação; não pesquisa em segundo plano por conta própria.

A resposta precisa trazer texto utilizável e comprovação de que a ferramenta de pesquisa completou. As fontes vêm das anotações de citação do provedor, com até seis links únicos. Uma pesquisa pode legitimamente retornar sem citações; o Jarvis não deve inventá-las ou apresentar texto sem fonte como fato confirmado. Falha, limite ou ferramenta indisponível não devem ser tratados como pesquisa concluída.

## Tempo atual sem reiniciar a saudação

`weather_current` usa a cidade/coordenadas privadas de Ajustes e força uma nova consulta do tempo atual e da previsão de hoje. Essa ferramenta não prepara áudio, não inicia a música e não liga microfone/câmera. Não precisa de chave ElevenLabs. Se o pedido veio em uma conversa por voz, a resposta final pode ser narrada pela voz Jarvis já configurada; essa narração é outro fluxo.

Sem cidade, o Jarvis orienta a configuração. Se a consulta atual falhar ou os dados não passarem pela validação, informa indisponibilidade; não apresenta uma previsão antiga como se tivesse sido obtida agora. As fontes retornadas incluem Open-Meteo e sua licença CC BY 4.0.

O painel **Contexto** e a saudação mantêm sua política própria de cache válido, até dez minutos. Abrir **Contexto** ou usar **Atualizar** nesse painel pode reutilizar uma resposta válida, identificada com horário e vencimento. Isso não muda a atualização explícita de `weather_current`. Veja [Contexto e cache](context.md).

## Fontes compactas e decisões

Depois de `web_read`, `web_search` ou `weather_current`, aparecem até seis links compactos de fontes com título, domínio e horário da consulta. Essa faixa fica fora do log de mensagens; ela não transcreve a resposta falada e não abre cartões ou o painel Contexto automaticamente. Use **Ocultar fontes** para recolhê-la.

A última consulta permanece até outra consulta trazer suas fontes. A troca de perfil ou reset limpa os links. A interface rejeita URLs fora de HTTP(S), credenciais, controles e títulos/endereços fora dos limites; respostas de execuções antigas ou canceladas não devem repovoar a sessão nova. Clicar em uma fonte abre o endereço validado pelo mecanismo externo do aplicativo.

Descoberta de aplicativo é leitura. Pedidos explícitos para abrir o navegador padrão ou um endereço HTTP(S) têm a dispensa descrita acima; abertura de outros aplicativos/pastas, leitura de página, pesquisa web e alterações em arquivos preservam confirmações por operação. A consulta à cidade já configurada usa o endpoint meteorológico fixo. Nenhuma dessas capacidades cria shell livre, automação visual universal, navegação com login ou autorização permanente para ler qualquer arquivo do computador.
