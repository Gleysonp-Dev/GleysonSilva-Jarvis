# YouTube na conversa nativa — 0.6.1

A revisão 0.6.1 prepara pesquisa, escolha e reprodução de YouTube pelo Jarvis nativo no Windows. Os mesmos comandos podem ser solicitados por texto ou durante a conversa por voz configurada. **CI, pacote Windows e ensaio físico desta revisão ainda estão pendentes.** Os resultados 491/491 e downloads 0.6.0 do [registro de validação](validation.md) não comprovam estas ferramentas novas.

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

Só carregar uma página ou enviar um comando não comprova reprodução. O adaptador precisa observar o ID e a URL correspondentes ao vídeo e uma posição temporal válida do player. Para confirmar reprodução, exige mídia pronta, player não pausado e progresso entre duas observações; para pausa, exige o estado pausado. Se a evidência não estiver disponível, o Jarvis deve relatar falha ou bloqueio. Mesmo um estado de player confirmado não comprova que o usuário ouviu o som.

## Janela e limites

O fluxo usa uma janela Electron controlada pelo Jarvis, isolada da interface principal e do navegador padrão, com navegação limitada a HTTPS em www.youtube.com. Node permanece desabilitado, com sandbox; downloads e novas permissões são recusados. A página não recebe a bridge do Jarvis, não herda os cookies ou o login do navegador pessoal e não obtém acesso às chaves, arquivos, microfone ou câmera pela ferramenta.

Login, consentimento, CAPTCHA, uma seleção ambígua ou um bloqueio do site exigem intervenção do usuário. O Jarvis não deve entrar em contas, aceitar termos ou superar essas etapas automaticamente. Um anúncio também interrompe a tentativa automática para intervenção, sem pular publicidade. Disponibilidade regional, restrições, alterações no site e falhas de rede podem impedir a reprodução; um anúncio não deve ser anunciado como confirmação do vídeo solicitado.

Não há promessa de automação geral de navegador, controle de qualquer site, busca em toda conta pessoal, downloads de mídia ou resposta instantânea. O comportamento depende da evidência realmente disponível no site e no player.

## Relação com Ultron

As três ferramentas desta revisão pertencem à conversa nativa do Jarvis, tanto por texto quanto por voz. O plugin privado **Jarvis · Ultron 0.6.0 continua com cinco ferramentas**: estado, clima, abertura do navegador, abertura de site e narração. Não há ferramentas YouTube no MCP desta revisão, nem uma API para enviar mensagens ao Dot pessoal. [Guia da conexão privada](ultron.md).

## O que falta validar

Executar a pesquisa real, escolher um resultado, observar o vídeo correto, ouvir o áudio e confirmar pausa/retomada no Windows. Ensaiar também lista vazia, ID antigo/de outro perfil, cancelamento, fechamento, anúncio, indisponibilidade e intervenção exigida pelo site. Registrar versão, horário e resultado, sem publicar histórico pessoal ou credenciais.

O usuário confirmou a ativação por duas palmas na 0.6.0. Esse relato pertence à espera/recepção daquela sessão e não valida o fluxo YouTube ou um novo login do Windows. A prova automática e o ensaio físico devem permanecer separados no [plano de testes](test-plan.md) e na [validação](validation.md).
