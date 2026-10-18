# Validação do MVP 0.1.0

Registro de 18 de outubro de 2026. Este relatório distingue implementação, testes com substitutos e observação real.

| Verificação | Resultado |
| --- | --- |
| Testes Node do runtime, provedores, ajustes, visão e servidor local | 135 aprovados; zero falhas e zero ignorados. |
| Python opcional nos testes | Executado com Python 3.12; protocolo e pré-processamento com backend de teste. |
| TypeScript | Aprovado com verificação estrita, sem emissão. |
| Compilação da interface | Aprovada; interface React e Canvas gerada. |
| Servidor funcional local | Iniciado em loopback; interface exibida com identificação de pasta de ensaio. |
| Interface no navegador | Inspeção visual realizada; houve falhas de resposta da automação do navegador durante cliques. Validação interativa completa ainda pendente. |
| Electron nativo | Não iniciado nesta sessão: dependências do Electron não estavam disponíveis e o ambiente rejeitou a ampliação de permissão para instalação. |
| OpenAI com conta real | Não testada: chave ainda não configurada no aplicativo. Não há latência real medida. |
| Voz clonada ElevenLabs | Criação real de GleysonSilva-Jarvis confirmada no painel do navegador; conta observada como Creator. Etapa adicional de microfone, indicada como opcional, não utilizada. |
| Áudio real ElevenLabs | Frase de 131 caracteres gerada pelo painel com Eleven Multilingual v2 e baixada como MP3 44,1 kHz/128 kbps de 137.309 bytes. Não foi uma chamada real da CLI. |
| Amostra no aplicativo | Arquivo incluído em assets/voice e controle explícito “Ouvir amostra Jarvis”, sem API ou captura. Pulsação ligada ao analisador local. O autor ouviu e aprovou a amostra. |
| Narração de abertura | Saudação com tempo/previsão gerada no painel com Eleven Multilingual v2 e parâmetros registrados; ouvida e aprovada pelo autor. A execução automática no aplicativo ainda exige chave e ensaio integrado. |
| Adaptador ElevenLabs | CLI e streaming testados com respostas simuladas. Respostas dinâmicas do Jarvis ainda usam OpenAI marin. |
| Microfone e câmera físicos | Controles de teste implementados; captura e reprodução reais ainda não confirmadas nesta sessão. |
| Reconhecimento facial com pesos reais | Não medido. Testes usam representações sintéticas; não demonstram acurácia nem prova de vida. |
| Pacote Windows e instalação limpa | Aguardam execução da integração contínua e ensaio em Windows. Nenhum executável assinado foi lançado. |

Os testes de arquivos exercitam efeitos reais em pastas temporárias descartáveis: confirmação, movimento sem sobrescrita, mudança de plano, links, cancelamento e restauração. Os testes de provedores substituem o transporte de rede: validam contratos e erros. A geração real ElevenLabs descrita na tabela foi realizada separadamente no painel web, não por esses testes.

A gravação WAV de referência, as credenciais e o ID de voz permanecem privados. O autor autorizou clonagem e distribuição pública do áudio gerado; o MP3 selecionado possui [aviso de origem e distribuição](../assets/voice/README.md). O arquivo permite reproduzir a frase fixa sem API, mas não contém um modelo capaz de gerar novas falas.

Próximo aceite: configurar a chave no campo mascarado, medir uma conversa real, confirmar liberação de dispositivos ao encerrar e validar o aplicativo nativo com os adaptadores Windows. Use [o roteiro completo](test-plan.md) para registrar resultados sem dados pessoais ou credenciais.

