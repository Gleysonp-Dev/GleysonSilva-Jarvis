# Validação do MVP

## Revisão 0.5.0 — recepção, roupa e conversa contínua

Fluxo solicitado: iniciar no login Windows em espera, duas palmas, música e saudação meteorológica aprovadas, uma captura para comentário gentil sobre roupa visível e início automático de comandos por voz. A continuidade renova somente após o prazo local configurado de cada conexão, sem repetir música/saudação/câmera. Interromper, parar voz, trocar perfil/configuração ou fechar deve cancelar captura, síntese, escuta e renovação.

As três opções novas são explícitas e desligadas por padrão. O preset **Ativar recepção completa** prepara a configuração; **Salvar configuração** aplica com as informações de envio à OpenAI/custo visíveis. As chaves API permanecem privadas. A câmera é desligada após um JPEG limitado e antes da requisição; imagem não entra no SQLite, memória ou transcrição. Roupa fora do quadro ou falha não deve gerar elogio inventado.

CI, pacote e ensaio físico da 0.5.0 ainda pendentes. Os testes novos usam áudio, câmera, Windows e OpenAI substituídos, sem capturar imagem ou consumir a conta do autor. A escrita da configuração privada e o acesso ao registro de início do Windows foram recusados neste ambiente; não afirmar que a instalação local ficou configurada. O usuário precisará aplicar o preset no aplicativo nativo.

Verificação local: **388 testes, 377 aprovados e 11 falhas**, zero skips. As falhas são as operações anteriores de link/junção e movimentos dependentes delas recusadas por `EPERM` no sandbox. Nenhuma dessas verificações foi removida ou enfraquecida; o CI Windows normal deve confirmá-las. TypeScript estrito e build aprovados. Os testes novos cobrem ordem da recepção após o fim real da fala, captura/liberação antes do envio, permissão atrasada, formato/limites, opções inicialmente desligadas, preset sem apagar configuração, áudio/perfil correlacionados, interrupção, fechamento, perfil/reset e renovação somente pelo prazo local, sem repetir a recepção ou tentar em loop após erros.

## Revisão 0.4.0 — aplicativos, pastas, web e clima pela conversa

O autor aprovou o núcleo da 0.3.1 antes desta revisão. A 0.4.0 preserva o desenho, a voz a 0,95×, o efeito metálico fixo e a música privada aprovada. Acrescenta descoberta e abertura de aplicativos instalados, abertura de pastas locais, pesquisa e leitura de sites públicos, e consulta meteorológica nova por texto ou voz. O [guia de acesso](desktop-access.md) distingue abertura, leitura e organização.

Verificação local de 20 de outubro de 2026: **343 testes, 332 aprovados e 11 falhas**, zero skips. As 11 falhas são as operações anteriores de link físico/junção e movimentos dependentes delas, negadas pelo sandbox (`EPERM`); não foram removidas ou enfraquecidas. TypeScript estrito e build aprovados. O [CI Windows 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110), commit `475f3f4f9e1326baf79bf308199610741670e0b0`, confirmou **343/343 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real em **20 de outubro de 2026, às 20h48, America/New_York**. O [job 118971573471](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110/job/118971573471) confirmou ready/window/DOM/preload/boot e packaged verdadeiros com perfil temporário e rede/captura/login isolados.

O [artefato 12312007661](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110/artifacts/12312007661) foi baixado e conferido: ZIP **104.026.982 bytes**, SHA-256 `46e0fb0e12d2cbb26902a84e03b25aaf49fc0868bdfd9d5b45fbab8d6bcbd4e4`, igual ao digest do CI. A extração aceitou somente o EXE esperado e seu checksum; **GleysonSilva-Jarvis-0.4.0-Windows.exe**, **104.016.733 bytes**, SHA-256 `002b8131eb1a428c5ff44d6f180613dc029d08b8facdf2529c42dfd388e3e391`, igual ao `.sha256` incluído. Retenção até 18 de janeiro de 2027, horário de Nova York. Não há release assinada.

Os testes novos cobrem descoberta sem lançamento, IDs de aplicativos limitados ao perfil, aprovação imutável, execução única por ID, pasta substituída após aprovação, pedidos apenas encaminhados ao Windows, distinção entre processo e janela observada, consulta meteorológica sem saudação/credencial de voz e sem fallback antigo, busca sem histórico/memórias, fontes clicáveis, limites de dados, cancelamento, DNS fixado, redirecionamentos e destinos privados. As fronteiras OpenAI, Windows e clima usam substitutos controlados; os testes não iniciam aplicativos do usuário nem consomem sua conta.

Uma leitura real de `https://example.com/` pelo transporte de produção retornou **Example Domain**, 156 caracteres e fonte correspondente. Isso confirma o leitor HTTP(S), não comprova qualquer site, acesso autenticado ou uma busca paga. A busca OpenAI foi validada com respostas controladas; disponibilidade/cobrança do modelo na conta e o roteiro falado no computador do autor permanecem para ensaio do novo pacote.

Inspeção no navegador com renderizador real e bridge/dados explicitamente simulados confirmou o núcleo preservado, faixa de fontes fora do log com título/domínio/horário e botão de ocultação, sem transcrição ou abertura automática de Contexto. A prévia não usa microfone ou APIs do usuário.

Roteiro manual: pedir “Abra o Chrome”, escolher quando houver nomes semelhantes, “Abra Downloads”, “Consulte este site: [URL pública]”, “Pesquise [assunto] na internet” e “Como está o tempo agora?”. Conferir autorização, resultado real, fonte e horário. Interromper uma consulta e trocar de perfil não devem entregar fontes antigas ou iniciar ações adicionais. Uma janela apenas encaminhada ao Windows não deve ser anunciada como confirmada.

## Revisão visual 0.3.1 — referência enviada pelo autor

Após testar a 0.3.0, o autor relatou que o roteiro funcionou, mas rejeitou a semelhança do núcleo com a referência. O roteiro proposto abrangia teste de microfone, recepção, conversa por voz e Contexto. Esse relato não acrescenta testes de reconhecimento facial, início no login ou resistência a falsos gatilhos.

O vídeo fornecido, de aproximadamente 49,92 segundos, orientou a reconstrução visual: hierarquia entre fios discretos e dominantes, assimetria, focos na trajetória, campo azul e grade de fundo. A comparação usa especialmente o quadro de aproximadamente cinco segundos no estado de espera. Perspectiva, reflexos e compressão da filmagem impedem certificar igualdade de pixels ou medir com precisão a animação original. O [registro da referência](research/referencia-video-nucleo.md) distingue o núcleo e as integrações mostradas.

Verificação local da 0.3.1: **quatro testes do HUD aprovados**, zero falhas/skips, TypeScript e compilação aprovados. Os testes cobrem reação ao áudio, paleta fixa, limites de atualização/resolução, movimento reduzido e limpeza. A inspeção visual usa o renderizador real com áudio simulado e uma bridge de demonstração; não utiliza o microfone, chaves ou APIs do autor. A voz e o restante dos serviços funcionais permanecem na base anterior.

O [CI Windows da 0.3.1, commit bfcc67b9deebff447cfa112cf755662993002328](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787) aprovou **264 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O [job 118960468252](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787/job/118960468252) confirmou ready, window, dom, preload, boot e packaged verdadeiros em **20 de outubro de 2026, às 20:14, horário de Nova York**. Rede, captura e início no login ficaram isolados nesse ensaio.

O artefato **12310612279** foi baixado e conferido: ZIP de **104.010.427 bytes**, SHA-256 `8d148043d4b736d2fe143cb1db0c369e21dcf185d97c0db1a70a2fba8e954b9e`, igual ao digest do CI. A extração aceitou somente o EXE esperado e seu checksum. O **GleysonSilva-Jarvis-0.3.1-Windows.exe** tem **104.001.614 bytes** e SHA-256 `aba928ffc4132cabf96e41d4f089e9f1f4c677875de0577b76506ae8607949f2`, igual ao `.sha256` incluído. O artefato tem retenção até 18 de janeiro de 2027 no horário de Nova York.

Uma amostragem no navegador local, com o Canvas real e áudio simulado, registrou **240 quadros**, mediana de **1,8 ms** e p95 de **2,3 ms** nas chamadas de desenho, com backing de **950 × 648**. A instrumentação pertence à prévia de trabalho e não é incluída no produto. Ela não mede a apresentação final pela GPU, FPS sustentado em outra máquina ou latência da IA.

O autor aprovou posteriormente o núcleo da 0.3.1 ao pedir a ampliação dos acessos da 0.4.0. Esse aceite visual é separado das verificações automáticas. Não há release assinada ou ensaio completo em instalação limpa.

## Revisão 0.3.0 — núcleo orbital e Contexto sob demanda

Em 20 de outubro de 2026, a revisão acrescenta o núcleo orbital azul original e um painel de leitura com clima e atividade local. Não conecta agenda/e-mail/notícias nem gera um briefing falado combinado.

- Serviços, HUD e ciclo do processo principal: **60 testes aprovados**, sem falhas/skips. O principal real é carregado com Electron/OS substituídos; o clima usa transporte controlado.
- Painel React: **nove testes aprovados**, sem falhas/skips, com componentes reais e hooks controlados. Cobrem atualização, cancelamento, retorno atrasado, fonte ausente e recorte de até 100 execuções; não são execução de navegador.
- Suíte completa local anterior aos nove testes do painel: **255 testes, 244 aprovados e 11 falhas**, sem skips. As 11 falhas ocorreram em operações de link físico/junção/symlink negadas pelo sandbox (`EPERM`), inclusive efeitos de arquivos que dependem desses recursos. Não foram removidos testes nem enfraquecidas as verificações para produzir aprovação. O CI Windows normal deve confirmar esses casos.
- TypeScript estrito e compilação aprovados com as dependências locais. O compilador foi invocado diretamente porque o atalho npm não estava disponível neste ambiente.
- Inspeção no navegador com bridge e dados explicitamente simulados: núcleo visível em espera, zero consultas no carregamento, Contexto somente por clique, fonte meteorológica indisponível sem valores inventados, atividade preservada e cancelamento ao fechar a consulta pendente. As capturas não validam clima real, áudio ou hardware.

O [CI Windows 0.3.0 do commit b032bd37534131b1c08704dd8b96a27621c79fa4](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678) aprovou **264 testes, 264 aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. As 11 operações negadas no sandbox local passaram nesse Windows normal. O [job 118939722750](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678/job/118939722750) confirmou às **23:14:59 UTC de 20 de outubro de 2026** ready, window, dom, preload, boot e packaged verdadeiros. Rede, captura e início no login ficaram isolados.

O artefato **12307285731** foi baixado e conferido: ZIP de **104.011.800 bytes**, SHA-256 `5bfd6ed76348112c599603d0b3014a2e082a68af542c4b0e9e1be7a79c77f9ac`, igual ao digest do CI. A extração aceitou somente o EXE esperado e seu checksum. O executável **GleysonSilva-Jarvis-0.3.0-Windows.exe** tem **104.002.629 bytes** e SHA-256 `01bd3300aacdffe787945475a1373224321c8d462d328e12f7ef35c452b72421`, conferido contra o `.sha256` incluído. A retenção do artefato vai até 18 de janeiro de 2027.

Um ensaio separado consultou a fonte real para uma cidade pública de demonstração, com configuração em memória e saudação desligada. A resolução de rede falhou (`ENOTFOUND`); duas leituras resultaram em `unavailable`, sem clima, horários fabricados ou cache preenchido. Houve zero chamadas de síntese e zero leituras de chave. Esse resultado comprova tratamento de indisponibilidade nesse ensaio, não dados meteorológicos reais disponíveis.

O teste da voz e o aceite visual no equipamento do usuário continuam separados; o preset aprovado não foi alterado por esta revisão. Não há release assinada ou ensaio completo em instalação limpa.

## Correção 0.2.3 — CI aprovado, ensaio físico pendente

O usuário relatou repetição da saudação com o aplicativo aberto e voz continuando após fechar a janela. O processo principal permaneceu ativo e os ajustes de espera/palmas/palavra estavam habilitados. O handler de X ocultava a janela quando a espera estava ligada, sem parar o áudio: essa causa foi localizada no código. A revisão 0.2.3 muda X para encerramento real e torna os detectores mais conservadores. Não há gravação ou registro do evento que identifique qual detector disparou; o novo comportamento ainda requer ensaio físico. Minimizar continua sendo a opção para manter a espera. A remoção das transcrições da revisão 0.2.2 permanece preservada.

Verificação local 0.2.3: 229 testes aprovados, zero falhas e skips, TypeScript estrito e build aprovados. As regressões de fechamento executam os handlers reais do principal com Electron/OS substituídos, incluindo interrupção imediata com worker pendente, cancelamento dos provedores e fechamento concorrente por X/Sair/before-quit. Os filtros acústicos usam sinais/eventos sintéticos; o validador C# foi executado sem abrir o microfone. Essas evidências ainda não equivalem ao ensaio físico no pacote corrigido.

O [CI 0.2.3 do commit 5733b37](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39166025134) concluiu todos os passos com sucesso: **229 testes, 229 aprovados, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O [job 117789021817](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39166025134/job/117789021817) registrou às **21:05:23 UTC** ready, window, dom, preload, boot e packaged verdadeiros. Rede, captura e início no login ficaram isolados. Isso não comprova fechamento durante fala nem ativação física dos filtros.

Os filtros nativos consideram confiança de frase e palavra, duração, acomodação inicial e intervalo entre ativações; são limites heurísticos e escores relativos. Não demonstram eliminação dos falsos positivos nem identificam a origem do evento relatado.

O artefato **12151195524** foi baixado e conferido: ZIP de **104.007.627 bytes**, SHA-256 `6d0fae8269ba83a01e5dbaff383a5a741c2dea3c59bb44c160d2b23c4f93413a`, igual ao digest do CI. A extração aceitou somente o EXE esperado e seu checksum. O executável tem **103.997.753 bytes** e SHA-256 `07b01da2ed2cf30cf1752025b38054fe2550dfb334493bc35d8fd465df7cb45d`, conferido contra o arquivo `.sha256`. Nenhum teste físico de áudio é inferido dessa conferência.

Registro de 18 de outubro de 2026. Este documento separa implementação, testes com substitutos e observação real. **O CI da base 0.2.0, commit 63cf00153dbab0a52cf3f05a82eb9e7fab3ba385, foi concluído com sucesso. O [CI do volume aprovado, e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), também foi concluído com sucesso e gerou o artefato atualizado 12148553183.**

**Abertura nativa 0.2.1 aprovada no CI Windows:** o commit `8a074e738c6792091676702be28d9270edcf884b` passou por 218 testes, TypeScript, build, pacote e execução real do aplicativo empacotado. O usuário confirmou a janela aberta no próprio computador por captura de tela. A falha sem janela do 0.2.0 e o bloqueio por ACL no ambiente Codex são resultados anteriores distintos. **A revisão 0.2.2 está implementada e seu CI foi aprovado com 221 testes e abertura nativa real.**

## Baseline confirmada

| Verificação | Evidência e limite |
| --- | --- |
| CI ba0680 | **147 testes aprovados**, zero falhas; verificação TypeScript, compilação e empacotamento portátil Windows aprovados. [Execução registrada](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39156421498). Não comprova execução física do EXE. |
| CI 0.2.0 — 63cf001 | **214 testes, TypeScript, build e pacote Windows aprovados.** [Execução 39159266409](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409), [job 117768920735](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39159266409/job/117768920735), artefato 12148216729. Base anterior ao ajuste de volume; não comprova execução física. |
| EXE 0.2.0 no equipamento do usuário | **Falhou na abertura:** processo ativo sem janela. Diagnóstico localizado no bootstrap ESM do Electron, antes da interface. |
| Runtime nativo | Electron **44.9.0**, Node **24.22** e SQLite carregando corretamente. Essa verificação não comprova carregamento da interface, hardware ou início no login. |
| CI 0.2.1 — 8a074e7 | **218 testes aprovados, zero skips; TypeScript, build, pacote Windows e abertura nativa real aprovados.** [Execução 39162376494](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39162376494), [job 117778188817](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39162376494/job/117778188817). O teste isolado não valida recursos com dispositivos nem a abertura no PC do usuário. |
| EXE 0.2.1 no equipamento do usuário | **Abertura visual confirmada por captura de tela enviada pelo usuário.** Não comprova áudio do clone em conversa, captura nativa, login ou persistência protegida das chaves. |
| CI 0.2.2 — d72c4887 | **221 testes aprovados, zero falhas/skips; TypeScript, build, pacote e abertura nativa real aprovados.** [Execução 39164458465](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39164458465), [job 117784377613](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39164458465/job/117784377613). Às 20:45:25 UTC o teste confirmou ready, window, dom, preload, boot e packaged. Provedores, captura e login ficaram isolados. |
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
| Pacote 0.2.0 | CI e0d8ddaa concluído com testes, TypeScript, build e artefato Windows aprovados, incluindo o volume aprovado. [Execução](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917); artefato 12148553183. **A execução pelo usuário falhou sem janela; o 0.2.1 corrigido abriu depois.** | Instalação limpa, proteção nativa das chaves e assinatura. |

**O executável 0.2.0 foi executado pelo usuário e falhou antes da janela.** O pacote **GleysonSilva-Jarvis-0.2.1-Windows.exe** teve janela e interface carregadas no CI com Electron real; a captura de tela do usuário confirmou a abertura visual no computador de destino. Essas evidências não comprovam início no login, reconhecimento ou conversa ao vivo. Não há release assinada validada em instalação limpa.

## Correção da inicialização 0.2.1 — abertura aprovada no CI

No Electron 44.9.0, `await app.whenReady()` no topo do módulo ESM bloqueava a avaliação necessária à inicialização: havia processo/lockfile, mas não janela. O ajuste retira a espera do topo e a executa em `startApplication()` assíncrona, com tratamento visível de erro. O problema foi localizado no bootstrap; não foi causado por início automático, dispositivos ou SQLite.

**Verificação local 0.2.1:** 218/218 testes Node aprovados, zero falhas/skips, com Python configurado; TypeScript, build e verificação do processo principal aprovados.

**Ensaio nativo local: BLOQUEADO.** O runner com Electron real copiado, perfil temporário e identificação exclusiva, sem rede/dispositivos/autostart, parou em `install_dir_access.cc:52` antes do código do app. O diretório herdava ACL restrita a um SID AppContainer do ambiente, sem leitura/execução para ALL APPLICATION PACKAGES. A concessão de leitura/execução na pasta pública do aplicativo foi verificada, mas removida pelo ambiente gerenciado entre execuções. O ensaio foi encerrado sem desativar a sandbox.

O bloqueio ambiental não comprova nem refuta a correção. Separadamente, **o CI Windows normal executou o pacote corrigido e aprovou o teste real de abertura**, com a sandbox preservada. O log após aproximadamente dois segundos registrou:

```text
Abertura nativa aprovada: {ready:true,window:true,dom:true,preload:true,boot:true,packaged:true}
```

O artefato **12149680971** tem ZIP de **104.006.107 bytes**, baixado e conferido antes de extrair o executável corrigido. SHA-256 do ZIP:

```text
0f826138640fcd6b6b5061389c26efd0d2c775f0bcc912ec85d393ab1c290824
```

Esse hash identifica o ZIP, não o arquivo EXE isolado. A abertura visual no computador do usuário foi confirmada depois por captura de tela; ensaios nativos com provedores/dispositivos, login e DPAPI continuam pendentes. O CI isolou rede, captura e início no login.

## Revisão visual 0.2.2 — implementada e CI aprovado

O autor pediu que saudação e conversa por voz não acrescentem transcrições ao painel Conversa. A apresentação passa a usar áudio, pulsação e estados, mantendo compacta a atribuição meteorológica. Mensagens digitadas e suas respostas continuam visíveis. Reconhecimento de fala, texto intermediário de síntese e histórico necessário aos provedores permanecem internos; não há alegação de eliminação desses dados do processamento.

A revisão passou localmente por 221 testes, sem falhas/skips, TypeScript e build; o CI do commit `d72c4887eab3cdc301b743e78d314a69f4e1c6f3` também aprovou essas verificações, empacotamento e abertura real do aplicativo. As 218 aprovações anteriores pertencem à base 0.2.1.

Um ensaio visual com serviços substituídos apresentou duas saudações simuladas sem mensagens no painel Conversa e com uma única fonte meteorológica compacta. Após uma pergunta digitada, as duas mensagens normais continuaram visíveis. Esse resultado verifica apresentação; não exercita provedores, microfone ou áudio do clone. A captura desse ensaio permanece privada.

O CI gerou o artefato **12149933875**, ZIP de **104.007.384 bytes**, com digest informado `sha256:fd9ee94b83a2f9469e15c6e9db46352c015878963e836f4a29b767ec701618dd`. Esse registro não afirma conclusão do download ou da conferência local do novo ZIP.

A gravação de referência, a cidade, as credenciais, o identificador da voz e a música recebida permanecem privados. O GitHub contém a documentação e o [MP3 de apresentação autorizado](../assets/voice/jarvis-demo.mp3). O [aviso de distribuição](../assets/voice/README.md) aplica-se a esse MP3, não à trilha privada, a toda a pasta de dados ou a um modelo exportável de voz. A música não é distribuída no repositório nem no pacote.

## Histórico relevante

O primeiro CI revelou divergência entre caminhos Windows 8.3 e canônicos. A correção foi reproduzida mantendo a rejeição de junções. O [CI f42472f](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39152788680) aprovou verificação/empacotamento; depois, ba0680 aprovou a baseline de 147 testes.

Um ensaio de clima revelou tela vazia ao renderizar um objeto de atribuição como filho React. O contrato/componente foram corrigidos e receberam quatro regressões de renderização e recuperação. A recuperação não repete a síntese.

A origem do áudio também foi distinguida: a amostra de apresentação é fixa; a recepção com clima usa o serviço de saudação. Reproduzir uma gravação aprovada não comprova nova consulta ao tempo.

## Próximo aceite

A abertura visual do pacote 0.2.1 já foi confirmada pelo usuário; a revisão 0.2.2 passou pelo ensaio visual com serviços substituídos e a 0.2.3 passou pelo CI e abertura nativa isolada. Próximo passo: ensaiar X durante fala/música/conversa, ausência de nova ativação após encerrar e minimizar mantendo a espera. Depois conferir a conversa OpenAI → texto → ElevenLabs, captura/liberação de microfone no nativo, gatilhos isolados e combinados, pausa/retorno, música na recepção ao vivo, início no login e persistência DPAPI. Abertura da janela e aprovação da prévia musical não substituem esses testes.

Não há p50/p95 de latência nem comparação de superioridade publicados. Use [o plano de testes](test-plan.md) para registrar conta, dispositivo, superfície, falhas e medições sem dados privados.
