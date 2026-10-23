# Projeto GleysonSilva-Jarvis: OpenAI

O aplicativo usa Responses para texto digitado e Realtime com WebRTC para entrada falada e geração de texto. A resposta audível vem da ElevenLabs com a voz configurada; o áudio de saída OpenAI fica desativado. Na 0.6.2, a recepção não analisa roupa nem envia imagem à OpenAI: música/saudação com clima passam à conversa por voz quando habilitada. A preferência antiga de roupa é migrada para `false`. Câmera manual e reconhecimento local permanecem separados. As ferramentas YouTube, web, clima, aplicativos e pastas são preservadas. CI e pacote 0.6.2 foram aprovados; naquela revisão histórica, o ensaio ao vivo estava pendente. [Registro](validation.md).

O modelo solicita ferramentas; o executor local valida argumentos, verifica a pasta autorizada, apresenta a confirmação necessária e registra o resultado. Uma resposta gerada não prova que uma ação aconteceu.

## Revisão 0.7.0 — ferramentas nativas da Fire TV

Texto e voz podem solicitar `tv_open_app` com um dos seis IDs de aplicativo e `tv_control` com uma das doze ações fechadas. O IP, a chave e o pareamento permanecem no backend local; o modelo não recebe esses valores nem comandos ADB livres. “Jarvis, abra a Netflix” é encaminhado à TV configurada; um destino explícito Windows/navegador é respeitado. YouTube sem menção à TV preserva as ferramentas do computador. Resultado `unverified` deve ser narrado como comando enviado, sem confirmar tela/reprodução nem repetir automaticamente após falha ou timeout. Esta etapa acrescenta rotas e instruções de ferramentas, sem trocar modelo ou provedor de voz. CI 641/641 e pacote conferidos; abertura/OK pelo cliente Node isolado confirmados pelo usuário, mas pareamento pela interface e voz na TV seguem pendentes. Seleção automática de perfil pelo nome não está implementada. [Configuração](fire-tv.md) e [validação 0.7.0](validation.md#revisão-070--fire-tv-em-validação).

## Revisão 0.6.5 — leitura dos resultados no adaptador YouTube

A correção acrescenta suporte aos cartões modernos de resultados no adaptador local, sem trocar modelo, prompt, chave ou a política de voz. Título e canal devem vir do mesmo cartão visível, com URL de canal validada, sem inventar metadados; publicidade é excluída e o suporte legado permanece. IDs observados e prova do player continuam obrigatórios.

No reteste real 0.6.4, a lista apareceu, mas não tocou. A consulta local limitada e autorizada confirmou busca expirada após 15 segundos, sem `youtube_play` naquela tentativa; não identifica anúncio ou VAD como causa. Verificação local final 0.6.5: **576 testes, 565 aprovados, somente as 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **69/69**, VAD **30/30**. [CI 2aa1ce4 da 0.6.5](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39880425806) aprovado: **576/576 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa. A fixture de cartões modernos com título/canal observado, clique gerenciado por JavaScript e `/watch` → nova busca → segundo vídeo foi executada em HTTPS local com mídia PCM e áudio silenciado; não comprova o YouTube real ou som ouvido. **Teste real 0.6.5 confirmado pelo usuário: o pedido de Thunderstruck/AC/DC buscou, abriu o vídeo e tocou com som.** Esse aceite vale para essa sequência; anúncios, pausa/retomada, outros dispositivos e início no login do Windows continuam sem validação completa. Os retestes reais 0.6.3 e 0.6.4 permanecem reprovados no histórico. [Windows 0.6.5 conferido](../AI_INSTALL.md#pacote-windows-065-conferido). Provas automáticas 0.6.4 abaixo são históricas, com reteste físico reprovado. Voz/música e recepção sem câmera automática são preservados. [YouTube](youtube.md) e [Validação](validation.md).

## Base anterior 0.6.4 — envio da consulta no YouTube

O ajuste é do adaptador de interface do YouTube, não uma troca de modelo, prompt ou chave. O controlador prioriza um clique no botão moderno observado, com fallback restrito, e só devolve resultados após observar URL, consulta e lista reais. Não usa uma URL fabricada como substituto da interação nem repete cliques. As ferramentas e a política de interrupção da 0.6.3 são preservadas.

O reteste real 0.6.3 falhou, com campo/autocomplete na página inicial e sem resultados/reprodução. O cenário de formulário dinâmico reproduzido é compatível com a imagem; não demonstra VAD ou anúncio como causa física. Verificação local 0.6.4: **568 testes, 557 aprovados, 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript e build aprovados. YouTube **61/61**, VAD **30/30**. CI e pacote 0.6.4 aprovados: **568/568 testes, zero falhas/skips**, TypeScript/build e abertura nativa com fixture gerenciada por JavaScript em HTTPS local. O reteste real 0.6.4 foi reprovado, com lista visível e busca expirada antes de tocar; o reteste real 0.6.3 permanece reprovado. [YouTube](youtube.md) e [Validação](validation.md). A prova 0.6.3 abaixo é histórica.

## Revisão 0.6.3 — interrupção durante ferramentas

A correção é do controlador local de voz: **não altera modelo, prompt ou configuração da API**. Com ferramenta ou continuação pendente, `input_audio_buffer.speech_started` silencia TTS sem cancelar efeitos nativos. O evento representa o início de um turno detectado, separado da transcrição. A API documenta os eventos de início/fim em [VAD](https://developers.openai.com/api/docs/guides/realtime-vad); o tratamento de ações abaixo é política do Jarvis.

O cancelamento por fala exige transcrição concluída não vazia e correlacionada ao mesmo `item_id`. Só alcança as execuções/respostas capturadas quando a atividade começou; não deve cancelar uma resposta nova que surgiu depois. Transcrição vazia, falha ou de outro item não cancela a ferramenta. A continuação do resultado não é enviada enquanto a entrada correlacionada está pendente. Fora de ferramentas/continuações pendentes, a interrupção normal de fala é preservada.

**Interromper**, encerrar voz, perfil/reset e X/Sair continuam cancelando imediatamente, sem esperar transcrição. TV ou música que produzam transcrição não vazia ainda podem ser confundidas com fala da pessoa; o filtro não prova identidade ou intenção nem elimina todos os cancelamentos involuntários. Não atribua o relato físico do YouTube a VAD com base somente no defeito reproduzido em código.

Verificação local 0.6.3: **558 testes, 547 aprovados, 11 falhas EPERM anteriores de links/junções no sandbox, zero skips**; TypeScript/build aprovados. Realtime passou **30/30** e controlador/runtime/fábrica YouTube **51/51**. CI e pacote 0.6.3 aprovados: **558/558 testes, zero falhas/skips**, TypeScript/build e abertura nativa em fixture HTTPS local. [Prova e pacote](validation.md). O reteste real do YouTube 0.6.3 falhou: consulta preenchida/autocomplete na página inicial, sem resultados e sem tocar. A imagem e o diagnóstico não demonstram VAD como causa. Provas 0.6.2 são históricas. [Validação](validation.md) e [YouTube](youtube.md).

## Configuração

Abra **Ajustes**, informe sua chave de API no campo de senha e salve. No aplicativo nativo, ela permanece protegida para as próximas aberturas; não é necessário preenchê-la a cada uso. A conexão é com o projeto da sua chave de API OpenAI. Não há login OAuth com ChatGPT ou uso automático da assinatura do ChatGPT. Não envie a chave na conversa, não a inclua em capturas de tela e não crie arquivos de credenciais dentro do repositório. A interface informa apenas se existe uma chave configurada.

| Campo | Padrão | Observação |
| --- | --- | --- |
| Modelo de texto | `gpt-5.4-mini` | Responses, streaming e function calling. |
| Modelo de conversa falada | `gpt-realtime` | Entrada de microfone e saída em texto, com ferramentas. |
| Voz audível | ElevenLabs configurada | Exige chave ElevenLabs e ID privado da voz existente. |
| Limite da sessão | 10 minutos | De 1 a 30 minutos por conexão. Conversa contínua pode renovar após encerramento normal por prazo. |
| Perfil | `default` | Preferências salvas e execução são separadas por identificador. |
| Conversa após a recepção | Desligada | Abre o microfone depois do fim da saudação. |
| Conversa contínua | Desligada | Renova sessão por prazo; não repete recepção e não tenta indefinidamente após erro. |

Os IDs são configuráveis. O catálogo do provedor e as permissões da conta podem mudar; a listagem autenticada de modelos confirma IDs visíveis à conta, sem garantir cada modalidade. A seleção de texto foi verificada na [página oficial GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini). O modelo de áudio segue o [schema oficial de criação de chamadas](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create).

O caminho digitado não gera voz por si só. Na conversa falada, o cliente enfileira trechos de texto para síntese ElevenLabs. Ele não reproduz tracks de áudio inesperadas da OpenAI nem usa uma voz do navegador como alternativa. A configuração legada `voice: marin` pode permanecer armazenada, mas não seleciona a voz audível desta rota.

## Onde fica a chave

No **aplicativo Electron para Windows**, o processo principal usa `safeStorage`: a chave é cifrada pelo mecanismo do sistema, em arquivo privado da pasta de dados do aplicativo, fora do projeto. O renderer recebe a chave apenas no campo de configuração durante a digitação e a envia ao processo principal por uma interface limitada; ela não volta nas respostas de configuração, histórico ou eventos. Essa separação reduz exposição acidental; não protege contra um sistema operacional já comprometido. Se a proteção do sistema não estiver disponível, a gravação deve falhar de forma explícita.

O **modo local de teste no navegador**, iniciado com `npm run test:local` em `http://127.0.0.1:47832`, usa uma chave temporária em memória no servidor local. Não deve salvá-la em `localStorage`, página, bundle, URL ou arquivo. Fechar o processo exige configurar a chave novamente. Esse modo não demonstra persistência cifrada do Electron e não deve ser hospedado na rede. A prévia visual estática, sem bridge de teste, continua sendo apenas uma demonstração da interface.

O serviço OpenAI fala somente com `https://api.openai.com/v1`; a chave permanente aparece apenas no cabeçalho de autenticação dessas requisições. A inicialização de voz usa o fluxo [WebRTC com servidor intermediário](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime), que entrega ao renderer o SDP de resposta, sem entregar a chave.

## O que sai do dispositivo

No modo texto, o provedor recebe a solicitação, o histórico fornecido àquele turno, as preferências explícitas do perfil e os resultados de ferramentas necessários à continuação. Não envie conteúdo privado que não queira processar no serviço externo. A seleção da pasta limita o executor; não equivale a enviar automaticamente todos os arquivos.

Na sessão de voz, o microfone transmite áudio à OpenAI enquanto a conexão estiver aberta, incluindo o silêncio entre comandos e períodos em que a pessoa ainda não terminou de falar. O texto a narrar é enviado à ElevenLabs pelo principal, com credencial própria. Encerrar fecha captura, conexão, síntese pendente e reprodução. A detecção de fim de fala e a transcrição em português fazem parte da configuração. Vídeo e vetores de reconhecimento facial não são incluídos nesses pedidos de conversa.

A análise de roupa foi retirada na 0.6.2. Não há chamada Responses de imagem na recepção, controle de ativação ou endpoints ativos `observeOutfit`/`cancelOutfit`. O valor legado `receptionOutfitEnabled: true` é migrado para `false`. O aplicativo não envia a imagem da câmera ou os vetores faciais como parte da saudação; a prévia manual e o reconhecimento local em Presença continuam disponíveis.

A espera por palmas ou pela palavra nativa é processamento local e não abre uma sessão OpenAI. Ela mantém o microfone ativo enquanto habilitada, cede ao uso de conversa/teste e pausa durante a recepção. Com a opção de conversa após a recepção habilitada, a sessão OpenAI começa somente depois do fim da saudação. Manter a chave salva não abre esse fluxo antes das palmas. Veja [Espera local](standby.md).

As requisições Responses definem `store:false`. Isso evita depender da recuperação de respostas armazenadas para a continuação da tarefa e **não significa retenção zero** para todas as finalidades do provedor. Consulte os [controles de dados oficiais](https://developers.openai.com/api/docs/guides/your-data).

## Pesquisa, páginas e ferramentas da 0.4.0

O mesmo conjunto de ferramentas locais é exposto por function calling ao texto e ao Realtime. `apps_find` encontra IDs observados e `apps_launch` solicita a abertura; `folders_open` abre pastas locais após confirmação. `weather_current` consulta novamente a cidade configurada, independentemente da saudação ou chave de voz. Nenhum desses nomes concede terminal livre ou leitura geral de arquivos. Um resultado `unverified` significa apenas solicitação enviada ao Windows; `observed: process` comprova processo, sem afirmar janela visível.

Para **“abra o navegador”**, `apps_open` com `appId:'browser'` usa a associação padrão do Windows e um destino fixo `https://www.google.com/`, sem segunda confirmação na 0.5.3, somente quando solicitado explicitamente. Não depende de EXE cadastrado. O despacho não comprova janela ou foco; o resultado fica `unverified` sem observação independente. `apps_focus` não oferece foco para esse navegador genérico. Pedidos de Chrome/Edge/Firefox pelo nome usam `apps_find`/`apps_launch`; pedidos de uma URL específica usam `browser_open` para encaminhar o endereço exato ao navegador padrão, sem segunda confirmação; esse despacho não verifica carregamento nem controla suas abas. Essas diferenças devem ser refletidas na resposta, sem afirmar que todos os aplicativos exigem cadastro manual.

`web_search` encapsula uma segunda chamada Responses com o modelo de texto configurado, `tools:[{type:'web_search',external_web_access:true,search_context_size:'medium'}]`, `tool_choice:'required'` e `store:false`. Essa subconsulta envia somente a pesquisa e instruções, sem histórico/memórias; não inclui outras ferramentas locais. Tem limite de 60 segundos, JSON de 1 MiB, saída de 1.500 tokens e texto de 20.000 caracteres. Usa a mesma chave e pode somar cobrança de busca/modelo à conversa. O modelo/conta precisam permitir a ferramenta.

O retorno exige resposta completa, chamada de busca concluída e texto utilizável. Até seis fontes únicas vêm de `output_text.annotations` do tipo `url_citation`; não são criadas a partir de links inventados no texto. Pesquisa sem citações preserva lista vazia. Os links HTTP(S) aparecem clicáveis em uma faixa compacta, inclusive em conversa falada, sem transcrever a fala. Ver [documentação oficial de web search](https://developers.openai.com/api/docs/guides/tools-web-search) e [guia do Jarvis](desktop-access.md).

`web_read` consulta texto de um site público pelo leitor local, sem usar cookies/login ou JavaScript. A leitura não usa chave OpenAI diretamente, mas seu texto pode ser enviado na continuação da conversa para interpretação. Páginas e resultados são dados não confiáveis, sem autoridade para iniciar ações. Abrir uma URL, ler seu texto e pesquisá-la são operações distintas, com confirmação do pedido aplicável.

## Continuidade da conexão de voz

`receptionVoiceEnabled` permite iniciar voz após a recepção; `continuousVoiceEnabled` permite renovar quando uma sessão alcançar seu limite normal de duração configurado. As opções começam em `false`. Enquanto a conversa contínua estiver desejada, cada renovação abre uma conexão nova, sem repetir música ou saudação e sem acionar a câmera. A memória explícita do perfil é recuperada na abertura; o histórico completo da conversa encerrada não é transferido como uma sessão infinita.

Autenticação recusada, falha de rede ou outro erro interrompem o fluxo sem ciclo indefinido de novas tentativas. **Interromper**, troca de perfil, reset ou saída removem a intenção de renovação e liberam o microfone. Uma negociação que terminar atrasada não pode restaurar a escuta ou falar na sessão cancelada. O usuário pode iniciar uma nova conversa quando quiser.

Cada conexão e nova geração continuam sujeitas à disponibilidade, permissões e cobrança da conta API e da ElevenLabs. O limite por sessão é um limite técnico de duração, não um orçamento de uma conversa contínua. A espera local por palmas não transmite áudio à OpenAI; a conversa já conectada transmite. A interface deve deixar esses estados distinguíveis sem transcrever as falas no dashboard.

## Memória e aprendizagem

Preferências são salvas somente por ação explícita e revisável. Antes de responder ou abrir uma sessão de voz, o processo principal obtém `runtime.getSnapshot(profileId).memories`, seleciona apenas os textos e limita o contexto JSON a 8.000 caracteres. Esses textos são marcados como dados: não podem substituir políticas, aprovações ou ferramentas. O histórico enviado pelo renderer aceita apenas mensagens de usuário e assistente; não aceita mensagens de sistema.

Isso é memória recuperada entre sessões. Os pesos do modelo não são retreinados. Uma preferência editada ou apagada passa a valer em novas solicitações; encerre e reinicie a sessão de voz para atualizar o contexto que já foi enviado ao provedor. Trocar o perfil deve encerrar tarefas e conversas incompatíveis antes de carregar os novos dados.

Para continuar uma prévia em outro pedido, o backend também fornece os IDs de até três planos pendentes e três execuções recentes da pasta e perfil ativos. Isso permite reconhecer “aplique aquela prévia” sem depender de o ID aparecer na fala anterior. O contexto é atualizado a cada turno de Responses, limitado e marcado como dado não confiável. A sessão de voz recebe o estado inicial e continua pelos resultados reais de suas ferramentas. Nenhuma referência equivale a autorização; o executor revalida planos e arquivos antes de qualquer efeito ou restauração.

## Continuação, cancelamento e custos

O parser SSE aceita fragmentos UTF-8 divididos pela rede, comentários de heartbeat e eventos em vários chunks. Só uma resposta completada pode iniciar chamadas locais. As ferramentas são processadas em série, com no máximo seis turnos e doze chamadas por solicitação, sem repetição automática de efeitos. A continuação preserva itens completos, inclusive raciocínio cifrado quando fornecido, conforme o [fluxo de raciocínio sem armazenamento](https://developers.openai.com/api/docs/guides/reasoning).

Cancelar propaga um sinal ao transporte e ao executor. Uma solicitação tem prazo total padrão de três minutos, incluindo espera por confirmação. Uma autorização pendente expira junto com esse prazo. Interromper a fala ou desconectar não apaga efeitos que já foram confirmados; consulte o registro antes de repetir uma tarefa.

Responses reporta tokens acumulados por turno. O limite de chamadas e o limite de tempo de cada conexão reduzem execuções acidentais, mas não são um teto monetário garantido. A opção de conversa contínua pode criar sessões sucessivas. A análise de roupa não faz parte da recepção atual. Configure os limites do projeto na plataforma e acompanhe o consumo. Não há valor de custo ou promessa de latência medidos sem uma sessão real com sua conta.

## Erros e diagnóstico

| Situação | Conduta |
| --- | --- |
| Chave ausente | Configure-a em Ajustes. Nenhuma requisição é enviada. |
| Credencial recusada | Confira a chave e o projeto; não copie o erro bruto para o chat. |
| Modelo ou recurso negado | Escolha um ID permitido e compatível na conta. |
| Limite ou saldo | Confira as configurações da plataforma e tente novamente depois. |
| Conexão interrompida | Revise efeitos locais concluídos antes de iniciar outro pedido. |
| Visão local ausente | Texto e voz continuam disponíveis; câmera/identificação têm requisitos separados. |

Os erros do serviço usam códigos e mensagens curtas em português. Corpos de erro do provedor, cabeçalhos de autenticação e exceções internas não são enviados ao renderer. A implementação e os testes se encontram em `packages/openai` e `tests/openai.test.mjs`.

## Voz personalizada e ElevenLabs

A voz GleysonSilva-Jarvis já foi criada no painel com autorização, e amostra/saudação foram ouvidas e aprovadas. **Ajustes → Saudação → Amostra fixa da voz** toca apenas a apresentação gravada. O novo diálogo usa OpenAI para produzir texto e o [serviço de fala ElevenLabs](elevenlabs.md) para gerar novas respostas com a voz configurada, mantendo chave e ID privados.

A configuração da sessão solicita `output_modalities: ['text']`. O renderer bloqueia qualquer track remota inesperada e não a usa como saída alternativa. A síntese é correlacionada por execução/trecho e cancelada com a resposta. Faltando voz/chave ou ocorrendo falha, deve haver erro/texto; nunca uma troca silenciosa para marin ou outra voz. A reprodução mantém 0,95× com altura preservada e efeito metálico fixo 0,78.

Para usar uma voz baseada em gravação **dentro da OpenAI**, também seria necessário confirmar elegibilidade e cumprir o fluxo próprio de gravação separada de consentimento do provedor. A documentação [Custom voices](https://developers.openai.com/api/docs/guides/custom-voices) distingue vozes por descrição de vozes por gravação; nem todos os tipos são compatíveis com Realtime. Um `voice_id` ElevenLabs não é uma voz OpenAI e não pode ser colocado no campo de voz desta sessão. Cada provedor tem sua própria conta, transporte e configuração.

## Validação desta entrega

[CI b8c6c8f da 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovado: **402/402 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. Os testes físicos de abertura do navegador e intervalo entre saudação/comentário ainda estão pendentes. Antecipar a chamada não altera o modelo ou o preset de voz nem comprova uma latência fixa; não há benchmark publicado dessa passagem.

Os testes offline verificam streaming, segurança de erros, memória, ferramentas, cancelamento e timeout com transporte substituído. Os **343 testes e a abertura nativa aprovados no [CI da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110)** são evidência histórica. [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O ensaio físico da recepção e renovação atuais no destino continua pendente; não há p50/p95 publicados. O ensaio antigo confirmou texto e uma resposta Realtime audível com marin, antes da troca para ElevenLabs. O roteiro curto posterior aprovado pelo autor não substitui os testes específicos da nova sequência. Veja [Validação](validation.md) e [Plano de testes](test-plan.md).
