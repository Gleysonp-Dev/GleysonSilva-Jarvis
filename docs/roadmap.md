# Roadmap — Projeto GleysonSilva-Jarvis

O [código-fonte é público](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis). A revisão **0.2.2 está implementada, com 221 testes, TypeScript, build, pacote e abertura nativa aprovados no CI Windows**. A base 0.2.1 corrigiu a falha sem janela do 0.2.0; o usuário confirmou sua abertura visual por captura de tela. Não há release assinada ou validação completa em instalação limpa.

A referência aprovada é o dashboard limpo, núcleo ciano constante, saudação completa, efeito metálico fixo 0,78 e reprodução a 0,95× com altura preservada. Superioridade, exclusividade e vantagem de latência dependem de comparação reproduzível; não são resultados demonstrados.

## Base atual

| Área | Já observado | Próximo aceite |
| --- | --- | --- |
| Interface e saudação | Visual e narração aprovados; revisão 0.2.2 sem transcrições no painel, texto digitado preservado e fonte do clima compacta, verificados com serviços substituídos. | Confirmar a nova apresentação durante uma sessão real e avaliar fluidez. |
| OpenAI texto | Resposta correta com conta real. | Ferramentas, limites, falhas, custo e latência em amostra maior. |
| Entrada e saída de voz | Microfone real com nível/liberação; resposta OpenAI Realtime anterior ouvida em marin. | Nova rota de conversa com a voz ElevenLabs configurada, sem saída OpenAI alternativa. |
| Voz Jarvis | Clone criado; amostra e recepção aprovadas a 0,95×/efeito fixo. | Respostas dinâmicas, interrupção e retomada em sessão real. |
| Espera 0.2.0 | Código de palmas locais, palavra System.Speech, login opt-in e pausa da escuta. | Dispositivo real, idioma, falsos positivos, segundo plano, retorno e login no pacote Windows. |
| Música | Arquivo privado recebido; prévia atual com saudação ouvida/aprovada, ganho 0,35/0,22. | Testar recepção ao vivo e encerramento. Não há trilha padrão distribuída. |
| Presença | Webcam real 640×480 e parada confirmadas. | Instalar OpenCV/pesos opcionais e ensaiar identificação voluntária. |
| Execução | Pasta limitada, proposta, confirmação, registro e restauração condicionada. | Ensaios Windows com aplicativos e arquivos descartáveis. |
| Distribuição | CI 0.2.2: 221 testes, TypeScript, build, pacote e abertura real de janela/DOM/preload/boot aprovados; abertura visual do 0.2.1 confirmada pelo usuário. | Ensaiar 0.2.2 no destino, instalação limpa, recursos nativos, microfone, proteção das chaves e assinatura. |

A revisão 0.2.0 revelou bloqueio por `await app.whenReady()` no topo ESM do Electron 44.9.0, apesar do CI de empacotamento aprovado. A revisão 0.2.1 corrigiu o bootstrap e passou por 218 testes e pelo [teste nativo real no CI 8a074e7](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39162376494): janela, DOM, preload e boot do pacote confirmados. O bloqueio por ACL no ambiente local é um ensaio separado; não ocorreu no CI. A captura de tela do usuário confirmou a abertura visual no próprio computador.

Consulte [Validação](validation.md) para limites das evidências e [Plano de testes](test-plan.md) para os cenários.

O [CI d72c4887 da revisão 0.2.2](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39164458465) manteve o teste nativo e aprovou todos os passos. A ausência de transcrições foi verificada com serviços substituídos; conversa com o clone, microfone nativo, login e DPAPI continuam exigindo ensaio físico.

## 1. Fechar a validação da conversa

A interface do **GleysonSilva-Jarvis-0.2.1-Windows.exe** já abriu no computador do usuário. O CI inclui teste com Electron real e pacote, perfil temporário e identificação exclusiva, sem rede/captura/início no login; carregamento e encerramento foram aprovados. Manter essa regressão no 0.2.2: gerar artefato ou observar um processo, isoladamente, não cobre a falha.

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
- Verificar pausa/retorno, bandeja, saída e retomada após suspensão.
- No pacote Windows em caminho estável, testar entrada real na conta e desativação do registro.
- Usar a música privada já recebida e aprovada em prévia; conferir fim/cancelamento na recepção ao vivo.

**Aceite:** funciona no aplicativo empacotado, sem confundir login com boot antes do login nem teste sintético com reconhecimento real. Veja [Espera](standby.md).

## 3. Tornar instalação e distribuição reproduzíveis

- Manter Node 24, dependências fixadas, documentação e licença.
- Executar o CI atualizado e registrar quantidade, falhas e skips por commit.
- Ensaiar o EXE em máquina limpa, sem chave, depois com configuração privada.
- Confirmar proteção das chaves, origem da bridge, encerramento e ausência de dados privados no pacote.
- Definir assinatura e atualização antes de apresentar distribuição pronta.

**Aceite:** outra pessoa instala e reproduz o resultado pelo README. Código público e artefato de CI não equivalem a release nativa validada.

## 4. Comparar qualidade e latência

Usar pelo menos 30 pedidos repetíveis por cenário, separando inicialização fria/aquecida, espera humana e ferramenta. Registrar p50/p95, máximo, sucesso/falhas, rede, hardware, modelos e consumo observado. Incluir tentativas lentas e erros.

Avaliar português, sotaques, nomes, sobreposição, ruído e retomada. Preservar o preset de voz aprovado salvo novo pedido do autor. Publicar comparações somente com versões e cenários identificados.

## 5. Procedimentos revisáveis e integrações úteis

Criar editor de procedimentos com gatilho, escopo, etapas, condições, permissões e versão. Mostrar mudanças de plano antes de continuar; salvar correções conscientemente. Pontos de retomada precisam conferir o estado real, distinguindo compensação possível, efeito irreversível e resultado externo insuficiente.

Escolher integrações pelas tarefas frequentes: arquivos, editor, navegador e informações autorizadas. Calendário, e-mail, mensagens, aplicações complexas e dispositivos exigem conectores próprios. Cada adaptador deve declarar contrato, escopo, confirmação, resultado observado e cancelamento.

**Aceite:** tarefas reais concluídas com efeitos rastreáveis. Quantidade de integrações não substitui confiabilidade.

## 6. Presença pessoal opcional

Instalar modelos somente quando desejado. Calibrar limiar, margem e consistência com participantes voluntários; testar luz, óculos, desconhecidos, múltiplos rostos e foto/vídeo. Conferir cadastro/exclusão e ausência de envio facial aos provedores.

**Aceite:** resposta neutra em ambiguidade e confirmação explícita do perfil. Webcam RGB continua fora do papel de autenticação.

## Decisões preservadas

- Núcleo circular ciano, pulsação pelo áudio e nome estável.
- OpenAI para interpretação/geração; ElevenLabs para a voz Jarvis configurada.
- Espera local e login opcionais; nenhuma trilha musical inventada.
- Presença local voluntária, sem autoridade automática.
- Memória explícita por perfil; não anunciar retreinamento.
- Ações com proposta, autorização necessária e evidência.
- Publicação sem chaves, localização privada, voz de referência ou dados pessoais.
