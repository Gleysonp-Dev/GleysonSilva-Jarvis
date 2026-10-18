# Auditoria de assistentes Jarvis e proposta de produto

Referência de pesquisa: 18 de outubro de 2026. Escopo proposto para aprovação.

A oportunidade é construir um assistente para Windows, em português brasileiro, que converse enquanto executa tarefas e permita corrigir uma execução em andamento. A interface deve tornar visíveis o entendimento, o progresso, as evidências e as consequências da correção. OpenAI fornece a inteligência conversacional; reconhecimento facial opcional personaliza a interação localmente.

Voz, memória, uso de ferramentas, demonstração de procedimentos e controle do computador já têm precedentes. A originalidade precisa ser demonstrada em uma experiência específica e em resultados comparáveis. A hipótese de produto é uma linha do tempo de ações corrigível por voz, ligada a procedimentos versionados e verificáveis.

# Alcance da comparação

Esta é uma auditoria documental e de arquitetura baseada em repositórios, documentação oficial, manifestos e políticas públicas. Não é uma certificação de segurança nem um benchmark executado dos projetos. Recursos anunciados pelos autores não equivalem a funcionamento validado. As referências apontam para páginas mutáveis; antes de reutilizar código, fixar commit, licença e versão das dependências.

Não foram atribuídos tempos de resposta a produtos sem medições comparáveis. A qualidade das vozes em português também exige escuta e avaliação controlada.

# Comparação dos projetos

| Projeto | Arquitetura e recursos documentados | Aplicações e integrações | Implicação para nosso MVP |
| --- | --- | --- | --- |
| [sukeesh Jarvis](https://github.com/sukeesh/Jarvis) | Assistente Python orientado a comandos e plugins; voz opcional; foco declarado Linux e macOS | Arquivos, captura de tela, informações do sistema, conversão de documentos e serviços web | Bom catálogo de utilidades. A quantidade de comandos não demonstra conversa contínua ou execução confiável entre aplicações |
| [Microsoft JARVIS](https://github.com/microsoft/JARVIS) | HuggingGPT coordena modelos para resolver tarefas de IA | Modelos e serviços do ecossistema Hugging Face | Referência de orquestração de modelos. Não é uma base direta para assistente desktop de voz |
| [OpenVoiceOS](https://openvoiceos.github.io/beta-technical-manual/architecture-overview/) | Componentes substituíveis para ativação, transcrição, intenções, habilidades e síntese; barramento de mensagens | Extensão por habilidades e plugins | Aproveitar contratos de componentes; verificar idioma e manutenção de cada plugin |
| [Home Assistant Assist](https://contributors.home-assistant.io/core/internals/assist-pipelines/) | Pipeline de voz com etapas e eventos explícitos | Dispositivos e serviços integrados ao Home Assistant | Referência para casa conectada e observabilidade; integrar depois de validar o desktop |
| [Rhasspy](https://github.com/rhasspy/rhasspy) | Assistente privado e offline, com foco em idiomas e comandos; repositório arquivado em 6 de outubro de 2025 | Ecossistema de automação por voz | Útil como referência histórica; evitar como fundação de um produto novo sem plano próprio de manutenção |
| [Leon](https://github.com/leon-ai/leon) | Versão 2 em Developer Preview; caminhos controlados e agentivos, ferramentas e memória | Desktop e navegador, localmente ou via Satellite | Concorrente relevante. A documentação antiga descreve outra arquitetura; usar o estado da branch correspondente |
| [OpenDex](https://github.com/wassgha/opendex) | Electron e React, provedores de fala e modelos substituíveis, permissões por habilidade | Abrir aplicativos e URLs; captura, mouse e teclado mediante habilitação | O visual Jarvis já existe. Permissões e processamento local de fala também não são novidades isoladas |
| [Dodaios](https://github.com/Dodaios/Dodaios) | Antigo Personal Jarvis; voz, agentes, memória local e ferramentas | IDEs e CLIs, desktop, navegador e plugins, incluindo MCP | Sobreposição grande com o objetivo inicial. É preciso competir em um fluxo delimitado e reproduzível |
| [jmtitan Jarvis](https://github.com/jmtitan/Jarvis) | Desktop Windows e núcleo WSL, Whisper, vLLM e respostas por sentença | Conversação, memória e integração com a área de notificação | Mostra o custo de instalação local. Apesar da descrição offline, lista Edge TTS; não presumir cadeia inteira offline |
| [Pipecat](https://github.com/pipecat-ai/pipecat) | Framework de pipelines de voz e multimodalidade | Provedores de áudio, modelos e transportes | Possível infraestrutura; não é um produto de controle de aplicativos pronto |
| [LiveKit Agents](https://github.com/livekit/agents) | Framework para agentes de mídia em tempo real | WebRTC, voz e ferramentas por integrações | Forte para sessões remotas. Avaliar complexidade adicional antes de introduzir no desktop individual |
| [Microsoft UFO](https://github.com/microsoft/UFO) | Agentes voltados à interação com computadores | Aplicações Windows e automação | Referência técnica para controle e observação do desktop; não tratar computer use como novidade |
| [nicolasmafre Projeto Jarvis](https://github.com/nicolasmafre/Projeto_Jarvis) | V3.4 com CLI e web; memória e RAG; GUI Flet adicionada posteriormente | Llama pela API Hugging Face, STT Google e TTS local | Streaming recebido é acumulado antes de retornar; não demonstra conversa de voz em tempo real. Ver análise específica em auditoria-nicolasmafre.md |

# Precedentes que limitam a alegação de inovação

[OpenAdapt](https://github.com/OpenAdaptAI/OpenAdapt) já descreve compilação de demonstrações em procedimentos, revisão humana e verificação de efeitos com recibos. [Understudy](https://understudy-ai.github.io/) anuncia aprendizado por demonstração e habilidades reutilizáveis. [ShowUI Aloha](https://showlab.github.io/Aloha_Page/) apresenta demonstrações convertidas em traços semânticos para novas tarefas. [UFO](https://github.com/microsoft/UFO/blob/main/ufo/README.md) descreve uso de traços, demonstrações e execução especulativa.

Portanto, “ensinar uma vez”, “aprender com o usuário”, “mostrar o que fez” ou “verificar resultados” não sustentam exclusividade. A hipótese a investigar é a combinação abaixo, oferecida como experiência acessível em português:

1. Cada passo aparece numa linha do tempo com intenção, alvo, resultado e reversibilidade.
2. Durante a execução, a pessoa diz “pare, só os arquivos deste mês”.
3. O assistente pausa novos efeitos, identifica quais passos já aconteceram e propõe uma revisão apenas dos passos afetados.
4. Mostra o que pode desfazer, o que exige compensação e o que é irreversível.
5. A correção pode virar uma nova versão do procedimento, mediante aprovação, com um teste de regressão associado.

O diferencial comercial dependerá de a pessoa concluir tarefas com menos correções, menos esforço e mais confiança. Não foi estabelecida ausência dessa combinação em todo o mercado.

# Latência e conversa

O intervalo relevante começa no fim da fala do usuário. Separar cinco medidas: detecção de fim de turno, primeira resposta útil, primeiro áudio inteligível, início da ação e efeito verificado. Um som de confirmação não conta como resposta útil. Encerrar o áudio também não prova cancelamento de uma ação já enviada.

[Pipecat](https://docs.pipecat.ai/pipecat/learn/speech-input) documenta detecção de turnos, VAD e interrupção. [LiveKit](https://docs.livekit.io/agents/logic/turns/) distingue interrupções reais, sinais breves de acompanhamento e falsas interrupções. Essa distinção evita que um “aham” cancele o trabalho, mas o ajuste deve ser testado em português.

O [Home Assistant publicou](https://www.home-assistant.io/blog/2025/02/13/voice-chapter-9-speech-to-phrase/) transcrição inferior a um segundo com Speech-to-Phrase em hardware modesto, usando vocabulário restrito. Isso não mede a conversa completa. O [faster-whisper](https://github.com/SYSTRAN/faster-whisper) compara transcrição de áudio longo e configurações de lote; esses números não demonstram latência de diálogo.

## Metas propostas para o protótipo funcional

| Medida | Meta inicial | Condição |
| --- | --- | --- |
| Fim da fala até resposta falada útil | p50 até 1,2 s; p95 até 2,5 s | Sessão aquecida, conexão estável, comando curto sem pesquisa |
| Interrupção até silêncio do assistente | p95 até 300 ms | Desde o início de fala detectável; medir falsos positivos também |
| Fim da fala até efeito local verificado | p95 até 2,5 s | Comando simples suportado, sem diálogo de confirmação |
| Sucesso da tarefa | Pelo menos 95% | Conjunto fechado de tarefas suportadas, incluindo variantes de fala |
| Identificação de falha | Nenhum sucesso falso no conjunto de liberação | Falhas de foco, timeout, permissão e persistência injetadas |

São critérios de aceitação, ainda não resultados obtidos. Pesquisa web, autenticação e tarefas longas terão tempos próprios. Publicar inicialização fria separadamente.

## Como medir

Usar 100 comandos em português, pronunciados por pelo menos cinco participantes, três repetições por condição. Separar silêncio, ruído ambiente e reprodução por alto-falante; avaliar sotaques, hesitações, siglas, números, nomes de arquivos e alternância entre português e termos técnicos. Registrar CPU, RAM, GPU, microfone, saída de som, versões, região do provedor e rede. Informar tamanho da amostra por cenário, p50, p95, falhas, custo e taxa de sucesso; não agregar situações incompatíveis.

Usar relógio monotônico e IDs de sessão, turno e ação. Medir áudio real de saída, além dos eventos do provedor. Comparar os concorrentes com tarefas equivalentes, mesma máquina quando possível e consentimento de gravação. Não usar vídeos editados como benchmark.

# Fala e personalidade

A sensação de presença virá da coordenação entre fala, ação e interface. Respostas curtas para comandos, explicações maiores quando pedidas, pronúncia testada em português e interrupção consistente têm prioridade sobre frases de efeito.

| Situação | Fala proposta |
| --- | --- |
| Pessoa cadastrada aparece e a saudação está habilitada | “Olá, Gleys. Quer retomar sua última tarefa?” |
| Alvo ambíguo | “Você quer a pasta Projetos ou o arquivo projetos.xlsx?” |
| Ação em andamento | “Encontrei os arquivos. Vou mostrar a prévia da organização.” |
| Resultado confirmado | “Organizei 12 arquivos na pasta que você escolheu.” |
| Resultado incerto | “O comando foi enviado, mas não consegui confirmar a alteração.” |
| Correção no meio da tarefa | “Parei. Três arquivos já foram movidos; vou mostrar o que muda com esse filtro.” |

Evitar narrar cada clique. Saudações terão intervalo mínimo e não devem expor conteúdo privado diante de terceiros. A qualidade da voz será avaliada por inteligibilidade, naturalidade, ritmo, pronúncia e fadiga em uso prolongado.

# Integrações e confiabilidade

Dar preferência a API específica; depois elementos acessíveis da interface; por último, percepção visual. [UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiautocore-overview) expõe controles de aplicações Windows. [Playwright](https://playwright.dev/docs/browsers) opera navegadores suportados, inclusive Chrome e Edge; políticas corporativas podem limitar o controle.

| Alvo inicial | Operações propostas | Verificação |
| --- | --- | --- |
| Aplicativos cadastrados | Abrir e focar | Processo e janela esperados |
| Pasta de trabalho escolhida | Listar, localizar e organizar arquivos com prévia | Destino, contagem e conteúdo esperado; detectar conflitos |
| Navegador em perfil dedicado | Abrir URLs, pesquisar e resumir página selecionada | URL, título e referências do conteúdo |
| Bloco de Notas em cenário suportado | Ditado e correção de texto | Leitura do texto no controle quando disponível |
| VS Code | Abrir projeto cadastrado | Pasta correta e janela correspondente |
| GitHub em fase posterior | Consultar issues e preparar rascunhos | Resultado da API; publicação separada |

“Abrir um aplicativo” e “executar qualquer tarefa nele” são capacidades diferentes. Excel, Outlook, WhatsApp, Spotify e Home Assistant entram por conectores específicos e testes próprios; não serão anunciados como integralmente controláveis na primeira versão.

# Segurança e privacidade

As observações abaixo são requisitos do produto proposto, não vulnerabilidades comprovadas dos concorrentes. O [OpenDex](https://github.com/wassgha/opendex#skills--permissions) documenta controle do computador desabilitado por padrão. A [política do Dodaios](https://github.com/Dodaios/Dodaios/blob/main/SECURITY.md) declara classificação de ferramentas e credenciais protegidas; essas declarações ainda exigiriam validação de implementação. Um git worktree separa arquivos de um checkout, mas não constitui isolamento do sistema operacional.

| Risco | Requisito verificável |
| --- | --- |
| Instruções maliciosas em página ou documento | Conteúdo observado não concede permissão; testar solicitações de exfiltração e alteração de política |
| Fala de televisão ou gravação | Atalho para falar no início; reconhecimento facial não autoriza operações sensíveis |
| LLM gerar comando arbitrário | Ferramentas tipadas e catálogo permitido; sem terminal genérico no MVP |
| Aprovação deixar de corresponder à ação | Vincular aprovação aos argumentos e ao alvo; invalidar ao mudar plano ou contexto |
| Repetição após timeout duplicar efeito | Identificador por ação, consulta ao estado e repetição apenas quando segura |
| Janela ou usuário mudar durante tarefa | Revalidar alvo antes do efeito; pausar diante de ambiguidade |
| Dados privados em áudio, logs ou capturas | Minimização, retenção configurável e exclusão; imagens e áudio sem gravação por padrão |
| Plugin ampliar poderes | Registro explícito, escopos mínimos e política executada fora do modelo |
| Interface local acessível por site malicioso | IPC autenticado ou serviço local com origem validada, proteção contra CSRF e sem escuta pública |

Para MCP, seguir a [documentação de segurança do protocolo](https://modelcontextprotocol.io/docs/draft/tutorials/security/security_best_practices), incluindo validação de autorização, prevenção de token passthrough e riscos de servidores locais. MCP é um protocolo de integração; não oferece isolamento automático.

# Componentes e licenças

| Componente | Fato relevante para distribuição |
| --- | --- |
| [openWakeWord](https://github.com/dscripka/openWakeWord#license) | Código Apache 2.0; modelos incluídos CC BY NC SA 4.0. Não embutir os modelos como se tivessem a licença do código |
| [Piper atual](https://github.com/OHF-Voice/piper1-gpl) | Motor GPL 3.0; conferir separadamente a licença da voz e as obrigações da forma de distribuição escolhida |
| [InsightFace](https://github.com/deepinsight/insightface#license) | Código MIT, mas modelos e dados listados têm restrições de pesquisa não comercial; evitar download automático não revisado |
| [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) e [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) | Candidatos para câmera local; preservar licenças específicas dos diretórios, pesos e avisos do artefato fixado |

Proposta: código próprio Apache 2.0, nome e identidade próprios, inventário de dependências e modelos com versão, origem, hash e licença. A aparência pode evocar ficção científica sem copiar recursos audiovisuais ou vozes de atores.

# Decisão proposta

Aprovar um MVP Windows e português brasileiro, com HUD circular baseado na imagem enviada pelo usuário e modo Foco, OpenAI para voz e respostas, cinco integrações delimitadas, câmera opcional e uma demonstração de correção de procedimento. O nome público fica em aberto. Implementação completa e publicação do repositório dependem da aprovação deste escopo.
