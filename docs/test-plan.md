# Projeto GleysonSilva-Jarvis: validação e critérios de lançamento

A 0.6.0 prepara a ponte privada Ultron → Jarvis local com cinco ferramentas MCP. Validar protocolo, permissão local explícita, acesso em tarefa compatível e resultados físicos separadamente. Verificação local: 491 testes, 480 aprovados, 11 falhas EPERM conhecidas de links/junções no sandbox e zero skips; TypeScript/build aprovados. O plugin privado foi instalado e habilitado pela CLI oficial, com listagem conferida. CI/pacote, recarregamento em nova conversa, habilitação da ponte e teste pelo próprio Dot permanecem pendentes. [Fluxo e limites](ultron.md).

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
| Texto OpenAI | Pergunta real respondida corretamente. | Benchmark, custo e latência comparável. |
| Microfone | Captura com nível e liberação observadas. | Detector de palmas ou palavra. |
| Câmera | Prévia real 640×480 e parada. | Reconhecimento: OpenCV e pesos ausentes. |
| Voz Realtime anterior | Resposta ouvida pelo usuário, em marin. | Nova rota de saída ElevenLabs com o clone desejado. |
| Saudação/áudio | Narração aprovada a 0,95× com altura preservada e efeito metálico fixo 0,78. | Conversa nova, login ou ativação automática. |
| Ajustes no navegador | Opções nativas de login/palavra desabilitadas; espera exige voz/chave/cidade; opções salvas preservadas. | Funcionamento do registro de login ou reconhecedor Windows. |

O [registro de validação](validation.md) apresenta os limites e o histórico, incluindo o roteiro curto aprovado pelo autor. **A nova sequência integrada com login, palmas, música, roupa e conversa contínua ainda exige ensaio físico.** A prévia musical já foi aprovada; isso não comprova o fluxo integrado. Os cenários a seguir são testes a executar, não uma lista de sucessos já observados.

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
| Ultron local 0.6.0 | MCP limitado, validação/autoridade da ponte, estado ocupado antes de TTS, correlação, ACK de fim do áudio e cancelamento. | Transporte/serviços substituídos não comprovam instalação, disponibilidade no Dot, navegador visível ou som ouvido. |
| OpenAI SSE | Deltas progressivos, fragmentos UTF-8, heartbeats, JSON inválido, resposta incompleta e uso de tokens. | Respostas de rede simuladas; não mede um modelo. |
| Ferramentas via modelo | Continuação com itens completos, chamadas conhecidas, argumentos JSON, IDs repetidos e limite de turnos. | Valida protocolo e delegação; não comprova software externo. |
| Interrupção | Abort chega a transporte e runtime, inclusive aprovação pendente; não ocorre novo turno após cancelamento/timeout. | Efeitos já realizados dependem do registro do executor. |
| Contexto de memória | Recuperação pelo perfil backend, limite de 8.000 caracteres e marcação como dado não confiável. | Não é treino de pesos nem defesa perfeita de linguagem natural; a política de ferramentas é a barreira efetiva. |
| Continuidade de prévias | Um novo pedido recupera `planId` do backend, sem depender de IDs no texto; contexto limitado, isolamento de perfil e cancelamento antes de envio. | Referências não autorizam execução; planos, pasta e arquivos são revalidados pelo executor. |
| Erros e chave | Falta de chave não abre rede; erros HTTP, transporte e ferramenta não ecoam a credencial de teste. | Credencial usada apenas no teste; não demonstra DPAPI real. |
| Realtime | FormData/SDP, saída em texto, VAD, ferramentas e bloqueio de saída de áudio OpenAI. | Não cria uma chamada paga e não captura áudio real. |
| Recepção 0.5.0 | Sequência, opções separadas, um único quadro, limpeza antes do envio, passagem à voz e cancelamento em cada etapa. | Dispositivos/serviços substituídos não comprovam roupa descrita nem som ouvido. |
| Preparação de roupa 0.5.1 | Início somente após reprodução efetiva da saudação, captura/observação/síntese antecipadas uma vez, áudio retido até o fim da saudação e cancelamento de resultados tardios. | Relógio/captura/provedores substituídos não medem intervalo audível, permissão ou rede reais. |
| Navegador padrão 0.5.1 | Abertura genérica sem EXE cadastrado, confirmação com nome/destino, chamada externa fixa, falha/cancelamento e resultado de despacho não verificado. | Callback Windows substituído não demonstra qual navegador ou janela abriu na máquina. |
| Imagem OpenAI | JPEG/dimensões/tamanho limitados, detalhe baixo, sem ferramentas/histórico, cancelamento e erros sanitizados. | Não mede a interpretação visual do modelo na conta de destino. |
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

## Recepção completa e conversa contínua — 0.5.1

Use o executável novo em caminho estável, com chaves e cidade configuradas privadamente. A música precisa ter sido escolhida naquela instalação. Registre versão, dispositivos, opções e resultado; não publique imagens, chaves, ID da voz, caminho da música ou detalhes pessoais.

| Ensaio | Evidência esperada |
| --- | --- |
| Instalação limpa | Login, espera, roupa, voz após a recepção e conversa contínua não ativados silenciosamente; opções novas começam em `false`. |
| Salvar configuração e reabrir o nativo | Opções persistem; chaves permanecem configuradas sem redigitação e sem aparecer em histórico/eventos. Não confundir com o teste HTTP, cuja chave é temporária. |
| Login com espera/palmas habilitados e palavra desligada | Aplicativo em espera/bandeja, microfone local armado; nenhuma música, saudação, câmera ou sessão OpenAI antes das palmas. |
| Duas palmas e disparo concorrente | Uma única recepção, música e cumprimento pelo horário/clima; sem repetição por TV, própria narração ou um segundo gatilho durante o fluxo. Registrar falsos positivos/negativos em ambiente real. |
| Fim da saudação | Música termina. Se roupa e conversa estiverem desligadas, nenhum dispositivo/provedor novo é iniciado. |
| Roupa habilitada e saudação ainda em preparação | Controle informa envio à OpenAI; nenhuma captura ou observação antes do início efetivo da reprodução. Negação de reprodução/gesto não inicia a câmera por antecipação. |
| Saudação começa a tocar, roupa habilitada | Uma captura JPEG de até 640×480 e 512 KiB, tracks encerradas antes do pedido; observação e síntese começam durante a saudação. Nenhum vídeo persistente nem imagem gravada em banco/log/arquivo. |
| Comentário preparado antes do fim da saudação | Áudio permanece retido enquanto a saudação toca. Após seu fim e o da música, começa em seguida, sem fala sobreposta ou temporizador de pausa artificial. Medir o intervalo realmente ouvido. |
| Observação/síntese ainda pendente ao fim da saudação | Aguarda somente a preparação restante; nenhuma captura, chamada ou geração duplicada. Registrar intervalo, falha e condição de rede, sem prometer zero latência. |
| Roupa visível em luz e enquadramento habituais | Comentário breve coerente com peças/cores visíveis, narrado pelo clone aprovado, sem música ou transcrição. Não aceitar identidade ou inferências pessoais como parte do resultado. |
| Imagem insuficiente, outra pessoa ao fundo ou rosto sem roupa visível | Limitação honesta e neutra; sem elogio inventado, identificação ou divulgação de dados do perfil. |
| Câmera negada/ocupada, modelo incompatível, chave inválida ou rede ausente | Aviso útil, captura liberada, sem corpo bruto de erro. A etapa de voz ainda pode começar se habilitada/disponível. Não repetir a captura em loop. |
| Conversa após a recepção habilitada | Microfone WebRTC somente após saudação/comentário; pergunta inédita respondida com a voz aprovada e núcleo pulsando, sem novas palmas ou transcrição. |
| Conversa contínua desligada | Conexão termina no prazo configurado, sem reiniciar por conta própria. |
| Conversa contínua ligada, prazo local configurado | Uma nova conexão por encerramento elegível, sem repetir música/saudação/imagem; novo comando responde. Registrar limites de continuidade do histórico. |
| Falha de autenticação/rede durante negociação ou sessão | Estado de erro e microfone liberado; nenhuma cadeia indefinida de reconexões. |
| Interromper durante permissão de câmera, captura, observação, síntese ou negociação/renovação | Toda etapa futura cancelada; nenhuma fala, câmera ou microfone reaberto por resultado tardio. Verificar também concessão tardia da permissão. |
| Interromper/reset/perfil/saída com comentário já preparado durante a saudação | Áudio antecipado descartado; nunca começa após o fim ou cancelamento da fala anterior. Câmera concedida tardiamente é encerrada, sem envio. |
| Perfil/reset/configuração/saída durante o fluxo | Gerações antigas invalidadas, sem elogio, ferramenta ou sessão no perfil novo. X encerra som, captura, worker e processo. |
| Desativar início no Windows | Registro removido e nenhum lançamento no próximo login. |

A conversa contínua transmite áudio enquanto conectada, incluindo o silêncio entre comandos. Registre duração e consumo real por provedor; a opção não promete sessão infinita, memória ilimitada ou orçamento máximo. Não use sucesso de parser/tempo simulado como comprovação de conexão prolongada real.

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
| Passagem da saudação para roupa | Fim audível da saudação | Primeiro som audível do comentário. Registrar também início da captura, retorno do modelo e fim da síntese para separar trabalho antecipado da espera restante. |
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
Roupa: opção explícita, início da reprodução da saudação, quadro único, vídeo encerrado antes do envio, áudio preparado/retido, intervalo audível, resultado e descarte
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
