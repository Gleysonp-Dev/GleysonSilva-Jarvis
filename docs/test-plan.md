# Projeto GleysonSilva-Jarvis: validação e critérios de lançamento

Este plano cobre a revisão 0.2.2 em preparação e distingue verificações automáticas de ensaios com Windows, dispositivos e contas OpenAI/ElevenLabs. O novo CI dessa revisão ainda não foi confirmado. Passar nos testes offline não comprova latência, reconhecimento facial, som audível ou ativação nativa.

## Evidências já registradas

| Evidência | Resultado confirmado | O que não comprova |
| --- | --- | --- |
| CI ba0680 | 147 testes, verificação, build e artefato portátil aprovados. | Novo CI 0.2.0 e execução física do EXE. |
| Revisão 0.2.0 local | 214 testes aprovados, zero falhas/skips, com Python configurado; TypeScript estrito, build e verificação do processo principal aprovados. | Provedores pagos, microfone/palavra/palmas e login real. |
| Abertura 0.2.1 | CI com 218 testes e abertura real de janela/DOM/preload/boot; captura de tela do usuário confirmou a janela no próprio computador. | Nova revisão 0.2.2, conversa com clone, microfone nativo, login e persistência DPAPI. |
| Texto OpenAI | Pergunta real respondida corretamente. | Benchmark, custo e latência comparável. |
| Microfone | Captura com nível e liberação observadas. | Detector de palmas ou palavra. |
| Câmera | Prévia real 640×480 e parada. | Reconhecimento: OpenCV e pesos ausentes. |
| Voz Realtime anterior | Resposta ouvida pelo usuário, em marin. | Nova rota de saída ElevenLabs com o clone desejado. |
| Saudação/áudio | Narração aprovada a 0,95× com altura preservada e efeito metálico fixo 0,78. | Conversa nova, login ou ativação automática. |
| Ajustes no navegador | Opções nativas de login/palavra desabilitadas; espera exige voz/chave/cidade; opções salvas preservadas. | Funcionamento do registro de login ou reconhecedor Windows. |

O [registro de validação](validation.md) apresenta os limites e o histórico. **Conversa real com o clone, captura nativa, palmas, palavra, login, DPAPI e música na recepção ao vivo permanecem pendentes.** A prévia musical já foi aprovada; isso não comprova o fluxo integrado. Os cenários a seguir são testes a executar, não uma lista de sucessos já observados.

## Testes automáticos

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
| OpenAI SSE | Deltas progressivos, fragmentos UTF-8, heartbeats, JSON inválido, resposta incompleta e uso de tokens. | Respostas de rede simuladas; não mede um modelo. |
| Ferramentas via modelo | Continuação com itens completos, chamadas conhecidas, argumentos JSON, IDs repetidos e limite de turnos. | Valida protocolo e delegação; não comprova software externo. |
| Interrupção | Abort chega a transporte e runtime, inclusive aprovação pendente; não ocorre novo turno após cancelamento/timeout. | Efeitos já realizados dependem do registro do executor. |
| Contexto de memória | Recuperação pelo perfil backend, limite de 8.000 caracteres e marcação como dado não confiável. | Não é treino de pesos nem defesa perfeita de linguagem natural; a política de ferramentas é a barreira efetiva. |
| Continuidade de prévias | Um novo pedido recupera `planId` do backend, sem depender de IDs no texto; contexto limitado, isolamento de perfil e cancelamento antes de envio. | Referências não autorizam execução; planos, pasta e arquivos são revalidados pelo executor. |
| Erros e chave | Falta de chave não abre rede; erros HTTP, transporte e ferramenta não ecoam a credencial de teste. | Credencial usada apenas no teste; não demonstra DPAPI real. |
| Realtime | FormData/SDP, saída em texto, VAD, ferramentas e bloqueio de saída de áudio OpenAI. | Não cria uma chamada paga e não captura áudio real. |
| Fala ElevenLabs | Preset aprovado, IDs de execução/trecho, fila, cancelamento, limites e ausência de fallback de voz. | Rede e áudio substituídos; não comprova o clone ouvido em conversa. |
| Espera/palmas | Duas transientes, intervalo, adaptação, cooldown, rejeição de envelopes sustentados e limpeza da captura. | Sinais e dispositivos sintéticos; não mede falsos positivos no ambiente real. |
| Login/palavra Windows | Opções opt-in, caminho do pacote, protocolo do worker, idioma ausente e cancelamento. | APIs/processos substituídos; não altera um login real nem reconhece voz física. |
| Música | Fonte explícita, reprodução, volume e limpeza após erro/parada. | AudioContext/HTMLAudio substituídos; a prévia privada aprovada é uma evidência separada da recepção integrada. |
| Integração App | Hooks/controlador reais: capacidade no boot, uma única permissão pendente durante pausa/retorno, cancelamento abortando preparação e rearmando espera. | Provedores/captura substituídos; não comprova ativação física ou áudio ouvido. |
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
5. Troque perfil, encerre e atinja o limite da sessão. Confira cancelamento da síntese, fechamento de áudio/microfone e ausência de fala da geração anterior.

Registrar tempo até o primeiro som, falhas e consumo por provedor. Não substituir esse ensaio pelo teste de saudação ou pelo MP3 público.

## Espera, ativação e música

1. Em configuração limpa, confirme `startAtLogin: false` e `standbyEnabled: false`. Instalar não deve registrar login nem deixar o microfone aberto. Ative somente com escolha explícita e recepção configurada.
2. Com palmas escolhidas, use duas palmas entre 150–800 ms. Teste uma palma, intervalos inválidos, três palmas, repetição durante cooldown, fala, TV, teclas e ruído. Registre falsos positivos/negativos; não extrapole de sinais sintéticos.
3. No Windows nativo, teste “Jarvis” com reconhecedor de idioma instalado, e indisponibilidade sem reconhecedor. Não permitir migração silenciosa para Web Speech em nuvem. O teste HTTP deve manter o recurso nativo indisponível.
4. Durante a saudação e eventual música, confira que a espera está pausada e o próprio áudio não reativa o assistente. Após fim/interrupção, confirme retorno apenas se ainda habilitada. Testar microfone/conversa ativa deve suspender a captura de espera concorrente.
5. Minimize, mude de janela, bloqueie/desbloqueie e retome suspensão. Verifique sinais e timers no pacote; registrar limitações do navegador separadamente.
6. Pause/retome na bandeja, feche para bandeja quando configurado e saia de fato. Sair deve liberar captura e worker. Troca de perfil deve invalidar callbacks antigos.
7. Use o arquivo musical privado já recebido e aprovado em prévia. Não há faixa padrão. Confirme início da trilha, volume/ducking, fim junto da saudação, cancelamento, erro de arquivo e ausência de reprodução residual. Não publicar trilha ou caminho.

## Início no login e executável Windows

Em um pacote Windows em caminho estável, habilite início ao entrar na conta, confirme registro observado e faça logout/login real. O app deve iniciar em espera quando configurado; não deve narrar antes do gatilho. Não confundir esse recurso com ligar o PC ou funcionar antes de login.

Teste desativação, novo login sem lançamento, mudança/ausência do caminho portátil e falha do registro. No desenvolvimento/navegador, o controle nativo deve ficar indisponível e não alterar o sistema. Verifique pacote limpo, chaves protegidas, câmera/microfone liberados e saída sem processo órfão.

Este ensaio ainda não foi realizado fisicamente; sucesso do empacotamento no CI não o substitui. Veja [Espera local](standby.md).

## Medição comparável

Para cada modelo e dispositivo, grave pelo menos 30 solicitações repetíveis por cenário e mantenha o mesmo protocolo entre versões. Separe ensaio frio de aquecido e registre falhas junto com os tempos; não exclua silenciosamente tentativas lentas.

| Medida | Início | Fim |
| --- | --- | --- |
| Primeiro texto | Envio do pedido | Primeiro delta visível. |
| Primeiro áudio | Fim da fala percebido no cliente | Primeiro som efetivamente reproduzido. |
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
Espera: palmas/palavra, idioma, ruído, pausa/retorno e segundo plano
Login Windows: pacote/caminho, entrada real e desativação
Música: não fornecida / arquivo privado testado, fim e cancelamento
Identificação real: dependências/pesos, cenários e resultados
Ações: prévia, confirmação, resultado, cancelamento e restauração
Latência: quantidade, p50/p95 e método
Limitações ou falhas em aberto:
```

Antes de publicar uma release, execute instalação limpa, inicialização sem chave, atualização de configuração, empacotamento Windows e encerramento do processo. Não inclua chaves, base privada SQLite, rostos, imagens pessoais, gravações de voz, caches, arquivos de ensaio ou modelos baixados automaticamente no repositório público.
