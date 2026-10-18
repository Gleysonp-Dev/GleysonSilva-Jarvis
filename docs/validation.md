# Validação do MVP — baseline 0.2.0 e correção 0.2.1

Registro de 18 de outubro de 2026. Este documento separa implementação, testes com substitutos e observação real. **O CI da base 0.2.0, commit 63cf00153dbab0a52cf3f05a82eb9e7fab3ba385, foi concluído com sucesso. O [CI do volume aprovado, e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), também foi concluído com sucesso e gerou o artefato atualizado 12148553183.**

**Falha de abertura real confirmada:** o usuário executou o EXE 0.2.0 e nenhuma janela apareceu. A correção 0.2.1 está preparada e passou nas verificações locais; o ensaio nativo local foi **bloqueado por permissões do ambiente antes de carregar o aplicativo**. Não há abertura corrigida confirmada. O novo CI Windows 0.2.1 está pendente; os testes/empacotamento 0.2.0 não detectaram o bloqueio original.

## Baseline confirmada

| Verificação | Evidência e limite |
| --- | --- |
| CI ba0680 | **147 testes aprovados**, zero falhas; verificação TypeScript, compilação e empacotamento portátil Windows aprovados. [Execução registrada](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39156421498). Não comprova execução física do EXE. |
| CI 0.2.0 — 63cf001 | **214 testes, TypeScript, build e pacote Windows aprovados.** [Execução 39159266409](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409), [job 117768920735](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409/job/117768920735), artefato 12148216729. Base anterior ao ajuste de volume; não comprova execução física. |
| EXE 0.2.0 no equipamento do usuário | **Falhou na abertura:** processo ativo sem janela. Diagnóstico localizado no bootstrap ESM do Electron, antes da interface. |
| Runtime nativo | Electron **44.9.0**, Node **24.22** e SQLite carregando corretamente. Essa verificação não comprova carregamento da interface, hardware ou início no login. |
| Python opcional | Protocolo e pré-processamento testados com Python 3.12 e backend substituído. Não executa a rede facial real. |
| Servidor local funcional | Interface e serviços usados em loopback no navegador. O ensaio em 47833 usa chaves em memória, sem comprovar persistência protegida do Electron. |
| Interface e clima | Saudação real com tempo/previsão e atribuição exibida. Regressões React cobrem a atribuição estruturada; recuperação não repete automaticamente a síntese. |
| Aceite visual | Dashboard limpo, HUD ciano constante e controles funcionais aprovados pelo autor. Amostra fixa separada em Ajustes. |
| OpenAI texto real | Uma pergunta recebeu resposta correta no ensaio com a conta configurada. Sem benchmark de qualidade, custo ou latência. |
| Microfone físico | Stream real, nível de entrada observado e dispositivo liberado ao encerrar o teste. Isso não valida detecção de palmas ou palavra de ativação. |
| Câmera física | Prévia real **640×480** observada e encerrada. Não equivale a identificação de pessoa. |
| OpenAI Realtime anterior | Resposta audível confirmada pelo usuário, porém a saída era a voz OpenAI **marin**, diferente da desejada. Este teste motivou a substituição do caminho de saída; não valida a nova conversa com ElevenLabs. |
| Clone ElevenLabs | Voz do projeto criada de fato no painel, com autorização para clonagem e distribuição dos áudios selecionados. Referência, chave e ID privados. |
| Amostra real | MP3 de 137.309 bytes gerado pelo painel com Eleven Multilingual v2, 44,1 kHz/128 kbps. Não foi produzido por uma chamada real da CLI. Frase fixa disponível em Ajustes, sem clima atual. |
| Áudio aprovado | Saudação completa, tom metálico fixo **0,78** e reprodução **0,95× com altura preservada** aprovados pelo autor. A síntese continua com velocidade 1. |
| Verificação de áudio local | OfflineAudioContext produziu sinal processado finito e diferente da entrada; bypass interno preservou entrada e silêncio permaneceu silêncio. Captura real da amostra a 0,95×: 7,94 s, expectativa 7,92 s, pico 0,735, sem saturação ou amostras não finitas. |
| Prévia da saudação aprovada | Captura da referência completa: 16,86 s, pico 0,764, amostras finitas. Conserva o boletim do momento da gravação; não é uma nova consulta meteorológica. Uma repetição ao vivo recebeu HTTP 429; o limite foi mantido. |
| Reconhecimento facial | **Indisponível no equipamento de ensaio:** OpenCV e os pesos YuNet/SFace ausentes. Não houve identificação real, calibração, acurácia ou prova de vida demonstradas. |

Os testes de arquivos exercitam efeitos reais em diretórios temporários descartáveis. Testes de provedores substituem o transporte de rede e verificam contratos/erros. A observação com contas e hardware da tabela foi feita separadamente; não deve ser atribuída à suíte offline.

## Revisão 0.2.0: implementado, ainda em validação real

**Verificação local concluída:** 214 testes aprovados, zero falhas e zero skips, com Python configurado; TypeScript estrito, compilação e verificação do processo principal aprovados. Os três testes adicionais de integração do App exercitam hooks/controlador reais e detector local com provedores substituídos: capacidade disponível antes de novo render, no máximo uma permissão de microfone pendente ao pausar/retomar e cancelamento da preparação abortando o serviço de saudação antes de rearmar. Não equivalem a fala/palmas ou login físicos. O CI da base 0.2.0 também foi aprovado; o CI da mudança posterior de volume também aprovou testes, verificação e pacote Windows.

**Inspeção no navegador:** controles de início no login e palavra nativa ficaram corretamente desabilitados no teste HTTP; a espera exigiu voz, chave e cidade; opções salvas foram preservadas. Isso valida apresentação/configuração, sem comprovar System.Speech ou login real.

| Recurso novo | Implementação | Aceite ainda pendente |
| --- | --- | --- |
| Conversa com a voz Jarvis | Entrada OpenAI Realtime, saída de texto, síntese ElevenLabs com a voz configurada e áudio local a 0,95×/efeito fixo. Áudio OpenAI desativado e tracks inesperadas bloqueadas. | Pergunta/resposta realmente ouvida com o clone, interrupção, erros, retomada e liberação em sessão completa. O teste anterior com marin não vale como esse aceite. |
| Ausência de troca de voz | Falta de configuração bloqueia a sessão falada; falha de síntese mantém erro/texto, sem selecionar voz OpenAI ou do navegador. | Ensaio real de falha e confirmação de que nenhuma voz alternativa toca. |
| Espera por palmas | Detector adaptativo local, intervalo de 150–800 ms e proteção entre ativações, com testes sintéticos e de limpeza. | Microfone real, ruído, fala comum, falsos positivos, segundo plano e retorno após saudação. |
| Palavra “Jarvis” | Worker Windows System.Speech offline compilado e eventos testados com processo substituído. Consulta real, sem abrir o microfone, enumerou um reconhecedor en-US instalado. | Reconhecimento físico da palavra, confiança e retorno da espera. A enumeração do idioma não valida o gatilho pelo microfone. |
| Início e bandeja | Opções opt-in `startAtLogin` e `standbyEnabled`; registro no login para pacote Windows e controle de espera. | Entrada real na conta, início em espera, bandeja, desativação e saída. Não é funcionamento antes do login. |
| Pausa da escuta | Coordenação para suspender espera durante narração/música e uso ativo do microfone. | Ausência de autoativação pela própria fala e retorno correto depois do fim/interrupção. |
| Música privada | MP3 de aproximadamente 13 MB importado privadamente. **Prévia atual ouvida e aprovada pelo usuário:** 17,8577 s, pico 0,7772, RMS 0,08711, amostras finitas e sem clipping. App ajustado para 0,35 na introdução e 0,22 sob a fala; TypeScript/build aprovados e preset de voz preservado. Nenhuma trilha padrão é distribuída. | CI do ajuste aprovado. A aprovação auditiva da prévia não comprova reprodução/fim na recepção ao vivo, login ou ativação. |
| Pacote 0.2.0 | CI e0d8ddaa concluído com testes, TypeScript, build e artefato Windows aprovados, incluindo o volume aprovado. [Execução](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917); artefato 12148553183. **A execução pelo usuário falhou sem janela.** | Correção 0.2.1 e teste real de abertura; instalação limpa, proteção nativa das chaves e assinatura. |

**O executável 0.2.0 foi executado fisicamente e falhou antes da janela.** O pacote corrigido previsto é **GleysonSilva-Jarvis-0.2.1-Windows.exe**, ainda em teste de abertura. Um artefato de CI não comprova interface carregada, início no login ou reconhecimento offline. Não há release assinada validada para distribuição.

## Correção da inicialização 0.2.1 — preparada, abertura ainda não confirmada

No Electron 44.9.0, `await app.whenReady()` no topo do módulo ESM bloqueava a avaliação necessária à inicialização: havia processo/lockfile, mas não janela. O ajuste retira a espera do topo e a executa em `startApplication()` assíncrona, com tratamento visível de erro. O problema foi localizado no bootstrap; não foi causado por início automático, dispositivos ou SQLite.

**Verificação local 0.2.1:** 218/218 testes Node aprovados, zero falhas/skips, com Python configurado; TypeScript, build e verificação do processo principal aprovados.

**Ensaio nativo local: BLOQUEADO.** O runner com Electron real copiado, perfil temporário e identificação exclusiva, sem rede/dispositivos/autostart, parou em `install_dir_access.cc:52` antes do código do app. O diretório herdava ACL restrita a um SID AppContainer do ambiente, sem leitura/execução para ALL APPLICATION PACKAGES. A concessão de leitura/execução na pasta pública do aplicativo foi verificada, mas removida pelo ambiente gerenciado entre execuções. O ensaio foi encerrado sem desativar a sandbox.

Esse bloqueio ambiental não comprova nem refuta a correção do bootstrap. O novo CI Windows normal deverá executar o teste real de abertura, confirmar janela/renderer e encerrar o processo. Resultado desse CI e abertura corrigida ainda pendentes; gerar o pacote ou observar um PID não cobre a regressão.

A gravação de referência, a cidade, as credenciais, o identificador da voz e a música recebida permanecem privados. O [aviso de distribuição](../assets/voice/README.md) aplica-se ao MP3 de voz selecionado, não à trilha privada, a toda a pasta de dados ou a um modelo exportável de voz.

## Histórico relevante

O primeiro CI revelou divergência entre caminhos Windows 8.3 e canônicos. A correção foi reproduzida mantendo a rejeição de junções. O [CI f42472f](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39152788680) aprovou verificação/empacotamento; depois, ba0680 aprovou a baseline de 147 testes.

Um ensaio de clima revelou tela vazia ao renderizar um objeto de atribuição como filho React. O contrato/componente foram corrigidos e receberam quatro regressões de renderização e recuperação. A recuperação não repete a síntese.

A origem do áudio também foi distinguida: a amostra de apresentação é fixa; a recepção com clima usa o serviço de saudação. Reproduzir uma gravação aprovada não comprova nova consulta ao tempo.

## Próximo aceite

Primeiro confirmar abertura e carregamento da interface no 0.2.1 com Electron real, registrar o teste isolado de inicialização no CI e ensaiar o pacote corrigido. Depois executar a nova conversa OpenAI → texto → ElevenLabs, palmas, reconhecedor Windows, pausa/retorno, música na recepção ao vivo e início no login. O CI e0d8ddaa e o aceite auditivo da prévia musical estão concluídos; não comprovaram abertura nativa nem esses recursos.

Não há p50/p95 de latência nem comparação de superioridade publicados. Use [o plano de testes](test-plan.md) para registrar conta, dispositivo, superfície, falhas e medições sem dados privados.
