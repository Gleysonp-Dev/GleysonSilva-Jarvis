# Projeto GleysonSilva-Jarvis: validação e critérios de lançamento

## Revisão 0.7.0 — Fire TV

O código acrescenta duas ferramentas, seis aplicativos conhecidos e doze ações fixas. [CI 0.7.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39898026057) aprovado com **641/641 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa; [Windows conferido](../AI_INSTALL.md#pacote-windows-070-conferido). A suíte local separada teve 630 aprovados e 11 falhas EPERM anteriores. O cenário YouTube do CI usa HTTPS local e áudio silenciado, sem TV física. **Em 23 de outubro de 2026, o usuário confirmou pareamento pela interface e a sequência Início da TV → abrir Netflix por voz no aplicativo 0.7.0.** Esse aceite humano vale para essa TV; as ferramentas continuam retornando `unverified`. O ensaio isolado anterior de identificação/Netflix/OK permanece separado. Persistência após reinício, outros aplicativos/controles e firmwares seguem pendentes; seleção automática de perfil pelo nome não está implementada/aprovada. [Evidência e limites](validation.md#revisão-070--fire-tv-em-validação) e [guia](fire-tv.md).

| Cenário | Critério de aceite |
| --- | --- |
| Configuração nova | Desabilitada por padrão; só IPv4 privado, porta fixa; IP salvo localmente, sem descoberta ou acesso a chaves globais. |
| Pareamento explícito | Botão Parear TV, aprovação humana na televisão; nenhuma operação normal oferece chave pública. Recusa/timeout/cancelamento não ficam pareados. |
| Persistência após reinício — pendente | Fechar/reabrir o aplicativo e reiniciar a central de teste; verificar pareamento e comando autorizado sem expor a chave. O aceite da sessão atual não comprova esse cenário. |
| Testar conexão | Consultas fixas de identificação, três streams concluídas; duplicatas antigas exatas limitadas não quebram a próxima stream; pacotes inválidos continuam recusados. |
| Abrir Netflix por voz | Sair manualmente da Netflix, pedir “Jarvis, abra a Netflix”, observar ferramenta e uma solicitação de abertura de pacote realmente instalado; confirmar a tela com o usuário. |
| Aplicativo ausente | Falha sem abrir outro aplicativo, instalar, ir à loja ou anunciar sucesso. Outros cinco IDs só são aprovados após ensaio próprio. |
| Resultado incerto | Narração diz comando enviado; timeout/EOF não provocam repetição automática e não confirmam tela ou som. |
| Cancelamento e perfil | Interromper, fechar/trocar configuração cancelam operações pendentes; nenhuma ação da fila começa com perfil/IP diferente. Efeito já entregue não é desfeito. |
| Integração preservada | Voz configurada, música, espera, YouTube do computador e tela limpa preservados; identificação da pessoa pela voz continua adiada. |

## Revisão 0.6.5 — cartões modernos e passagem da busca à reprodução

O reteste real **0.6.4 foi reprovado**: os resultados apareceram, mas não tocou e a janela permaneceu na lista. A leitura local limitada e autorizada confirmou expiração de `youtube_search` em 15 segundos, sem `youtube_play` naquela tentativa. Não confundir esse resultado com teste de player ou atribuí-lo a anúncio/VAD. Verificação local final 0.6.5: **576 testes, 565 aprovados, somente as 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **69/69**, VAD **30/30**. [CI 2aa1ce4 da 0.6.5](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39880425806) aprovado: **576/576 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. A fixture de cartões modernos com título/canal observado, clique gerenciado por JavaScript e `/watch` → nova busca → segundo vídeo foi executada em HTTPS local com mídia PCM e áudio silenciado; não comprova o YouTube real ou som ouvido. **Teste real 0.6.5 confirmado pelo usuário: o pedido de Thunderstruck/AC/DC buscou, abriu o vídeo e tocou com som.** Esse aceite vale para essa sequência; anúncios, pausa/retomada, outros dispositivos e início no login do Windows continuam sem validação completa. Os retestes reais 0.6.3 e 0.6.4 permanecem reprovados no histórico. Os 568/568 e hashes 0.6.4 abaixo são históricos. [YouTube](youtube.md) e [Validação](validation.md).

A fixture nova, executada no CI, usa cartões modernos com título e canal visíveis do mesmo cartão, link de canal observado e marcador de publicidade descendente. Exercitar também cartões legados, ordem mista, consulta correspondente, até oito IDs únicos de 11 caracteres, canal ausente/inválido, título/canal ocultos ou de outro cartão e exclusão de anúncios por ancestral e descendente. Não inventar canal para completar resultados. Preservar o clique único na lupa moderna, `/watch` → nova busca → segundo vídeo, cancelamento, perfil e a mídia existente. O [pacote 0.6.5 foi conferido](../AI_INSTALL.md#pacote-windows-065-conferido); o usuário confirmou depois busca→abertura do vídeo→som no pedido Thunderstruck/AC/DC. Ainda executar os demais cenários no YouTube real, separando lista, `youtube_play`, progresso observado e som ouvido.

## Base anterior 0.6.4 — busca com interface dinâmica

Verificação local 0.6.4: **568 testes, 557 aprovados, 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **61/61**, VAD **30/30**. [CI 8c40a15 da 0.6.4](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39878604368) aprovado: **568/568 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. [Windows conferido](../AI_INSTALL.md#pacote-windows-064-conferido). **Reteste real 0.6.4 reprovado: lista visível, busca expirada antes de tocar; reteste físico 0.6.3 também reprovado.** O ensaio nativo do formulário/botão gerenciados por JavaScript foi executado no CI, incluindo nova busca de /watch e segundo vídeo, em HTTPS local com mídia PCM e áudio silenciado. O reteste real 0.6.3 foi **reprovado**: consulta preenchida/autocomplete na página inicial, sem resultados e sem tocar. O cenário controlado de formulário sem navegação e botão moderno funcional é compatível com a imagem, sem estabelecer anúncio ou VAD como causa física. A prova 558/558 e a fixture GET da 0.6.3 abaixo são históricas. [YouTube](youtube.md) e [Validação](validation.md).

Validar primeiro a fixture com submit padrão impedido e navegação pelo botão moderno. Conferir um clique efetivo, consulta correta, URL/lista realmente observadas, ausência de URLs fabricadas e de repetição automática. Preservar nova busca a partir de `/watch` e reprodução do segundo vídeo. Depois, repetir o roteiro no site real e ouvir o áudio; testes locais não substituem esse aceite.

## Revisão 0.6.3 — recuperação e fala durante ferramentas

Verificação local: **558 testes, 547 aprovados, 11 falhas EPERM conhecidas de links/junções no sandbox, zero skips**; TypeScript/build aprovados. Realtime **30/30** e controlador/runtime/fábrica YouTube **51/51**. [CI 49f9872 da 0.6.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39876444758) aprovado: **558/558 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. [Windows conferido](../AI_INSTALL.md#pacote-windows-063-conferido). **O reteste real do YouTube 0.6.3 foi reprovado.** A imagem mostra consulta/autocomplete na página inicial, sem resultados e sem tocar. O cenário nativo GET não cobria o envio real da aplicação dinâmica; a causa física não foi atribuída a VAD. A fixture nativa de `/watch`→nova busca→segundo vídeo foi executada no CI em HTTPS local com mídia PCM e áudio silenciado; não foi um ensaio do site ao vivo ou de som ouvido no computador do usuário. As contagens 0.6.2 abaixo são históricas.

No relato 0.6.2, vídeo/anúncio não tocou e depois não houve novo acesso. O journal limitado mostrou buscas canceladas, sem `youtube_play` nesses trechos; origem do cancelamento, estado de anúncio e relação com VAD não foram determinados. Os testes de código não devem ser apresentados como diagnóstico causal da máquina. [Registro](validation.md).

A revisão histórica **0.6.2** retira comentário de roupa e captura automática da recepção, migra a preferência antiga para `false` e preserva a câmera manual em Presença. Rever também anúncios, vídeo oculto, referência inicial de progresso e expiração da tentativa no YouTube: anúncio termina naturalmente, timeout mantém janela, cancelamento/perfil interrompem. CI e pacote 0.6.2 aprovados; prova e verificação local em [Validação](validation.md). Naquela revisão histórica 0.6.2, o novo ensaio ao vivo estava pendente. Na 0.6.1, o usuário confirmou pesquisa e relatou que o vídeo não tocou; causa indeterminada. O [CI 0f293d0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39857691300) e os **529/529 testes** são históricos, com player em HTTPS local e áudio silenciado. [YouTube](youtube.md) e [validação](validation.md).

A 0.6.0 prepara a ponte privada Ultron → Jarvis local com cinco ferramentas MCP. Validar protocolo, permissão local explícita, acesso em tarefa compatível e resultados físicos separadamente. Verificação local: 491 testes, 480 aprovados, 11 falhas EPERM conhecidas de links/junções no sandbox e zero skips; TypeScript/build aprovados. O plugin privado foi instalado e habilitado pela CLI oficial, com listagem conferida. O [CI 2adf71d](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39852875109) aprovou 491/491 testes, zero falhas/skips, TypeScript/build/pacote e abertura nativa do Jarvis; Windows e plugin foram baixados e conferidos. Handshake MCP instalado 0.6.0 e recusa inicial NOT_RUNNING foram verificados. Após o usuário ativar a conexão na interface, cinco ferramentas ficaram disponíveis nesta conversa e o status real confirmou `connected: true`, versão 0.6.0 e cidade/voz configuradas. A chamada real de abertura do site solicitado retornou despacho `unverified`, sem comprovar a janela. Clima e voz ao vivo pela ponte e teste pelo próprio Dot permanecem pendentes; o Dot pessoal não foi chamado. [Fluxo e limites](ultron.md).

A 0.5.3 dispensa somente a segunda confirmação de `apps_open/browser`. Testar pedido explícito de navegador padrão, zero cartões de autorização, despacho único e cancelamento antes/durante a fila. URLs específicas e outros aplicativos devem continuar aguardando a decisão. O autor confirmou abertura após clicar em Autorizar na versão anterior; isso não comprova o novo ramo automático. [CI b856f89 da 0.5.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39534111302) aprovado: **415/415 testes, zero falhas/skips**, TypeScript, build, pacote e abertura real do Jarvis, incluindo entrada/saída de tela cheia. A dispensa foi verificada com fronteiras substituídas; a abertura automática do navegador no destino ainda deve ser ensaiada.

A 0.5.2 adiciona tela cheia por botão/F11 e saída por Esc, sem interromper a conversa. A validação do pacote entra e sai pelo botão real; veja [Tela cheia](fullscreen.md). [CI 4e90ff5 da 0.5.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39531815223) aprovado: **413/413 testes, zero falhas/skips**, TypeScript, build, pacote e entrada/saída de tela cheia pelo botão real no aplicativo Windows. A base anterior é a 0.5.1: correção da abertura do navegador padrão sem cadastro manual e preparação antecipada do comentário de roupa durante a saudação. Preserva recepção por duas palmas após login, entrada/renovação opcional da conversa por voz, núcleo, voz, painel limpo, contexto e ferramentas da 0.4.0. [CI b8c6c8f da 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovado: **402/402 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. Os ensaios físicos da correção ainda estão pendentes. [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real, com os limites do ensaio físico registrados em [Validação](validation.md). Os **343 testes, zero falhas/skips, TypeScript, build, pacote e abertura nativa real aprovados no [CI da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110)** são evidência daquela versão. Resultados históricos não comprovam a revisão nova, latência, identificação, som audível, fechamento durante áudio ou ativação por dispositivos.

## Evidências já registradas

| Evidência | Resultado confirmado | O que não comprova |
| --- | --- | --- |
| CI ba0680 | 147 testes, verificação, build e artefato portátil aprovados. | Novo CI 0.2.0 e execução física do EXE. |
| Revisão 0.2.0 local | 214 testes aprovados, zero falhas/skips, com Python configurado; TypeScript estrito, build e verificação do processo principal aprovados. | Provedores pagos, microfone/palavra/palmas e login real. |
| Abertura 0.2.1 | CI com 218 testes e abertura real de janela/DOM/preload/boot; captura de tela do usuário confirmou a janela no próprio computador. | Conversa com clone, microfone nativo, login e persistência DPAPI. |
| Revisão 0.2.2 | CI com 221 testes e abertura real do pacote; ensaio visual substituído manteve voz fora do painel e texto digitado visível. | Áudio do clone e dispositivos reais; execução da nova versão pelo usuário. |
| Revisão 0.2.3 | 229 testes, TypeScript, build, pacote e abertura nativa real aprovados no CI; handlers de fechamento e filtros testados com Electron/OS/sinais substituídos. | Encerramento durante áudio e novos filtros no equipamento do usuário. |
| Revisão 0.3.1 | 264 testes e abertura nativa aprovados; núcleo recebeu aceite visual do autor. | Login, detecção de palmas e imagem de roupa. |
| Revisão 0.4.0 | 343 testes e abertura nativa aprovados; pacote conferido por hash. | Recepção 0.5.0, nova chamada de imagem e renovação de voz. |
| Revisão 0.6.1 | 529/529 testes, TypeScript/build/pacote e abertura nativa aprovados; player em HTTPS local silenciado. ZIP/EXE conferidos. Usuário confirmou busca real, mas o vídeo não começou a tocar. | Causa da falha, reprodução ao vivo, som ouvido, pausa/retomada e correção 0.6.2. |
| Texto OpenAI | Pergunta real respondida corretamente. | Benchmark, custo e latência comparável. |
| Microfone | Captura com nível e liberação observadas. | Detector de palmas ou palavra. |
| Câmera | Prévia real 640×480 e parada. | Reconhecimento: OpenCV e pesos ausentes. |
| Voz Realtime anterior | Resposta ouvida pelo usuário, em marin. | Nova rota de saída ElevenLabs com o clone desejado. |
| Saudação/áudio | Narração aprovada a 0,95× com altura preservada e efeito metálico fixo 0,78. | Conversa nova, login ou ativação automática. |
| Ajustes no navegador | Opções nativas de login/palavra desabilitadas; espera exige voz/chave/cidade; opções salvas preservadas. | Funcionamento do registro de login ou reconhecedor Windows. |
| Palmas 0.6.0 | O usuário confirmou ativação física por duas palmas na sessão testada. | Novo login/reinício do Windows, todos os ambientes e o fluxo YouTube 0.6.1. |

O [registro de validação](validation.md) apresenta os limites e o histórico, incluindo o roteiro curto aprovado pelo autor. **A sequência atual com login, palmas, música/saudação e conversa contínua, sem câmera automática, ainda exige ensaio físico.** A prévia musical já foi aprovada; isso não comprova o fluxo integrado. Os cenários a seguir continuam a executar onde não houver aceite específico: a confirmação real 0.6.5 acima cobre somente a sequência Thunderstruck/AC/DC→vídeo→som, sem aprovar a recepção integrada ou todo o roteiro.

## YouTube nativo — roteiro 0.6.5

1. No pacote 0.6.5 conferido, no aplicativo nativo com **MVP / 06.5**, pedir por texto uma pesquisa e confirmar até oito resultados reais com ID, título, canal e URL. Repetir por voz. Pesquisa isolada não deve tocar um vídeo.
2. Pedir um dos resultados e conferir que `youtube_play` usa exatamente o ID observado no perfil. Um ID inventado, de outro perfil ou formato incompatível deve ser recusado antes da reprodução.
3. Confirmar o vídeo correto e o estado do player. Registrar separadamente vídeo carregado, estado de reprodução e som efetivamente ouvido; nenhum desses resultados pode ser deduzido só do despacho de navegação.
4. Pedir pausa e retomada e conferir o estado real do player. Os comandos devem atuar somente na janela controlada, sem operar abas externas ou outro player.
5. Pedir somente para abrir youtube.com e confirmar que a rota genérica continua no navegador padrão. A abertura não deve ser anunciada como pesquisa ou reprodução.
6. Ensaiar pedido ambíguo, lista vazia, vídeo removido/restrito, falha de rede, login, consentimento e CAPTCHA. Anúncio curto deve terminar naturalmente antes da confirmação do vídeo; anúncio/carregamento além de 15 segundos deve expirar com janela preservada. Conferir vídeo oculto residual e progresso entre observações sem substituir continuamente a referência inicial. Não clicar em pular/aceite/login nem anunciar vídeo tocando sem evidência.
7. Cancelar durante busca/reprodução, fechar a janela e trocar perfil/reset. Observar limpeza, recusa de resultados/IDs antigos e ausência de retomada ou fala tardia. Conferir continuidade da voz/recepção e preservação dos ajustes privados.
8. Conferir que o plugin Ultron instalado continua anunciando somente as cinco ferramentas anteriores, sem ferramentas YouTube. Registrar os ensaios do Dot em separado.

Os testes automáticos devem cobrir contratos fechados, consulta limitada, IDs observados por perfil, estados do player, cancelamento e falhas com fronteiras substituídas. Essa cobertura não substitui o ensaio real do site. [Detalhes](youtube.md).

## Cartões modernos — roteiro 0.6.5

1. Exibir resultado moderno com título e canal visíveis no mesmo cartão e URL de canal permitida; conferir ID, título/canal observados e URL canônica, sem inferências.
2. Misturar cartões modernos e legados, duplicar IDs e exceder oito vídeos; manter ordem observada, unicidade e limite de oito, somente para a consulta atual.
3. Retirar ou ocultar título/canal, usar link inválido ou texto de outro cartão; não aceitar nem completar metadados por suposição.
4. Exibir anúncio com marcador ancestral e anúncio com `feed-ad-metadata-view-model` descendente; nenhum entra na lista de vídeos autorizados.
5. Confirmar que a fixture nativa de cartões modernos mantém a navegação gerenciada pelo botão e `/watch` → nova busca → segundo vídeo. Não alterar a mídia para mascarar uma falha de descoberta.
6. No site real, pedir música por voz e conferir o retorno da busca, a escolha observada, chamada de reprodução, progresso e som. Registrar cada etapa separadamente, sem divulgar o histórico privado.

## Busca dinâmica — roteiro 0.6.4

1. Em fixture com submit padrão impedido e lupa moderna funcional, confirmar que a busca usa um único clique e chega à consulta/lista correta.
2. Retirar o botão moderno e testar os fallbacks restritos ao botão legado e formulário real; sem controles observados, informar indisponibilidade.
3. Confirmar que nenhum caso fabrica URL de resultados ou repete cliques após falha/cancelamento.
4. Verificar login/consentimento/CAPTCHA, perfil e X, mantendo intervenção manual e descarte de resposta tardia.
5. Buscar a partir de vídeo aberto, escolher resultado da busca nova e tocar o segundo vídeo, preservando as regressões anteriores.

## Recuperação e interrupção — roteiro 0.6.3

1. Buscar, tocar um resultado e, a partir da página de vídeo, solicitar explicitamente nova busca. Escolher e tocar o segundo vídeo observado. Conferir que não reutiliza ID da busca anterior.
2. Provocar bloqueio/transição de navegação na fixture; nova busca enfileirada deve tentar somente destinos HTTPS permitidos. Login, consentimento e CAPTCHA permanecem para intervenção humana. Cancelamento/perfil/saída continuam interrompendo.
3. Durante ferramenta pendente, injetar `speech_started` sem transcrição, transcrição vazia, falha e texto de outro `item_id`. TTS pode parar, mas a ferramenta não deve ser cancelada por esses sinais.
4. Durante a mesma condição, entregar transcrição não vazia correlacionada à fala. Cancelar somente as execuções/respostas capturadas no início, sem atingir um turno mais novo.
5. Concluir a ferramenta enquanto fala/transcrição está pendente. Nenhuma continuação deve partir antes da resolução correspondente; duplicatas ou respostas atrasadas não criam ações extras.
6. Testar Interromper, encerrar voz, troca de perfil/reset e X durante ferramentas e síntese. Cancelamento explícito deve ser imediato, sem aguardar transcrição.
7. No ensaio físico, registrar ruído, TV/música e fala da pessoa separadamente. TV/música podem produzir transcrição não vazia; não prometer identificação de locutor ou rejeição de todo ruído.
8. Conferir saudação→voz, música, preset 0,95×/efeito fixo, câmera manual em Presença e ausência de captura automática na recepção.

## Ponte privada Ultron — roteiro 0.6.0

1. Com configuração limpa, confirmar `ultronEnabled: false` e ausência de conexão acessível. O teste HTTP não deve permitir habilitar a capacidade nativa. Instalar o plugin não deve marcar a opção do Jarvis.
2. Conferir manifesto, servidor STDIO e lista exata: `jarvis_status`, `jarvis_weather`, `jarvis_open_browser`, `jarvis_open_website`, `jarvis_speak`. Pacote privado completo, sem token de descoberta, chaves, banco, rostos, voz de referência ou música.
3. Abrir o Jarvis e habilitar a opção nativa em Ajustes. Consultar estado sem expor dados de credenciais e clima atual com a cidade já configurada, horários e fonte. Desabilitar/fechar deve recusar chamadas posteriores e cancelar trabalho pendente.
4. Solicitar uma abertura genérica: o navegador padrão deve receber o Google. Para site específico, usar o endereço exato pedido em `jarvis_open_website`, com e sem esquema, sem substituí-lo por pesquisa ou página inicial. Rejeitar esquema incompatível e entrada adicional. Distinguir despacho de janela observada.
5. Narrar uma frase autorizada de até 600 caracteres. Antes do evento de fim do áudio, não aceitar recibo de sucesso. Confirmar voz configurada, 0,95×/altura preservada/efeito 0,78, pulso e ausência de música/transcrição/nova captura. Som efetivamente ouvido é um resultado separado.
6. Com conversa, recepção, teste de microfone ou tarefa digitada ativos, tentar narrar: deve retornar ocupado antes de TTS e preservar a atividade existente. Interromper durante síntese/reprodução, cancelar pelo cliente, trocar perfil/configuração e fechar; nenhum áudio tardio deve voltar.
7. Testar cliente sem autorização, metadados inválidos, payload excedido, chamada repetida e timeout, sem ecoar tokens ou repetir efeitos. Validar que a ponte não oferece shell, leitura de arquivos, câmera ou entrada de mensagens ao Dot.
8. Em nova tarefa local compatível, verificar se o Ultron recebe as ferramentas e consegue uma chamada autorizada. Registrar essa evidência independentemente dos testes simulados; a instalação local não comprova disponibilidade na conversa principal na nuvem.

## Testes automáticos

O roteiro manual da ponte está na seção **Ponte privada Ultron — roteiro 0.6.0** acima. Os testes do protocolo não substituem a validação do acesso pelo Dot.

Na raiz do projeto, use Node 24 ou superior:

```text
npm test
npm run check
npm run build
```

`npm run verify` reúne essas três verificações. Quando Python não estiver no caminho, a suíte opcional de visão informa skip. Para executá-la, defina `JARVIS_PYTHON` com o caminho do interpretador local ou use:

```text
python -I -B -m unittest discover -s services/vision -p "test_*.py"
```

Não é necessário instalar OpenCV ou baixar modelos para os testes de protocolo e pré-processamento: o backend é substituído por uma implementação de teste. A execução real da rede neural é uma verificação separada.

| Camada | Cobertura automática | Limite da evidência |
| --- | --- | --- |
| YouTube nativo 0.6.1 | Contratos e observação por perfil, estados do player, bloqueios/cancelamento com fronteiras substituídas; cenário nativo de DOM/player em página HTTPS local. | A mídia PCM silenciada do teste não comprova consulta/reprodução no YouTube ao vivo nem som ouvido. |
| Ultron local 0.6.0 | MCP limitado, validação/autoridade da ponte, estado ocupado antes de TTS, correlação, ACK de fim do áudio e cancelamento. | Transporte/serviços substituídos não comprovam instalação, disponibilidade no Dot, navegador visível ou som ouvido. |
| OpenAI SSE | Deltas progressivos, fragmentos UTF-8, heartbeats, JSON inválido, resposta incompleta e uso de tokens. | Respostas de rede simuladas; não mede um modelo. |
| Ferramentas via modelo | Continuação com itens completos, chamadas conhecidas, argumentos JSON, IDs repetidos e limite de turnos. | Valida protocolo e delegação; não comprova software externo. |
| Interrupção 0.6.3 | Sinal VAD durante ferramenta silencia TTS; cancelar exige texto não vazio correlacionado às execuções capturadas. Controles explícitos continuam imediatos; continuação aguarda a entrada pendente. | TV/música transcritas ainda podem interferir; testes não provam a causa do relato do usuário. |
| Contexto de memória | Recuperação pelo perfil backend, limite de 8.000 caracteres e marcação como dado não confiável. | Não é treino de pesos nem defesa perfeita de linguagem natural; a política de ferramentas é a barreira efetiva. |
| Continuidade de prévias | Um novo pedido recupera `planId` do backend, sem depender de IDs no texto; contexto limitado, isolamento de perfil e cancelamento antes de envio. | Referências não autorizam execução; planos, pasta e arquivos são revalidados pelo executor. |
| Erros e chave | Falta de chave não abre rede; erros HTTP, transporte e ferramenta não ecoam a credencial de teste. | Credencial usada apenas no teste; não demonstra DPAPI real. |
| Realtime | FormData/SDP, saída em texto, VAD, ferramentas e bloqueio de saída de áudio OpenAI. | Não cria uma chamada paga e não captura áudio real. |
| Recepção 0.6.2 | Sequência sem captura de câmera, saudação→voz e cancelamento em cada etapa. | Verificação local registrada em Validação; substitutos não comprovam login, palmas ou som ouvido. |
| Retirada de roupa 0.6.2 | Valor legado verdadeiro migrado para falso, controles/endpoints ativos removidos e ausência de captura/envio na recepção. | Não remover prévia/cadastro facial manual nem confundir migração com teste físico. |
| Navegador padrão 0.5.1 | Abertura genérica sem EXE cadastrado, confirmação com nome/destino, chamada externa fixa, falha/cancelamento e resultado de despacho não verificado. | Callback Windows substituído não demonstra qual navegador ou janela abriu na máquina. |
| Câmera manual | Prévia, parada, reconhecimento local opcional e preservação de cadastro, separados da recepção. | Sem captura automática ou chamada de roupa à OpenAI; reconhecimento exige modelos e ensaio próprios. |
| Voz contínua | Renovação somente por prazo normal enquanto desejada, sem repetição da recepção; parada/reset invalidam reconexão e erro não cria loop. | Transporte/relógio substituídos não comprovam conexão prolongada real nem custo. |
| Fala ElevenLabs | Preset aprovado, IDs de execução/trecho, fila, cancelamento, limites e ausência de fallback de voz. | Rede e áudio substituídos; não comprova o clone ouvido em conversa. |
| Espera/palmas | Duas transientes, intervalo, adaptação, cooldown, rejeição de envelopes sustentados e limpeza da captura. | Sinais e dispositivos sintéticos; não mede falsos positivos no ambiente real. |
| Login/palavra Windows | Opções opt-in, caminho do pacote, protocolo do worker, idioma ausente e cancelamento. | APIs/processos substituídos; não altera um login real nem reconhece voz física. |
| Música | Fonte explícita, reprodução, volume e limpeza após erro/parada. | AudioContext/HTMLAudio substituídos; a prévia privada aprovada é uma evidência separada da recepção integrada. |
| Integração App | Hooks/controlador reais: capacidade no boot, uma única permissão pendente durante pausa/retorno e cancelamento da preparação. Interromper mantém a escuta parada até nova escolha explícita. | Provedores/captura substituídos; não comprova ativação física ou áudio ouvido. |
| Contexto 0.3.0 | Leitura de clima independente da saudação/TTS, fonte e atualidade, cache compartilhado, estados parciais, limite de registros, cancelamento e isolamento de perfil. | Respostas de fonte e relógio substituídos não comprovam disponibilidade da rede nem clima observado no local. |
| Visão Python | Rejeição de formatos, dimensões antes de decode, ausência opcional de modelos, cinco pontos antes de feature e normalização. | Backend falso; não mede detecção ou identificação reais. |
| Executor local | Consulte `tests/runtime.test.mjs` para política, caminhos, estado e resultados verificados. | Verifique quais adaptadores do sistema foram substituídos antes de interpretar o resultado. |

A suíte automática utiliza transportes/processos/dispositivos substituídos e diretórios temporários; não exige chamadas pagas. Contagens e skips devem ser associados à execução/commit. Os ensaios reais anteriores da tabela inicial são evidências separadas, não produtos do `fetch` falso ou dos testes Python.

## Ambiente de ensaio

Use uma pasta descartável fora da pasta privada de dados. Prepare arquivos de extensões diferentes, datas do mês atual e do mês anterior, um arquivo alterado após a prévia, um conflito de destino e um link ou junção de teste. Não escolha Documentos ou Downloads reais para o primeiro ensaio.

Registre versão do Windows, CPU, memória, modelo de câmera, microfone, saída de áudio, navegador/Electron e versões do app e modelos. Diferencie três superfícies: prévia visual estática, harness local no navegador e aplicativo Electron. O harness local usa chave em memória; não conta como teste de persistência do armazenamento protegido do Windows.

Para o harness, inicie `npm run test:local` e abra `http://127.0.0.1:47832`. O servidor escuta somente loopback e a bridge valida token/origem. A pasta de testes é `local-data/workspace`, gerada pelo próprio harness e excluída do Git. Abrir aplicativos do Windows fica indisponível nesse modo. `npm run preview` continua sendo uma prévia visual sem esses serviços locais.

## Execução local e correção durante tarefa

1. Escolha a pasta de ensaio e peça a prévia de organização. Sem confirmação, nenhum arquivo deve mover.
2. Corrija o filtro para o mês atual, compare a nova lista e só então autorize. Verifique cada origem e destino no registro e no sistema de arquivos.
3. Interrompa antes da primeira ação e depois de alguns efeitos. O futuro deve parar e os efeitos completos continuar visíveis.
4. Solicite restauração. Um arquivo preservado pode voltar; um arquivo alterado ou destino em conflito deve ser recusado sem sobrescrita.
5. Repita uma chamada com o mesmo identificador e reinicie durante um efeito. Nenhuma ação externa deve ser repetida automaticamente depois do reinício.
6. Tente caminho fora da pasta, link/junção, URL inválida, argumento extra e ferramenta inexistente. A política deve recusar antes de abrir ou escrever.
7. Abra um aplicativo cadastrado e verifique o processo observado. Um comando disparado sem confirmação de funcionamento deve permanecer falha ou não verificado.

O fluxo atual só pode anunciar os controles realmente implementados. Foco de janela arbitrária, controle visual de qualquer aplicativo, leitura de qualquer página, envio de mensagens e casa conectada exigem adaptadores próprios e não são aprovados por esse ensaio.

## Contexto sob demanda e núcleo orbital — 0.3.0

1. Com saudação desativada e sem chaves de voz/modelo, abra **Contexto**. A leitura de clima deve funcionar quando houver cidade configurada; não deve pedir microfone/câmera, carregar credenciais ElevenLabs, sintetizar, tocar música, narrar nem executar ferramentas. Fechar o painel mantém o dashboard sem cartões ou transcrições.
2. Sem cidade, confirme `not_configured` e o acesso a Ajustes. Com cidade, confira unidade Celsius, condição, mínima/máxima e chance de precipitação quando fornecida, fonte Open-Meteo e horários. Ausência de probabilidade deve aparecer sem valor inventado.
3. Consulte novamente em menos de dez minutos e confira a indicação de cache. Após expirar, mudar coordenadas/fuso ou mudar a data local, a fonte deve ser consultada novamente. Rejeite observação com mais de três horas, futuro além da tolerância, data diária incorreta, unidades erradas ou intervalos inválidos.
4. Desligue a rede e simule resposta inválida/lenta. O clima deve ficar indisponível, sem estimativas ou corpo bruto de erro; a atividade local deve continuar disponível. Uma falha do registro local não deve apagar o estado independente do clima.
5. Feche o painel durante uma consulta lenta e reabra; repita com atualização, troca de cidade, perfil e encerramento. Respostas antigas não podem reaparecer, narrar ou mostrar registros de outro perfil. Campos extras, perfil ou endpoint enviados pela interface devem ser recusados.
6. Gere atividades em dois perfis e confira o isolamento, estados e horários. Compare contagens com o recorte das cem execuções mais recentes; a lista mostra até oito. Faça mais de cem execuções de teste e confirme que a tela informa o limite, sem apresentar o recorte como total histórico. Argumentos, resumos livres, caminhos, memórias e procedimentos não devem aparecer na resposta de contexto. O registro local não deve ser apresentado como agenda.
7. Confirme ausência de conexões ou dados de calendário, e-mail e notícias: esses recursos são futuros. O painel não deve acrescentar dados automaticamente ao modelo ou à saudação aprovada.
8. No núcleo orbital original, confira matiz azul constante e pulsação durante entrada de áudio, reprodução e execução, sem texto no centro. Teste janela pequena, redimensionamento, escala de tela e preferência de movimento reduzido. A animação não deve alterar permissões nem iniciar áudio. Registre fluidez/consumo no equipamento usado; aparência não comprova latência de resposta.

## Texto e memória com OpenAI

Em uma conta configurada, faça uma pergunta curta e confira texto chegando por partes. Peça uma ação real da pasta de ensaio, confirme que existe uma autorização local e que a fala final reflete seu resultado. Negue a autorização e confirme que o modelo não anuncia sucesso.

Peça para lembrar uma preferência, autorize, encerre e inicie outra conversa. A preferência deve ser recuperada no mesmo perfil. Outro perfil não deve recebê-la. Edite ou apague a preferência e repita em uma nova conversa. Uma sessão de voz já aberta precisa ser reiniciada para receber o contexto atualizado.

Teste chave inválida, modelo indisponível, limite do provedor e rede desligada. O texto de erro deve ser útil sem expor a chave, corpo bruto de erro ou caminhos privados. Exporte somente diagnósticos sem conteúdo pessoal.

## Microfone, saída e câmera

O roteiro completo está em [Voz e câmera](voice-and-camera.md). A captura local do microfone e uma prévia de webcam podem ser verificadas sem enviar dados ao provedor. Registre separadamente: acesso concedido, sinal capturado, som efetivamente ouvido, tracks liberadas e falha de permissão.

Uma conversa de voz real precisa de ambas as chaves e da voz ElevenLabs configurada. Teste pergunta, resposta adequada audível com o clone, pulsação, interrupção por fala/botão e limite de duração, sem transcrição no painel Conversa. O reconhecimento e histórico internos continuam necessários ao fluxo. Um gráfico animado não conta como áudio ouvido. Câmera capturando não conta como identificação; reconhecimento requer pesos/dependências e ensaio voluntário.

Teste duas pessoas, rosto não identificado, luz ruim, óculos, afastamento, retorno e foto/vídeo. Identificação deve ficar neutra quando houver ambiguidade; a câmera nunca deve liberar ação sensível. Apague o cadastro e confirme a exclusão depois de reiniciar. Execute captura e voz juntas para medir se o worker prejudica áudio ou animação.

## Saudação dinâmica e amostra fixa

1. Abra **Ajustes → Saudação → Amostra fixa da voz** e confirme a reprodução da frase gravada. Esse controle não deve consultar o clima, sintetizar outra fala ou abrir o microfone. **Parar amostra** deve encerrar áudio e pulsação.
2. Configure privadamente cidade, voz e chave ElevenLabs. Use **Iniciar Jarvis** para preparar a saudação com cumprimento pelo horário, tempo e previsão. Confirme o áudio e a atribuição meteorológica compacta, sem transcrição da recepção no painel Conversa; esse fluxo usa o serviço de abertura, não o MP3 da demonstração.
3. Se o navegador exigir gesto, use **Ouvir saudação**. Confirme que ele reproduz o áudio preparado sem repetir consulta ou síntese. Interrompa e confirme o fim do som e da pulsação.
4. Diferencie a preparação de um novo boletim da reprodução de um arquivo gravado. O arquivo preserva as informações do momento da geração e não comprova uma consulta atual ao clima. Não inclua cidade, credenciais ou áudios privados no relatório público.

## Nova conversa OpenAI → texto → ElevenLabs

1. Com ambos os provedores configurados, faça uma pergunta inédita. Confirme resposta adequada e a voz aprovada efetivamente ouvida, com reprodução fixa 0,95×/altura preservada/efeito 0,78, sem transcrição no painel. Depois envie uma pergunta digitada e confirme que ela e sua resposta continuam visíveis. A saudação também não deve acrescentar falas ao painel.
2. Confira que a configuração Realtime solicita texto e que nenhuma track remota OpenAI toca. A antiga resposta marin deve ser identificada como teste histórico, nunca como aceite do clone.
3. Interrompa durante geração do primeiro trecho, síntese, fila, reprodução e aprovação de ferramenta. Nenhum áudio atrasado ou evento `.done` de resposta cancelada deve voltar a narrar.
4. Simule falta de chave/ID, falha ElevenLabs, limite e rede interrompida. A sessão deve bloquear ou mostrar estado de erro, sem inserir a resposta falada no painel; não tocar voz OpenAI, voz do navegador ou a amostra fixa como substituto.
5. Troque perfil, encerre e atinja o limite da sessão com conversa contínua desligada. Confira cancelamento da síntese, fechamento de áudio/microfone e ausência de fala da geração anterior. Com conversa contínua ligada, use o roteiro de recepção completa abaixo para a renovação normal.

Registrar tempo até o primeiro som, falhas e consumo por provedor. Não substituir esse ensaio pelo teste de saudação ou pelo MP3 público.

## Espera, ativação e música

1. Em configuração limpa, confirme `startAtLogin: false` e `standbyEnabled: false`. Instalar não deve registrar login nem deixar o microfone aberto. Ative somente com escolha explícita e recepção configurada.
2. Com palmas escolhidas, use duas palmas entre 150–800 ms. Teste uma palma, intervalos inválidos, três palmas, repetição durante cooldown, fala, TV, teclas e ruído. Registre falsos positivos/negativos; não extrapole de sinais sintéticos.
3. No Windows nativo, teste “Jarvis” com reconhecedor de idioma instalado, e indisponibilidade sem reconhecedor. Não permitir migração silenciosa para Web Speech em nuvem. O teste HTTP deve manter o recurso nativo indisponível.
   Teste cada gatilho separadamente e depois ambos. Os filtros 0.2.3 conferem duração, frase/palavra, acomodação inicial e intervalos; a confiança nativa é um escore relativo, sem equivaler à intenção. Registre a origem observada do gatilho, sem atribuir o relato anterior a um detector não identificado.
4. Durante a saudação e eventual música, confira que a espera está pausada e o próprio áudio não reativa o assistente. Após fim/interrupção, confirme retorno apenas se ainda habilitada. Testar microfone/conversa ativa deve suspender a captura de espera concorrente.
5. Minimize, mude de janela, bloqueie/desbloqueie e retome suspensão. Verifique sinais e timers no pacote; registrar limitações do navegador separadamente.
6. Pause/retome na bandeja e minimize para continuar em espera. Durante saudação com música ou conversa, feche pelo X: áudio, captura, worker e aplicativo devem encerrar, sem reabrir por gatilho. Repita por Sair na bandeja. Troca de perfil deve invalidar callbacks antigos.
7. Use o arquivo musical privado já recebido e aprovado em prévia. Não há faixa padrão. Confirme início da trilha, volume/ducking, fim junto da saudação, cancelamento, erro de arquivo e ausência de reprodução residual. Não publicar trilha ou caminho.

## Início no login e executável Windows

Em um pacote Windows em caminho estável, habilite início ao entrar na conta, confirme registro observado e faça logout/login real. O app deve iniciar em espera quando configurado; não deve narrar antes do gatilho. Não confundir esse recurso com ligar o PC ou funcionar antes de login.

Teste desativação, novo login sem lançamento, mudança/ausência do caminho portátil e falha do registro. No desenvolvimento/navegador, o controle nativo deve ficar indisponível e não alterar o sistema. Verifique pacote limpo, chaves protegidas, câmera/microfone liberados e saída sem processo órfão.

Este ensaio ainda não foi realizado fisicamente; sucesso do empacotamento no CI não o substitui. Veja [Espera local](standby.md).

## Recepção completa e conversa contínua — 0.6.2

Use o executável atual quando estiver disponível e conferido, com chaves, cidade e trilha configuradas privadamente. Registre versão, dispositivos, opções e resultado; não publique imagens, chaves, ID da voz, caminho da música ou dados pessoais.

| Ensaio | Evidência esperada |
| --- | --- |
| Instalação limpa | Login, espera e voz contínua começam desligados; não há opção de análise de roupa nem captura automática. |
| Configuração legada com `receptionOutfitEnabled: true` | Valor migrado para `false`; demais escolhas, chaves, cidade, voz, trilha e cadastro facial preservados. |
| Salvar e reabrir o nativo | Opções persistem; chave não exige redigitação nem aparece no histórico. O teste HTTP mantém credencial apenas em memória. |
| Login com espera/palmas e palavra desligada | App em espera/bandeja; nenhuma música, saudação, câmera ou sessão OpenAI antes das duas palmas. Não clicar em Iniciar Jarvis para provocar o gatilho. |
| Duas palmas e disparo concorrente | Uma única recepção; música e cumprimento pelo horário/clima, sem repetição pelo segundo gatilho durante o fluxo. |
| Preparação, reprodução e fim da saudação | Nenhuma captura, pedido de câmera, chamada de imagem ou elogio; música termina com a saudação. |
| Conversa após a recepção ligada | Microfone WebRTC inicia depois do fim da saudação; pergunta inédita responde com a voz aprovada e núcleo pulsando, sem novas palmas ou transcrição. |
| Conversa após a recepção desligada | Não abre conversa em nuvem; pode retornar à espera local se continuar desejada. |
| Conversa contínua ligada | Renova apenas após prazo elegível, sem repetir música/saudação ou abrir câmera. Registrar continuidade e limites do histórico. |
| Rede/autenticação recusadas | Erro claro e microfone liberado; sem cadeia indefinida de reconexões. |
| Interromper durante saudação, síntese ou negociação/renovação | Trabalho futuro cancelado; nenhuma fala ou conexão de microfone começa por resposta atrasada. |
| Perfil/reset/configuração/saída | Gerações antigas invalidadas; X encerra áudio, captura, worker e processo. |
| Presença manual após recepção | Abrir/encerrar prévia continua funcionando separadamente; cadastro local é preservado e nunca autentica ferramentas. |
| Desativar início no Windows | Registro removido e nenhum lançamento no próximo login. |

A conversa contínua transmite áudio enquanto conectada, incluindo o silêncio entre comandos. Registre duração e consumo por provedor; a opção não promete sessão infinita ou orçamento máximo. Testes com substitutos não comprovam conexão prolongada no equipamento.

## Acesso ampliado e navegador padrão — 0.5.1

Use o pacote 0.5.1 e o [guia de comandos](desktop-access.md). Os 343 testes e abertura nativa da 0.4.0 são históricos; os casos abaixo exigem registrar o resultado da revisão atual no equipamento de destino.

| Ensaio | Evidência esperada |
| --- | --- |
| “Abra o navegador” com campo de navegador sem cadastro e inventário vazio | Confirmação legível mostra navegador padrão e `https://www.google.com/`; após autorizar, Windows usa sua associação padrão. Não exigir caminho de EXE ou cadastro em Ajustes. |
| Negar, cancelar ou falhar ao abrir o navegador padrão | Nenhuma chamada externa após negar/cancelar; falha não anunciada como conclusão. Despacho aceito sem observar janela permanece **Enviada ao Windows**. |
| Pedir foco para navegador genérico | Indisponibilidade explícita; não confundir despacho de abertura com foco verificado. |
| Pedir Chrome/Edge/Firefox pelo nome ou uma URL específica | Nome usa descoberta/ID observado; URL exata usa o navegador padrão, sem segundo clique em Autorizar; resultado apenas despachado permanece `unverified`, sem comprovação de carregamento. Não trocar o navegador padrão do Windows automaticamente. |
| Procurar/abrir app instalado, incluindo nomes semelhantes | Descoberta sem lançamento; escolha clara, confirmação com nome correto e resultado distinguindo processo, janela ou só despacho. |
| Abrir Downloads e pasta de outro volume local | Destino mostrado antes da abertura; Explorador correto. Organizar/ler arquivos fora da pasta de trabalho continua indisponível. |
| Negar/cancelar lançamento ou consulta | Nenhum efeito novo após a decisão; sem reaproveitar autorização em nova chamada. |
| Ler site público e pesquisar assunto atual | Confirmação com URL/consulta, texto pertinente e fontes clicáveis reais; falha de conta/rede sem resultado inventado. |
| Fonte sem citação, página JavaScript/login ou destino privado | Limitação explícita; nenhuma credencial do navegador compartilhada e nenhum site privado lido pela ferramenta pública. |
| Pedir tempo duas vezes sem saudação | Fonte consultada novamente, cidade e horário corretos, previsão atual; indisponibilidade sem usar previsão antiga. |
| Voz durante ferramentas | Voz Jarvis aprovada, pulsação, interrupção; sem transcrição no painel. |
| Troca de perfil com consulta pendente | Consulta antiga cancelada, sem links ou respostas no novo perfil. |

## Medição comparável

Para cada modelo e dispositivo, grave pelo menos 30 solicitações repetíveis por cenário e mantenha o mesmo protocolo entre versões. Separe ensaio frio de aquecido e registre falhas junto com os tempos; não exclua silenciosamente tentativas lentas.

| Medida | Início | Fim |
| --- | --- | --- |
| Primeiro texto | Envio do pedido | Primeiro delta visível. |
| Primeiro áudio | Fim da fala percebido no cliente | Primeiro som efetivamente reproduzido. |
| Passagem da saudação para voz | Fim audível da saudação | Microfone/sessão prontos para o novo comando. Conferir ausência de etapa de câmera ou comentário entre esses eventos. |
| Interrupção | Fala da pessoa ou clique | Fim audível da resposta anterior. |
| Ferramenta | Pedido aceito pelo executor | Resultado verificado. Excluir espera humana da medida de execução e reportá-la separadamente. |
| Presença | Primeiro quadro com rosto | Indicação de presença local. |
| Perfil estável | Primeiro quadro elegível | Identificação aceita pela regra temporal. |

Reporte quantidade, sucesso, p50, p95, máximo e método de marcação. O fim da fala, VAD e transporte são etapas distintas: medir somente um evento interno não prova latência percebida. Registre tokens e duração real das sessões para comparar custo. Monitore CPU, memória e frames perdidos com câmera desligada e ligada.

Até que esses ensaios sejam executados, metas como “resposta instantânea”, “melhor que todos os assistentes” e taxa de reconhecimento são objetivos, não resultados demonstrados.

## Registro de uma execução

```text
Data e versão do app:
Superfície: estática / harness local / Electron / executável empacotado
Sistema e hardware:
Modelos e voz:
Credencial: configurada / ausente (nunca incluir valor)
Automáticos: comando, quantidade, aprovados, falhas, skips
Microfone: acesso, captura, liberação
Saída: provedor/voz realmente ouvidos, reprodução e interrupção
Câmera: captura e liberação
Recepção sem câmera: migração legada, ausência de captura/envio automático e passagem da saudação para voz; Presença manual preservada
Espera: palmas/palavra, idioma, ruído, pausa/retorno e segundo plano
Login Windows: pacote/caminho, entrada real e desativação
Música: não fornecida / arquivo privado testado, fim e cancelamento
Conversa contínua: prazo configurado, quantidade de renovações, parada e ausência de loop após erro
Identificação real: dependências/pesos, cenários e resultados
Ações: prévia, confirmação, resultado, cancelamento e restauração
Contexto: fontes disponíveis, horários/cache, recorte de atividade, cancelamento e perfis
Núcleo orbital: superfície/tamanho, movimento reduzido, fluidez e aceite visual
Latência: quantidade, p50/p95 e método
Limitações ou falhas em aberto:
```

Antes de publicar uma release, execute instalação limpa, inicialização sem chave, atualização de configuração, empacotamento Windows e encerramento do processo. Não inclua chaves, base privada SQLite, rostos, imagens pessoais, gravações de voz, caches, arquivos de ensaio ou modelos baixados automaticamente no repositório público.
