# Roadmap — Projeto GleysonSilva-Jarvis

O [código-fonte é público](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). O incremento 0.3.0 implementa núcleo orbital azul e Contexto sob demanda com clima e atividade local. Seus resultados de validação devem ser consultados por execução/commit em [Validação](validation.md). No histórico, a revisão **0.2.3 teve 229 testes, TypeScript, build, pacote e abertura nativa aprovados no CI Windows**. A base 0.2.2 preserva o painel sem transcrições; a base 0.2.1 corrigiu a falha sem janela do 0.2.0 e o usuário confirmou sua abertura visual por captura de tela. Dispositivos, fechamento durante áudio e filtros ainda exigem ensaio físico. Não há release assinada ou validação completa em instalação limpa.

A direção atual preserva o dashboard limpo, saudação completa, efeito metálico fixo 0,78 e reprodução a 0,95× com altura preservada. O núcleo mecânico ciano anterior foi substituído no 0.3.0 por arte orbital original azul, inspirada nas referências públicas, sem reutilizar código ou assets do projeto de referência. O novo visual precisa de aceite do usuário. Superioridade, exclusividade e vantagem de latência dependem de comparação reproduzível; não são resultados demonstrados.

## Incremento implementado — 0.3.0

- Núcleo orbital de filamentos e partículas, matiz azul constante e pulsação ligada a escuta, fala e execução. Redução de movimento e limite de resolução preservam acessibilidade e recursos.
- Painel **Contexto** sob demanda: clima validado com fonte, horário e cache; atividade de execução do perfil em recorte de até cem registros, com até oito entradas visíveis. Nenhuma transcrição, captura ou síntese é iniciada por essa consulta.
- Leitura independente da saudação, cancelamento e descarte de respostas após troca de perfil/configuração. Fonte ausente ou indisponível aparece com seu estado real.

Esse primeiro incremento ainda não combina calendário, e-mail ou notícias. O próximo briefing deve reunir fontes reais autorizadas com leitura limitada, origem e atualidade explícitas; sem conexão, deve informar a ausência. Uma futura narração desse briefing será uma etapa separada, mantendo a saudação aprovada e o dashboard limpo.

## Base atual

| Área | Código e observações registradas | Próximo aceite |
| --- | --- | --- |
| Interface e saudação | Visual e narração aprovados; revisão 0.2.2 sem transcrições no painel, texto digitado preservado e fonte do clima compacta, verificados com serviços substituídos. | Confirmar a nova apresentação durante uma sessão real e avaliar fluidez. |
| Núcleo e Contexto 0.3.0 | Composição orbital azul e painel de clima/atividade implementados, com fontes e limites explícitos. | Aceite visual do núcleo, clima no local configurado, indisponibilidade, cancelamento e troca de perfil em uso real. |
| OpenAI texto | Resposta correta com conta real. | Ferramentas, limites, falhas, custo e latência em amostra maior. |
| Entrada e saída de voz | Microfone real com nível/liberação; resposta OpenAI Realtime anterior ouvida em marin. | Nova rota de conversa com a voz ElevenLabs configurada, sem saída OpenAI alternativa. |
| Voz Jarvis | Clone criado; amostra e recepção aprovadas a 0,95×/efeito fixo. | Respostas dinâmicas, interrupção e retomada em sessão real. |
| Espera 0.2.0 | Código de palmas locais, palavra System.Speech, login opt-in e pausa da escuta. | Dispositivo real, idioma, falsos positivos, segundo plano, retorno e login no pacote Windows. |
| Fechamento e filtros 0.2.3 | X alterado para silenciar e destruir a janela imediatamente, com encerramento compartilhado; filtros mais conservadores testados com substitutos e CI aprovado. | Ensaio físico do fechamento durante áudio, minimizar/retorno, gatilhos e ruído. Não se sabe qual detector causou a repetição relatada. |
| Música | Arquivo privado recebido; prévia atual com saudação ouvida/aprovada, ganho 0,35/0,22. | Testar recepção ao vivo e encerramento. Não há trilha padrão distribuída. |
| Presença | Webcam real 640×480 e parada confirmadas. | Instalar OpenCV/pesos opcionais e ensaiar identificação voluntária. |
| Execução | Pasta limitada, proposta, confirmação, registro e restauração condicionada. | Ensaios Windows com aplicativos e arquivos descartáveis. |
| Distribuição | CI 0.2.3: 229 testes, TypeScript, build, pacote e abertura real de janela/DOM/preload/boot aprovados; abertura visual do 0.2.1 confirmada pelo usuário. | Ensaiar a versão atual no destino, instalação limpa, recursos nativos, microfone, proteção das chaves e assinatura. |

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

Escolher integrações pelas tarefas frequentes: arquivos, editor, navegador e informações autorizadas. O primeiro Contexto de clima/atividade está implementado; evoluir para briefing com calendário, e-mail e notícias exige conectores de leitura, consentimento, cancelamento e fonte/horário por item. Esses conectores ainda não estão implementados. Mensagens, aplicações complexas e dispositivos também exigem adaptadores próprios. Cada adaptador deve declarar contrato, escopo, confirmação, resultado observado e cancelamento.

**Aceite:** tarefas reais concluídas com efeitos rastreáveis. Quantidade de integrações não substitui confiabilidade.

## 6. Presença pessoal opcional

Instalar modelos somente quando desejado. Calibrar limiar, margem e consistência com participantes voluntários; testar luz, óculos, desconhecidos, múltiplos rostos e foto/vídeo. Conferir cadastro/exclusão e ausência de envio facial aos provedores.

**Aceite:** resposta neutra em ambiguidade e confirmação explícita do perfil. Webcam RGB continua fora do papel de autenticação.

## Decisões preservadas

- Núcleo orbital original azul, uma cor constante, pulsação pelo áudio e nome estável; cartões somente sob demanda.
- OpenAI para interpretação/geração; ElevenLabs para a voz Jarvis configurada.
- Espera local e login opcionais; nenhuma trilha musical inventada.
- Presença local voluntária, sem autoridade automática.
- Memória explícita por perfil; não anunciar retreinamento.
- Ações com proposta, autorização necessária e evidência.
- Publicação sem chaves, localização privada, voz de referência ou dados pessoais.
