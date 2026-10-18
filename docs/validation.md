# Validação do MVP 0.1.0

Registro de 18 de outubro de 2026. Este relatório distingue implementação, testes com substitutos e observação real.

| Verificação | Resultado |
| --- | --- |
| Testes Node do runtime, provedores, ajustes, visão, renderer, áudio e servidor local | 147 aprovados no CI do commit 97bfa46; zero falhas e zero ignorados. Os 12 testes de áudio/renderização passaram na revisão do efeito. Após o ajuste para 0,95×, TypeScript, build e captura real do áudio passaram novamente. |
| Python opcional nos testes | Executado com Python 3.12; protocolo e pré-processamento com backend de teste. |
| TypeScript | Aprovado com verificação estrita, sem emissão. |
| Compilação da interface | Aprovada; interface React e Canvas gerada. |
| Servidor funcional local | Iniciado em loopback; interface exibida com identificação de pasta de ensaio. |
| Interface no navegador | Saudação real com tempo atual, previsão e atribuição exibida após correção de renderização. A atribuição é um objeto estruturado, coberto por quatro regressões de renderização React. |
| Electron nativo | Não iniciado nesta sessão: dependências do Electron não estavam disponíveis e o ambiente rejeitou a ampliação de permissão para instalação. |
| OpenAI com conta real | Não testada: chave ainda não configurada no aplicativo. Não há latência real medida. |
| Voz clonada ElevenLabs | Criação real de GleysonSilva-Jarvis confirmada no painel do navegador; conta observada como Creator. Etapa adicional de microfone, indicada como opcional, não utilizada. |
| Áudio real ElevenLabs | Frase de 131 caracteres gerada pelo painel com Eleven Multilingual v2 e baixada como MP3 44,1 kHz/128 kbps de 137.309 bytes. Não foi uma chamada real da CLI. |
| Amostra no aplicativo | Arquivo incluído em assets/voice e controle explícito “Amostra fixa da voz”, sem API ou captura. Pulsação ligada ao sinal processado. O autor ouviu e aprovou a versão anterior e pediu o refinamento descrito abaixo. |
| Tom metálico fixo | Grafo atual renderizado com OfflineAudioContext sobre o MP3 aprovado. Bypass interno idêntico à entrada; sinal processado distinto e finito; pico 0,733, sem saturação; silêncio de entrada permaneceu silêncio. |
| Refinamento de reprodução atual | Reprodução real a 0,95× com altura preservada, apenas 5% mais lenta que a voz original. Captura PCM após o efeito: 7,94 segundos para expectativa de 7,92; pico 0,735, sem saturação ou amostras não finitas. A mudança é local na saudação e na amostra; a síntese ElevenLabs continua com velocidade 1. Amostra preparada para avaliação auditiva do autor. |
| Narração de abertura | O autor ouviu e aprovou a versão anterior e pediu uma cadência mais lenta e natural. O processo restrito de desenvolvimento não acessa os provedores (EACCES). O servidor iniciado pelo usuário no Windows preparou texto com tempo/previsão válidos e retornou áudio; a interface ofereceu “Ouvir saudação” quando o navegador exigiu gesto. A revisão atual ainda não recebeu aprovação auditiva final. |
| Adaptador ElevenLabs | CLI e streaming testados com respostas simuladas. Respostas dinâmicas do Jarvis ainda usam OpenAI marin. |
| Microfone e câmera físicos | Controles de teste implementados; captura e reprodução reais ainda não confirmadas nesta sessão. |
| Reconhecimento facial com pesos reais | Não medido. Testes usam representações sintéticas; não demonstram acurácia nem prova de vida. |
| Pacote Windows e instalação limpa | O CI do commit 97bfa46 aprovou 147 testes e gerou o artefato portátil Windows. Instalação limpa e execução nativa ainda não ensaiadas; nenhum executável assinado foi lançado. O refinamento de reprodução posterior precisa de seu próprio CI. |

Os testes de arquivos exercitam efeitos reais em pastas temporárias descartáveis: confirmação, movimento sem sobrescrita, mudança de plano, links, cancelamento e restauração. Os testes de provedores substituem o transporte de rede: validam contratos e erros. A geração real ElevenLabs descrita na tabela foi realizada separadamente no painel web, não por esses testes.

A gravação WAV de referência, as credenciais e o ID de voz permanecem privados. O autor autorizou clonagem e distribuição pública do áudio gerado; o MP3 selecionado possui [aviso de origem e distribuição](../assets/voice/README.md). O arquivo permite reproduzir a frase fixa sem API, mas não contém um modelo capaz de gerar novas falas.

O primeiro CI revelou um problema com caminhos abreviados Windows 8.3. A correção foi reproduzida com alias real, mantendo a rejeição de junções. Após corrigir a comparação textual do teste para usar o caminho canônico, o [CI do commit f42472f](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39152788680) aprovou verificação e empacotamento. O artefato é uma prévia sem assinatura, não uma release validada em instalação limpa.

O CI posterior do [commit 97bfa46](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/commit/97bfa46) também concluiu verificação e empacotamento com 147 testes aprovados. O pedido de tornar o metal um pouco mais presente e a fala mais lenta ocorreu depois dessa versão. A aprovação auditiva anterior e os resultados desse CI não substituem o ensaio da nova reprodução.

Um ensaio real revelou tela vazia ao receber a atribuição meteorológica estruturada: o renderer tentava inseri-la diretamente como texto. O contrato foi corrigido, a fonte/licença agora são exibidas por um componente próprio e uma proteção de recuperação evita uma tela totalmente vazia em futuras falhas de renderização. Recuperar a interface não repete automaticamente a síntese.

Próximo aceite: executar fora do ambiente restrito de desenvolvimento, medir uma conversa real, confirmar liberação de dispositivos ao encerrar e validar o aplicativo nativo com os adaptadores Windows. Depois de instalar as dependências, `INICIAR-TESTE.cmd` abre o ensaio no navegador em loopback, porta 47833. Use [o roteiro completo](test-plan.md) para registrar resultados sem dados pessoais ou credenciais.

