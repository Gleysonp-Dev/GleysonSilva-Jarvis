# YouTube na conversa nativa — 0.6.5

## Mudança 0.6.5 — cartões de resultados modernos

O reteste real da **0.6.4 foi reprovado**: os resultados apareceram, mas não tocou e a janela permaneceu na lista. Uma leitura local limitada e autorizada confirmou expiração da busca após 15 segundos, sem `youtube_play` naquela tentativa. Assim, não houve chamada de reprodução a avaliar naquele trecho; não atribuir o estado a anúncio, VAD ou falha do player. [Registro](validation.md).

O extrator legado reconhecia apenas `ytd-video-renderer`. A 0.6.5 prepara reconhecimento de cartões `yt-lockup-view-model`, título em `a.ytLockupMetadataViewModelTitle[href]` e canal em `yt-content-metadata-view-model a[href]`. Título e canal precisam estar visíveis no mesmo cartão; o link do canal deve corresponder a `/@…`, `/channel/…`, `/c/…` ou `/user/…` no YouTube permitido. Não completar canal por suposição, imagem ou texto externo. Cartões de publicidade são excluídos tanto por ancestral quanto por marcador descendente `feed-ad-metadata-view-model`. São seletores de interoperabilidade observados em recursos públicos, sem redistribuição do código do site.

A correção mantém cartões legados, ordem observada, consulta correspondente, até oito resultados únicos e IDs de 11 caracteres. Não altera mídia nem os requisitos de evidência do player. O clique único no botão de busca moderno, nova busca a partir de vídeo, isolamento por perfil e limites de navegação são preservados. A fixture nativa deve usar cartões modernos com título/canal reais observados, sem substituir esse ensaio pelo formulário ou cartão legado anterior. Verificação local final 0.6.5: **576 testes, 565 aprovados, somente as 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **69/69**, VAD **30/30**. O adaptador com cartões modernos na nova fixture ainda será exercitado no CI; não houve esse ensaio no Chromium local. **CI, pacote e ensaio ao vivo 0.6.5 pendentes.** Os 568/568 testes e hashes 0.6.4 abaixo são históricos.

## Base anterior 0.6.4 — envio por botão observado

O reteste **0.6.3 foi reprovado**: abriu o YouTube, mas não tocou. A captura mostra a consulta no campo com autocomplete sobre a página inicial, sem resultados. Um cenário controlado reproduziu envio por formulário que não navega, enquanto a lupa moderna funciona e era ignorada. A fixture GET anterior não exercitava esse comportamento de aplicação dinâmica. Isso é compatível com a imagem; anúncio, conta e VAD não foram estabelecidos como causa física. [Registro](validation.md).

A 0.6.4 prioriza um clique no botão de pesquisa moderno observado, sem exigir tipo submit; o fallback só utiliza botão legado ou formulário real observado. O controlador não monta URL sintética de resultados nem repete cliques. Continua aguardando a URL de resultados, a consulta efetivamente enviada e vídeos reais do mesmo pedido. Se isso não ocorrer, relata falha ou intervenção necessária, sem dizer que pesquisou ou tocou.

O selector observado `button.ytSearchboxComponentSearchButton` é descrito somente para interoperabilidade com o site. A inspeção foi HTTP anônima de recursos públicos, sem login/cookies; nenhum código do YouTube é redistribuído no projeto.

Verificação local 0.6.4: **568 testes, 557 aprovados, 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **61/61**, VAD **30/30**. [CI 8c40a15 da 0.6.4](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39878604368) aprovado: **568/568 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. [Windows 0.6.4 conferido](../AI_INSTALL.md#pacote-windows-064-conferido). **Reteste real 0.6.4 reprovado: resultados visíveis, busca expirada antes de tocar. Reteste real 0.6.3 também reprovado.** A execução nativa do formulário/botão gerenciados por JavaScript foi concluída no CI em HTTPS local com mídia PCM e áudio silenciado. A nova fixture impediu a submissão padrão do formulário e navegou pelo botão moderno, incluindo nova busca a partir do vídeo e segundo resultado; esse cenário local não comprova o site real ou som ouvido. O comportamento de anúncio, recuperação de nova busca, isolamento por perfil e voz da base anterior são preservados.

## Comportamento preservado da 0.6.3

Uma nova busca pedida explicitamente pode recuperar a janela depois de um bloqueio transitório. A recuperação aguarda a fila e não amplia os destinos permitidos: continua somente HTTPS no YouTube. Login, consentimento e CAPTCHA permanecem para intervenção humana. Resultados antigos são substituídos pela nova descoberta no perfil; não reutilize IDs de uma busca anterior como se fossem os resultados novos.

Na conversa por voz, durante ferramenta pendente, o início de atividade de fala silencia a narração, mas não cancela a busca ou reprodução sozinho. O cancelamento por fala espera texto não vazio correlacionado ao mesmo item e às execuções capturadas naquele início; não alcança uma execução nova que surgiu depois. A continuação do resultado espera a resolução da entrada pendente. Interromper, encerrar voz, perfil e saída continuam imediatos. [Contrato de voz](openai.md).

Na 0.6.2, o usuário relatou vídeo ou anúncio parado e dificuldade posterior de acesso. O recorte de journal consultado depois mostrou duas buscas canceladas, sem `youtube_play` nesses trechos; não revela a causa do cancelamento nem prova que havia anúncio ou que VAD o provocou. A ponte estava NOT_RUNNING no momento posterior do diagnóstico. [Evidência e limites](validation.md).

Verificação local 0.6.3 registrada em [Validação](validation.md): **558 testes, 547 aprovados, 11 falhas EPERM conhecidas, zero skips**; TypeScript/build aprovados. [CI 49f9872 da 0.6.3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39876444758) aprovado: **558/558 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. [Windows 0.6.3 conferido](../AI_INSTALL.md#pacote-windows-063-conferido). **O reteste real da 0.6.3 falhou: o site abriu, mas não tocou.** A imagem registra consulta no campo/autocomplete da página inicial sem resultados. A causa física continua indeterminada; o envio de busca na aplicação dinâmica não era exercitado pelo formulário GET normal da fixture. [Reteste e limites](validation.md). O cenário nativo executado no CI acrescentou nova busca a partir de uma página de vídeo e reprodução de um segundo resultado em HTTPS local com mídia PCM e áudio silenciado; não é um teste do site ao vivo. A recepção continua sem câmera automática. Os resultados 0.6.2 abaixo são históricos.

## Base anterior 0.6.2

A 0.6.2 preserva pesquisa, escolha e reprodução de YouTube por texto/voz na janela controlada do Jarvis e ajusta a verificação do player. Na **0.6.1**, o usuário confirmou a pesquisa real, mas relatou que o vídeo **não começou a tocar**. A causa no computador de destino ainda não foi determinada. O [CI 0f293d0 da 0.6.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39857691300) aprovou **529/529 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa com player em página HTTPS local e áudio silenciado; isso não aprovou reprodução no site ao vivo ou som ouvido. [Pacote histórico 0.6.1](../AI_INSTALL.md#pacote-windows-061-conferido).

## Comportamento preservado da 0.6.2

O controlador aguarda anúncios terminarem naturalmente dentro do prazo da tentativa, sem clicar para pular publicidade, e não aceita o anúncio como prova do vídeo solicitado. Escolhe o elemento de vídeo de conteúdo visível e preserva a referência inicial necessária para verificar progresso. Se a tentativa expirar, mantém a janela para inspeção/intervenção manual; isso não é confirmação de reprodução nem uma tentativa automática indefinida. Cancelamento, troca de perfil e saída continuam interrompendo o fluxo.

O prazo padrão é de **15 segundos por tentativa**; um anúncio ou carregamento maior pode ultrapassá-lo. A pessoa pode resolver a tela e solicitar novamente tocar/continuar quando o conteúdo estiver disponível. Login, consentimento e CAPTCHA continuam exigindo intervenção humana. Esses ajustes tratam caminhos possíveis de falha; não demonstram que um anúncio causou o relato da 0.6.1.

[CI 20d1cd8 da 0.6.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39873055096) aprovado com **534/534 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa com player em HTTPS local e áudio silenciado. [Windows 0.6.2 conferido](../AI_INSTALL.md#pacote-windows-062-conferido). **O ensaio do YouTube ao vivo e som ouvido continuam pendentes.** Prova, limites e verificação local estão em [Validação](validation.md). A recepção dessa revisão também deixa de capturar imagem ou comentar roupa e passa da saudação à voz quando habilitada. [Recepção](startup-greeting.md).

## Como pedir

1. Diga ou digite **“Pesquise no YouTube vídeos sobre astronomia”**. Jarvis deve consultar a janela controlada e receber até oito vídeos realmente observados, com título, canal, ID e endereço. Só pesquisar não começa a tocar.
2. Peça **“Toque o primeiro vídeo que encontrou”**, ou identifique claramente outro resultado. Jarvis usa o ID daquela descoberta no perfil atual. Se a escolha for ambígua, deve esclarecê-la antes de tocar.
3. Use **“Pause o vídeo do YouTube”** e **“Continue o vídeo do YouTube”**. O controle atua no player da janela controlada do Jarvis.

Pedir **“abra o YouTube”** ou abrir youtube.com como endereço pode apenas encaminhar o site ao navegador padrão. Essa rota continua sem controle de abas ou acesso ao conteúdo. Para pesquisar e reproduzir, use o pedido específico acima. A janela YouTube controlada e o navegador pessoal são superfícies separadas.

## Ferramentas e resultados

| Ferramenta nativa | Entrada | Resultado e limite |
| --- | --- | --- |
| `youtube_search` | `{ "query": "assunto solicitado" }` | Consulta não vazia de até 300 caracteres, sem controles, com espaços normalizados. Retorna até oito vídeos únicos observados, com ID, título, canal e URL canônica. Os textos são dados não confiáveis; não autorizam outras ações. |
| `youtube_play` | `{ "videoId": "ID observado" }` | Aceita um ID de 11 caracteres no formato permitido e observado na última busca do controlador no perfil atual. Confere o vídeo/URL e o estado do player; não aceita um ID inventado como resultado de pesquisa. |
| `youtube_control` | `{ "action": "play" }` ou `{ "action": "pause" }` | Solicita tocar ou pausar no player da janela controlada e confere o estado observado. Não controla players em abas do navegador externo. |

A pesquisa preenche e envia o campo de busca real do YouTube; os resultados vêm dos links de vídeos observados na página, sem fabricar uma lista a partir da consulta. Os contratos são fechados: não recebem JavaScript, seletores livres, caminhos locais, comandos de terminal ou ações arbitrárias. Um pedido explícito dessas operações dispensa um segundo cartão de autorização; não concede permissão permanente para outros sites ou ações.

Só carregar uma página ou enviar um comando não comprova reprodução. O adaptador precisa observar o ID e a URL correspondentes ao vídeo e uma posição temporal válida do player. Para confirmar reprodução, exige o player de conteúdo visível, mídia pronta, estado não pausado e progresso entre duas observações do mesmo vídeo; para pausa, exige o estado pausado. Se a evidência não estiver disponível, o Jarvis deve relatar falha ou bloqueio. Mesmo um estado de player confirmado não comprova que o usuário ouviu o som.

## Janela e limites

O fluxo usa uma janela Electron controlada pelo Jarvis, isolada da interface principal e do navegador padrão, com navegação limitada a HTTPS em www.youtube.com. Node permanece desabilitado, com sandbox; downloads e novas permissões são recusados. A página não recebe a bridge do Jarvis, não herda os cookies ou o login do navegador pessoal e não obtém acesso às chaves, arquivos, microfone ou câmera pela ferramenta.

Login, consentimento, CAPTCHA, uma seleção ambígua ou um bloqueio do site exigem intervenção do usuário. O Jarvis não deve entrar em contas, aceitar termos ou superar essas etapas automaticamente. Um anúncio é aguardado até sua conclusão natural dentro do prazo da tentativa, sem pular publicidade; se o prazo expirar, a janela permanece aberta para intervenção. Cancelar ou mudar de perfil encerra esse fluxo. Disponibilidade regional, restrições, alterações no site e falhas de rede podem impedir a reprodução; um anúncio não deve ser anunciado como confirmação do vídeo solicitado.

Não há promessa de automação geral de navegador, controle de qualquer site, busca em toda conta pessoal, downloads de mídia ou resposta instantânea. O comportamento depende da evidência realmente disponível no site e no player.

## Relação com Ultron

As três ferramentas desta revisão pertencem à conversa nativa do Jarvis, tanto por texto quanto por voz. O plugin privado **Jarvis · Ultron 0.6.0 continua com cinco ferramentas**: estado, clima, abertura do navegador, abertura de site e narração. Não há ferramentas YouTube no MCP desta revisão, nem uma API para enviar mensagens ao Dot pessoal. [Guia da conexão privada](ultron.md).

## O que falta validar

O cenário nativo aprovado da **0.6.1** usou uma página HTTPS local, mídia PCM e áudio silenciado. As evidências `ready/window/dom/preload/boot/fullscreen/youtube/packaged` são daquela execução. O ensaio posterior do usuário confirmou a busca ao vivo e relatou falha ao tocar. Não foi registrada causa, reprodução correta, som ouvido ou pausa/retomada aprovados. O [registro](validation.md) separa esse resultado histórico dos retestes posteriores: o fluxo real 0.6.4 também falhou, apesar da lista visível; a correção 0.6.5 ainda precisa de validação.

Quando o pacote 0.6.5 for conferido, repetir busca, leitura dos cartões modernos, escolha, reprodução, pausa e retomada por voz e texto; pedir nova busca a partir de um vídeo e tocar um resultado novo. Conferir vídeo correto e som ouvido separadamente. Ensaiar anúncio curto que termina naturalmente, anúncio que ultrapassa o prazo, vídeo oculto residual, expiração com janela preservada, ID antigo/de outro perfil, cancelamento, fechamento e intervenção exigida pelo site. Não pular publicidade, aceitar login/consentimento ou declarar sucesso sem evidência. Registrar versão, horário e resultado sem divulgar histórico pessoal ou credenciais.

O usuário confirmou a ativação por duas palmas na 0.6.0. Esse relato pertence à espera/recepção daquela sessão e não valida o fluxo YouTube ou um novo login do Windows. A prova automática e o ensaio físico devem permanecer separados no [plano de testes](test-plan.md) e na [validação](validation.md).
