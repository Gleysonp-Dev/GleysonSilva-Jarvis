# Arquitetura — Projeto GleysonSilva-Jarvis

O MVP 0.3.0 separa interface, leitura de contexto, comunicação com modelos, síntese de fala, política de execução e reconhecimento facial. O modelo interpreta e propõe ferramentas; o executor decide quais operações aceita e registra o resultado. Texto gerado não confirma efeito no computador. Conversa, gatilhos nativos e nova apresentação ainda precisam de validação real completa.

## Componentes e fronteiras

```mermaid
flowchart LR
    Pessoa[Pessoa] --> UI[React + HUD Canvas]
    UI --> Bridge[Bridge limitada / preload]
    Bridge --> Main[Processo principal Electron]
    Main --> Context[ContextService: leitura sob demanda]
    Context --> Weather[Open-Meteo: clima validado]
    Context -->|Perfil confiável e resumo limitado| Runtime
    Main --> Provider[Serviço OpenAI]
    Provider --> Responses[Responses: texto e ferramentas]
    UI -->|Microfone WebRTC após ativação| Realtime[OpenAI Realtime]
    Realtime -->|Texto e ferramentas| UI
    Provider -->|Negociação SDP| Realtime
    UI -->|Trechos de texto e IDs| Main
    Main --> Speech[Controlador de fala ElevenLabs]
    Speech -->|Áudio da voz configurada| UI
    UI --> Standby[Palmas locais e música privada]
    Main --> Wake[Worker Windows System.Speech]
    Main --> Runtime[Política + executor local]
    Runtime --> DB[(SQLite privado)]
    Runtime --> Files[Pasta autorizada]
    Runtime --> Apps[Adaptadores Windows]
    Runtime --> Browser[Navegador dedicado]
    Main --> Vision[Serviço facial principal]
    Vision -->|Pipe privado| Worker[Python YuNet + SFace]
    Vision --> Protected[Cadastro protegido pelo sistema]
```

| Camada | Responsabilidade | Não recebe como autoridade |
| --- | --- | --- |
| Renderer | Conversa, núcleo orbital azul, cartões de contexto, captura, WebRTC, fila/reprodução de fala, palmas e aprovações. | Chave salva, Node, shell ou embeddings faciais. |
| Preload | Expor métodos explícitos, filtrar IPC e entregar eventos. | Código arbitrário fornecido pelo modelo ou página. |
| Processo principal | Validar origem/argumentos, guardar configuração, ligar serviços, vincular perfil e cancelar sessões. | Um perfil escolhido unilateralmente por uma ferramenta. |
| Provider OpenAI | Responses/Realtime, streaming, memória recuperada e delegação de ferramentas. | Autoridade para ignorar a política local. |
| Controlador de fala | Texto limitado, síntese ElevenLabs, correlação e cancelamento por geração. | Poder de executar ferramentas ou trocar silenciosamente de voz. |
| ContextService | Clima e atividade local observados, com fonte, horário e estados parciais. | Perfil recebido da interface, autoridade para agir ou acesso a chaves de voz. |
| Runtime | Limites de pasta, confirmação, idempotência, efeitos e registro persistente. | Instruções embutidas em arquivos, seleção de página ou texto de memória. |
| Worker facial | Detectar, alinhar e extrair vetores de um quadro. | Nomes, chaves, banco de tarefas ou acesso à rede. |

O Electron usa `contextIsolation`, sandbox e `nodeIntegration:false`. A interface é servida pela origem própria `jarvis://app`; o processo principal aceita IPC somente do frame principal esperado. Navegações, janelas e permissões passam por regras específicas. O navegador dedicado tem uma sessão separada e não recebe a bridge do aplicativo.

## Texto e ferramentas

1. A interface envia texto, um histórico limitado, perfil e identificador de execução.
2. O principal confirma o perfil ativo e abre um controlador de cancelamento.
3. O serviço recupera preferências explícitas do perfil e envia o contexto necessário à OpenAI. Memória e conteúdo observado são tratados como dados.
4. O parser recebe SSE incremental, incluindo fragmentos de UTF-8. A interface acrescenta os deltas à mensagem correspondente.
5. Uma resposta completada pode solicitar uma ferramenta conhecida. Argumentos são validados contra o contrato local.
6. Quando houver efeito que exige decisão, o runtime publica uma proposta. A aprovação pertence àquela execução, perfil e geração da sessão.
7. O adaptador executa e informa sucesso verificado, falha ou resultado não verificado. O serviço entrega o resultado ao modelo para a continuação.

O provider limita turnos, quantidade de ferramentas e prazo total. Repetir uma chamada já registrada não repete automaticamente seu efeito. Erros externos e nativos são convertidos em mensagens curtas; cabeçalhos, chave e corpos brutos não voltam à interface.

## Voz, pulsação e interrupção

A conversa falada começa pelo controle de voz. O renderer pede microfone, cria `RTCPeerConnection` e envia SDP ao principal. O principal negocia com chave protegida e devolve SDP. O microfone segue para a OpenAI no WebRTC; a sessão solicita saída em texto e ferramentas. Qualquer track de áudio remota inesperada é desativada/encerrada, sem reprodução.

Trechos completos do texto são enfileirados para `packages/speech`, com perfil, execução e ID de trecho. O principal valida a configuração, sintetiza na ElevenLabs e retorna áudio limitado, sem chave/ID de voz. O cliente prepara/reproduz os trechos em ordem; cancelamento invalida a geração e seus resultados atrasados. Eventos `.done` não enfileiram uma nova fala. Erro de síntese mantém texto/aviso; não troca para voz OpenAI ou do navegador.

Captura e fala local possuem analisadores. No 0.3.0, o núcleo mecânico ciano dá lugar a uma composição orbital original de filamentos e partículas azuis, com centro vazio. O matiz permanece azul nos estados; envelopes de áudio alteram luz e pulsação, e ferramentas usam uma cadência própria. O Canvas limita resolução e reduz movimento conforme a preferência do sistema. A narração mantém reprodução fixa 0,95× com altura preservada e efeito 0,78. O teste de microfone é local, sem provedor. A conversa completa com essa saída e a nova composição ainda exigem aceite real.

O cliente deduplica eventos e `call_id`. Uma chamada de função é delegada à bridge; o resultado volta como `function_call_output`. Só uma continuação ainda ativa dispara `response.create`. Respostas interrompidas não podem reiniciar a tarefa quando um resultado atrasado chega.

Interromper solicita `response.cancel`, aborta síntese/reprodução e cancela execuções pendentes. Cada resposta usa nova execução; um identificador cancelado não é reaproveitado. Resultados atrasados não podem voltar a falar ou agir. Efeitos completos permanecem no registro; cancelamento não reverte o passado.

Encerrar voz libera microfone, tracks remotas, contexto de áudio, conexão e temporizadores. O limite de sessão é de um a trinta minutos. Mudança de configuração/perfil publica `session.reset`; a interface fecha voz, teste de microfone, câmera e aprovações anteriores.

## Espera, login e recepção

`startAtLogin` e `standbyEnabled` começam desligados. O pacote Windows pode registrar seu executável estável para iniciar depois do login. Quando configurado para espera, o app aguarda gatilho; não é serviço antes do login. O principal mantém bandeja, pausa/retorno e worker offline System.Speech limitado à palavra “Jarvis”, dependente de idioma instalado.

O renderer analisa duas palmas por Web Audio, sem enviar áudio à nuvem; o worker de palavra também é local. Esses gatilhos não abrem conversa OpenAI. Antes de recepção/música e durante uso ativo do microfone, o controlador pausa a espera. A captura retorna somente se a intenção de espera continuar ativa; limpeza e gerações descartam callbacks antigos.

O serviço de saudação usa relógio do PC, coordenadas privadas e Open-Meteo, com atribuição. A síntese usa a mesma voz ElevenLabs. Cancelar também aborta a preparação no backend. Uma fonte musical privada pode acompanhar a recepção até fim/interrupção; a prévia com o arquivo fornecido foi aprovada, mas não há faixa padrão distribuída nem aceite físico completo do fluxo integrado.

Detecção real, segundo plano, idioma, login e retorno não foram aprovados fisicamente. Navegador não altera login nem oferece o worker nativo. Consulte [Espera](standby.md).

## Contexto sob demanda — 0.3.0

O painel **Contexto** chama `readContext({ timezone })` pela bridge limitada. O principal valida origem e campos, captura o perfil das configurações confiáveis e mantém uma consulta cancelável. `cancelContext()` interrompe a leitura; uma nova consulta substitui a anterior. Troca de configuração/perfil, encerramento e descarte do painel invalidam resultados atrasados. O harness local oferece o mesmo contrato, mantendo as verificações de origem e token.

`packages/context` reúne duas fontes independentes: `StartupGreetingService.readWeather()` e um resumo do snapshot de execuções do perfil. A leitura explícita de clima funciona com a saudação desativada, sem carregar chave ElevenLabs, sintetizar, tocar música ou abrir microfone/câmera. `prepare()` preserva a saudação aprovada e reutiliza a mesma consulta/cache de clima.

O clima é consultado no endpoint fixo Open-Meteo. Unidades, faixas, código meteorológico, data local e atualidade são validados. O cache em memória dura até dez minutos para as mesmas coordenadas, fuso e data; a observação atual deve ter no máximo três horas, com tolerância limitada para relógio futuro. Respostas inválidas ou fora do prazo não viram estimativas. A interface recebe valores validados, cidade, fonte/atribuição, horários e indicação de cache; a resposta de contexto não contém coordenadas, chaves ou ID de voz. Os estados são `ok`, `not_configured` e `unavailable`.

A atividade local resume até cem registros recentes do perfil e apresenta até oito entradas, com ferramenta conhecida, estado e horário. Contagens referem-se ao recorte observado; argumentos, resumos livres, caminhos, memórias e procedimentos não saem nessa resposta. Uma falha de fonte preserva a outra; mudar de perfil descarta o conjunto em andamento. Esse histórico de execuções não é uma agenda.

Os cartões aparecem somente no painel solicitado e não acrescentam transcrições à conversa, narração ou contexto automático ao modelo. Calendário, e-mail, notícias e briefing combinando essas fontes continuam no roadmap, sem conexão ou dados simulados apresentados como reais.

## Arquivos e resultados verificáveis

A organização opera somente no primeiro nível da pasta autorizada. A proposta agrupa extensões e pode filtrar pela data de modificação do mês atual. A prévia apresenta os movimentos antes de qualquer alteração.

O runtime rejeita caminhos externos, links/junções e arquivos que não satisfazem suas regras. Antes do efeito, registra a identidade e o conteúdo do arquivo. O movimento evita sobrescrita de destino; a sequência e os estados ficam registrados. Divergência ou efeito parcial exige revisão em vez de anúncio de sucesso.

Restauração é uma proposta separada, baseada no histórico dos movimentos. Arquivo alterado, destino ocupado ou identidade divergente provocam recusa. Ao reiniciar, tarefas pendentes tornam-se interrompidas e não são retomadas automaticamente.

Os adaptadores Windows aceitam um conjunto pequeno de ações e aplicativos cadastrados. O fato de iniciar um processo pode ser insuficiente para confirmar a pasta ou janela exibida; nesses casos o resultado permanece não verificado. Não existe terminal livre nem automação visual universal.

## Memória e persistência

SQLite mantém memórias por perfil, tarefas, procedimentos, chamadas, planos, passos e eventos. A recuperação de preferências alimenta pedidos novos e sessões de voz novas; não atualiza os pesos dos modelos. Uma sessão de voz já aberta precisa ser reiniciada após mudança relevante de contexto.

Memória pode ser adicionada diretamente pelo usuário ou proposta pelo modelo com confirmação. O painel permite revisão e exclusão. O armazenamento de procedimentos existe como base para evolução; um editor completo e versionamento de procedimentos ainda pertencem ao roadmap.

O banco e sua pasta são privados em relação ao repositório, mas isso não significa que todo o SQLite está cifrado. Preferências, tarefas e detalhes de efeitos devem ser tratados como conteúdo pessoal. Alguns textos privados são omitidos do registro de eventos; isso não substitui uma política completa de exportação e retenção.

## Câmera e identidade

O painel Presença pede acesso ao vídeo somente por clique. A prévia pode funcionar sem Python ou pesos. Com o backend disponível, um quadro reduzido segue ao principal e ao worker por pipe privado. O worker detecta com YuNet, alinha cinco pontos e extrai vetores SFace normalizados. Ele não grava a imagem nem recebe nomes.

O principal mantém o cadastro protegido e aceita o reconhecimento somente com margem, limiar e consistência temporal. Cadastro exige três amostras consistentes. Múltiplos rostos, desconhecidos ou ambiguidade preservam uma apresentação neutra. O renderer recebe dados de apresentação; não recebe embeddings.

A pessoa confirma o perfil sugerido. Reconhecimento não autentica, não libera dados e não concede permissão para ferramentas. Webcam RGB não oferece prova de vida. Fechar o painel cancela o ciclo, descarta respostas antigas e libera a câmera.

## Dados e modos de execução

| Dado | Electron para Windows | Teste local no navegador |
| --- | --- | --- |
| Chaves OpenAI/ElevenLabs | Protegidas por `safeStorage` no principal; arquivo fora do checkout. | Temporárias na memória do processo local. |
| Memórias e tarefas | SQLite privado do aplicativo. | Dados locais de ensaio, excluídos do Git. |
| Pasta operada | Selecionada explicitamente, com fallback privado de trabalho. | `local-data/workspace`, pasta de ensaio gerada. |
| Programas Windows | Adaptadores limitados e executáveis cadastrados. | Indisponíveis. |
| Conversa | Microfone enviado à OpenAI; texto da resposta enviado à ElevenLabs. | Mesmo fluxo com ambos os provedores configurados. |
| Teste de microfone | Análise local sem sessão paga. | Análise local sem sessão paga. |
| Contexto | Clima Open-Meteo e atividade local sob demanda; sem captura ou síntese. | Mesmo contrato, com fontes reais configuradas ou estados de indisponibilidade. |
| Espera | Palmas e palavra locais; microfone ativo se habilitado. | Palmas locais, sujeito a limites de segundo plano; sem palavra nativa/login. |
| Música | Fonte privada escolhida pelo usuário. | Não há arquivo padrão; o ensaio não comprova seletor nativo. |
| Rostos | Fluxo local opcional; cadastro protegido pelo mecanismo do sistema. | Não comprova a proteção/persistência nativa do Electron. |

Chaves permanentes não chegam ao bundle nem retornam em `boot()`. Texto, memórias e resultados necessários podem sair para a OpenAI; texto narrado vai à ElevenLabs e coordenadas do clima à Open-Meteo. `store:false` não equivale a retenção zero. Configuração legada de voz OpenAI não seleciona a saída audível atual. A síntese nunca amplia a autoridade das ferramentas.

## Verificação e limites atuais

Testes offline cobrem contratos, streaming, cancelamento, arquivos, fala, gatilhos e protocolo facial com backends/dispositivos substituídos. O ensaio real anterior confirmou texto OpenAI, captura/liberação de microfone, webcam 640×480 e saída OpenAI marin ouvida. Esta última motivou a nova rota de voz, ainda sem aceite real completo. OpenCV e pesos faciais permanecem ausentes.

O histórico registra 214 testes locais no 0.2.0; a abertura do pacote foi corrigida no 0.2.1 e confirmada visualmente pelo usuário. O 0.2.3 teve 229 testes e abertura nativa aprovados no CI Windows. Esses resultados pertencem às respectivas versões. Resultados e limitações da revisão 0.3.0 devem ser associados à execução/commit no [registro de validação](validation.md); não equivalem a ensaio de dispositivos, login ou identificação real.

O [plano de testes](test-plan.md) define ensaios separados com conta, microfone, som audível, webcam, pessoas voluntárias, arquivos descartáveis e instalação limpa. O [roadmap](roadmap.md) usa essas evidências como critério para ampliar capacidades.
