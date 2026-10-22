# Roadmap — Projeto GleysonSilva-Jarvis

## Revisão atual 0.6.2 — recepção simples e nova validação do YouTube

Retirar câmera/comentário de roupa da recepção e migrar a preferência antiga para `false`, preservando Presença manual, voz, clima, música e login configurado. Validar a sequência **duas palmas → música/saudação → comandos por voz**, sem imagem enviada à OpenAI. No YouTube, rever espera natural de anúncio, player de conteúdo visível, comparação inicial de progresso e preservação da janela em timeout; cancelamento e perfil continuam interrompendo. O usuário confirmou busca na 0.6.1, mas relatou falha ao tocar; a causa ainda não foi determinada. **CI, pacote e ensaio ao vivo 0.6.2 pendentes.** A verificação local está registrada em [Validação](validation.md). [Validação](validation.md) e [YouTube](youtube.md).

As seções de versões anteriores registram o histórico, incluindo o comentário de roupa existente na 0.5.x. Esse recurso não deve ser reativado na instalação atual.

## Histórico: correção de uso e espera — 0.5.1 com CI aprovado

Abrir o navegador padrão sem cadastro manual, mantendo a autorização, e antecipar câmera/análise/síntese da roupa enquanto a saudação toca. A reprodução do comentário espera o fim da saudação; nenhuma captura ou chamada extra é adicionada a uma recepção normal. Preservar configurações/voz/música, cancelamento e limpeza de recursos. [CI b8c6c8f da 0.5.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovado: **402/402 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. Teste físico da correção no destino ainda pendente. A 0.5.0 abaixo é o histórico da recepção anterior.

## Histórico: recepção e conversa contínua — 0.5.0 com CI aprovado

Fluxo implementado: login Windows em espera → duas palmas → música e saudação com clima → uma captura para comentar roupa visível → comandos por voz. Continuidade opcional renova a sessão após seu prazo local, sem repetir a recepção. Interromper/erro/fechamento/perfil interrompem o fluxo. As três opções novas começam desligadas; o preset de Ajustes é aplicado somente ao salvar, com informação do envio de imagem/áudio à OpenAI. [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O ensaio físico no destino ainda está pendente. [Recepção](startup-greeting.md), [configuração e espera](standby.md), [validação](validation.md). Os resultados da 0.4.0 abaixo são históricos.

O [código-fonte é público](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). O incremento **0.4.0 está disponível**, com [CI 475f3f4 da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110) aprovado com **343/343 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real: descoberta/abertura de aplicativos instalados, pastas locais, leitura/pesquisa web, tempo atual e fontes compactas. O núcleo 0.3.1 foi aprovado pelo autor e é preservado. Essa base teve **264/264 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real aprovados no [CI bfcc67b9](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787), em 20 de outubro de 2026, às 20h14, America/New_York. A revisão anterior 0.3.0 teve **264 testes, TypeScript, build, pacote e abertura nativa real aprovados no [CI b032bd3](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39513420678)**; o usuário aprovou seu roteiro funcional curto, mas reprovou o núcleo daquela revisão. As provas históricas não validam as novas ferramentas. Resultados por execução/commit ficam em [Validação](validation.md). Não há release assinada ou validação completa em instalação limpa.

A direção atual preserva o dashboard limpo, saudação completa, efeito metálico fixo 0,78 e reprodução a 0,95× com altura preservada. O núcleo aprovado da 0.3.1 compõe dez curvas de intensidades distintas, deformação assimétrica, focos luminosos e campo azul sobre grade plana ampla, com centro sem texto novo. A paleta ciano/azul é fixa nos estados. A implementação própria usa o [vídeo específico do autor como referência](research/referencia-video-nucleo.md), sem reutilizar código ou assets do projeto de referência. Superioridade, exclusividade e vantagem de latência dependem de comparação reproduzível; não são resultados demonstrados.

## Incremento com CI e pacote aprovados — 0.4.0

- Descobrir aplicativos instalados por nome e abrir somente IDs observados, com confirmação do aplicativo escolhido.
- Abrir pastas existentes em unidades locais acessíveis, após confirmar o caminho, sem ampliar leitura/organização fora da pasta de trabalho.
- Ler texto público HTTP(S) sem JavaScript/login/cookies e pesquisar na web hospedada OpenAI após confirmação. A busca usa chave/modelo existentes, pode consumir a conta e não inclui histórico/memórias na subconsulta.
- Consultar o tempo atual com atualização explícita para a cidade configurada, sem iniciar saudação/TTS/música ou recorrer a previsão antiga como atual.
- Mostrar até seis fontes compactas fora do log, sem transcrições de voz ou cartões automáticos. Separar aberturas apenas enviadas ao Windows de conclusões verificadas.
- CI/pacote/abertura nativa aprovados. Registrar os ensaios das ferramentas no equipamento de destino e pesquisa paga na conta, com versão/commit identificados. O guia [Aplicativos, pastas, web e clima](desktop-access.md) descreve pedidos, confirmações e limites.

## Base visual aprovada — 0.3.1

- Aproximar o desenho das curvas, focos e campo de fundo do vídeo fornecido, mantendo áudio/pulsação e movimento reduzido.
- Preservar saudação, voz, Contexto e ferramentas; esta revisão não adiciona integrações domésticas ou outras fontes.
- CI e abertura nativa real concluídos; [pacote Windows 0.3.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39519770787/artifacts/12310612279) baixado, com ZIP e EXE verificados por hash. O autor aprovou o núcleo. O **GleysonSilva-Jarvis-0.3.1-Windows.exe** é a base anterior e não contém as ferramentas da 0.4.0; o EXE 0.3.0 continua somente como revisão histórica do desenho rejeitado.

## Incremento implementado — 0.3.0

- Primeira composição orbital de filamentos e partículas azuis, com pulsação ligada a escuta, fala e execução; o núcleo visual foi reprovado pelo autor e é substituído na 0.3.1. Redução de movimento e limite de resolução são preservados.
- Painel **Contexto** sob demanda: clima validado com fonte, horário e cache; atividade de execução do perfil em recorte de até cem registros, com até oito entradas visíveis. Nenhuma transcrição, captura ou síntese é iniciada por essa consulta.
- Leitura independente da saudação, cancelamento e descarte de respostas após troca de perfil/configuração. Fonte ausente ou indisponível aparece com seu estado real.

Esse primeiro incremento ainda não combina calendário, e-mail ou notícias. O próximo briefing deve reunir fontes reais autorizadas com leitura limitada, origem e atualidade explícitas; sem conexão, deve informar a ausência. Uma futura narração desse briefing será uma etapa separada, mantendo a saudação aprovada e o dashboard limpo.

## Base atual

| Área | Código e observações registradas | Próximo aceite |
| --- | --- | --- |
| Interface e saudação | Narração e núcleo 0.3.1 aprovados; apresentação sem transcrições preservada. Fontes compactas da 0.4.0 ficam fora do log. | Validar novos links/consultas em sessão real, preservando voz e limpeza visual. |
| Núcleo 0.3.1 e Contexto | Núcleo de dez curvas, focos e grade plana ampla aprovado; Contexto preservado, com fontes e limites explícitos. | Testar clima, indisponibilidade, cancelamento e troca de perfil com cenários identificados. |
| OpenAI texto | Resposta correta com conta real. | Ferramentas, limites, falhas, custo e latência em amostra maior. |
| Entrada e saída de voz | Microfone real com nível/liberação; resposta OpenAI Realtime anterior ouvida em marin. | Nova rota de conversa com a voz ElevenLabs configurada, sem saída OpenAI alternativa. |
| Voz Jarvis | Clone criado; amostra e recepção aprovadas a 0,95×/efeito fixo. | Respostas dinâmicas, interrupção e retomada em sessão real. |
| Espera 0.2.0 | Código de palmas locais, palavra System.Speech, login opt-in e pausa da escuta. | Dispositivo real, idioma, falsos positivos, segundo plano, retorno e login no pacote Windows. |
| Fechamento e filtros 0.2.3 | X alterado para silenciar e destruir a janela imediatamente, com encerramento compartilhado; filtros mais conservadores testados com substitutos e CI aprovado. | Ensaio físico do fechamento durante áudio, minimizar/retorno, gatilhos e ruído. Não se sabe qual detector causou a repetição relatada. |
| Música | Arquivo privado recebido; prévia atual com saudação ouvida/aprovada, ganho 0,35/0,22. | Testar recepção ao vivo e encerramento. Não há trilha padrão distribuída. |
| Presença | Webcam real 640×480 e parada confirmadas. | Instalar OpenCV/pesos opcionais e ensaiar identificação voluntária. |
| Execução | Organização em pasta limitada preservada; 0.4.0 acrescenta descoberta/abertura nativa, pastas locais e consultas web com confirmação. Abertura não amplia leitura/organização. | Ensaios Windows das novas ferramentas, resultados unverified, recusas, cancelamentos e fontes. |
| Distribuição | CI histórico 0.3.1 aprovado com 264/264 testes, pacote/abertura real e hashes conferidos. CI 0.4.0 aprovado com 343/343 testes, pacote/abertura real e hashes conferidos. | Ensaiar as ferramentas no destino, instalação limpa, recursos nativos, microfone, proteção das chaves e assinatura. |

A revisão 0.2.0 revelou bloqueio por `await app.whenReady()` no topo ESM do Electron 44.9.0, apesar do CI de empacotamento aprovado. A revisão 0.2.1 corrigiu o bootstrap e passou por 218 testes e pelo [teste nativo real no CI 8a074e7](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39162376494): janela, DOM, preload e boot do pacote confirmados. O bloqueio por ACL no ambiente local é um ensaio separado; não ocorreu no CI. A captura de tela do usuário confirmou a abertura visual no próprio computador.

Consulte [Validação](validation.md) para limites das evidências e [Plano de testes](test-plan.md) para os cenários.

O [CI d72c4887 da revisão 0.2.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39164458465) manteve o teste nativo e aprovou todos os passos. A ausência de transcrições foi verificada com serviços substituídos; conversa com o clone, microfone nativo, login e DPAPI continuam exigindo ensaio físico.

A revisão 0.2.3 preserva a apresentação sem transcrições. Seu [CI 5733b37](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39166025134) aprovou todos os passos, incluindo abertura nativa real. Os novos limites de confiança nativa são relativos e heurísticos, sem garantia de eliminar ativações indevidas; o próximo aceite usa áudio e dispositivos reais.

## 1. Fechar a validação da conversa

A interface do **GleysonSilva-Jarvis-0.2.1-Windows.exe** já abriu no computador do usuário. O CI inclui teste com Electron real e pacote, perfil temporário e identificação exclusiva, sem rede/captura/início no login; carregamento e encerramento foram aprovados nas revisões históricas indicadas. Manter essa regressão nas novas versões: gerar artefato ou observar um processo, isoladamente, não cobre a falha.

- Confirmar resposta adequada e narração pelo clone aprovado, com áudio/pulsação e sem transcrições visíveis de voz ou saudação. Preservar mensagens digitadas e suas respostas.
- Manter OpenAI Realtime com saída em texto; impedir áudio inesperado de uma voz OpenAI.
- Preservar o reconhecimento e histórico internos necessários, sem confundi-los com a exibição no painel.
- Testar interrupção durante geração, fila, reprodução e ferramenta pendente.
- Tratar falha da ElevenLabs com estado de erro visível, sem transcrição da resposta ou troca silenciosa de voz.
- Confirmar liberação do microfone, áudio e conexões no fim, troca de perfil e erro.
- Medir primeiro texto, primeiro som e fim após interrupção com conta/dispositivo identificados.

**Aceite:** pessoa confirma a voz realmente ouvida, interrupções não reproduzem trechos antigos e as falhas são visíveis. Aprovação da amostra fixa não substitui esse teste.

## 2. Validar recepção em espera no Windows

- Habilitar espera e início no login somente por escolha explícita.
- Testar palmas com ruído/fala e reconhecedor offline “Jarvis” no idioma instalado.
- Suspender escuta durante sua fala/música e ceder o microfone à conversa ativa.
- Verificar pausa/retorno, bandeja e retomada após suspensão. Minimizar mantém a espera; X e Sair devem parar áudio/captura imediatamente e encerrar o aplicativo, sem nova ativação.
- No pacote Windows em caminho estável, testar entrada real na conta e desativação do registro.
- Usar a música privada já recebida e aprovada em prévia; conferir fim/cancelamento na recepção ao vivo.

**Aceite:** funciona no aplicativo empacotado, sem confundir login com boot antes do login nem teste sintético com reconhecimento real. Veja [Espera](standby.md).

## 3. Tornar instalação e distribuição reproduzíveis

- Manter Node 24, dependências fixadas, documentação e licença.
- Executar o CI atualizado e registrar quantidade, falhas e skips por commit.
- Ensaiar o EXE em máquina limpa, sem chave, depois com configuração privada.
- Confirmar proteção das chaves, origem da bridge, encerramento e ausência de dados privados no pacote.
- Criar configuração guiada por etapas para cidade, provedores, microfone e saída, com teste observável e falhas compreensíveis; esse fluxo guiado ainda não está implementado.
- Definir assinatura e atualização antes de apresentar distribuição pronta.

**Aceite:** outra pessoa instala e reproduz o resultado pelo README. Código público e artefato de CI não equivalem a release nativa validada.

## 4. Comparar qualidade e latência

Usar pelo menos 30 pedidos repetíveis por cenário, separando inicialização fria/aquecida, espera humana e ferramenta. Registrar p50/p95, máximo, sucesso/falhas, rede, hardware, modelos e consumo observado. Incluir tentativas lentas e erros.

Avaliar português, sotaques, nomes, sobreposição, ruído e retomada. Preservar o preset de voz aprovado salvo novo pedido do autor. Publicar comparações somente com versões e cenários identificados.

## 5. Procedimentos revisáveis e integrações úteis

Criar editor de procedimentos com gatilho, escopo, etapas, condições, permissões e versão. Mostrar mudanças de plano antes de continuar; salvar correções conscientemente. Pontos de retomada precisam conferir o estado real, distinguindo compensação possível, efeito irreversível e resultado externo insuficiente.

Escolher integrações pelas tarefas frequentes: arquivos, editor, navegador e informações autorizadas. Contexto de clima/atividade e as consultas explícitas da 0.4.0 não equivalem a briefing conectado com calendário/e-mail/feed próprio de notícias. Esses conectores exigem consentimento, leitura limitada, cancelamento e fonte/horário por item e ainda não estão implementados. Mensagens, aplicações complexas e dispositivos também exigem adaptadores próprios. eWeLink e Home Assistant não são usados pelo autor e ficam como expansão futura, sem solicitação de contas ou configuração nesta revisão. Cada adaptador deve declarar contrato, escopo, confirmação, resultado observado e cancelamento.

**Aceite:** tarefas reais concluídas com efeitos rastreáveis. Quantidade de integrações não substitui confiabilidade.

## 6. Presença pessoal opcional

Instalar modelos somente quando desejado. Calibrar limiar, margem e consistência com participantes voluntários; testar luz, óculos, desconhecidos, múltiplos rostos e foto/vídeo. Conferir cadastro/exclusão e ausência de envio facial aos provedores.

**Aceite:** resposta neutra em ambiguidade e confirmação explícita do perfil. Webcam RGB continua fora do papel de autenticação.

## Decisões preservadas

- Núcleo orbital original com fios ciano e campo azul, paleta fixa em todos os estados, pulsação pelo áudio e centro sem texto novo; cartões somente sob demanda.
- OpenAI para interpretação/geração; ElevenLabs para a voz Jarvis configurada.
- Espera local e login opcionais; nenhuma trilha musical inventada.
- Presença local voluntária, sem autoridade automática.
- Memória explícita por perfil; não anunciar retreinamento.
- Ações com proposta, autorização necessária e evidência.
- Publicação sem chaves, localização privada, voz de referência ou dados pessoais.
