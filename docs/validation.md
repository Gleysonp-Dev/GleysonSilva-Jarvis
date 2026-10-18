# Validação do MVP 0.1.0

Registro de 18 de outubro de 2026. Este relatório distingue implementação, testes com substitutos e observação real.

| Verificação | Resultado |
| --- | --- |
| Testes Node do runtime, provedores, ajustes, visão e servidor local | 94 aprovados; zero falhas e zero ignorados. |
| Python opcional nos testes | Executado com Python 3.12; protocolo e pré-processamento com backend de teste. |
| TypeScript | Aprovado com verificação estrita, sem emissão. |
| Compilação da interface | Aprovada; interface React e Canvas gerada. |
| Servidor funcional local | Iniciado em loopback; interface exibida com identificação de pasta de ensaio. |
| Interface no navegador | Inspeção visual realizada; houve falhas de resposta da automação do navegador durante cliques. Validação interativa completa ainda pendente. |
| Electron nativo | Não iniciado nesta sessão: dependências do Electron não estavam disponíveis e o ambiente rejeitou a ampliação de permissão para instalação. |
| OpenAI com conta real | Não testada: chave ainda não configurada no aplicativo. Não há latência real medida. |
| Voz clonada ElevenLabs | Adaptador e CLI testados com respostas simuladas. Estado da criação na conta e da amostra audível deve ser confirmado separadamente. |
| Microfone e câmera físicos | Controles de teste implementados; captura e reprodução reais ainda não confirmadas nesta sessão. |
| Reconhecimento facial com pesos reais | Não medido. Testes usam representações sintéticas; não demonstram acurácia nem prova de vida. |
| Pacote Windows e instalação limpa | Aguardam execução da integração contínua e ensaio em Windows. Nenhum executável assinado foi lançado. |

Os testes de arquivos exercitam efeitos reais em pastas temporárias descartáveis: confirmação, movimento sem sobrescrita, mudança de plano, links, cancelamento e restauração. Os testes de provedores substituem o transporte de rede: validam contratos e erros, sem afirmar que o serviço externo respondeu.

Próximo aceite: configurar a chave no campo mascarado, medir uma conversa real, confirmar liberação de dispositivos ao encerrar e validar o aplicativo nativo com os adaptadores Windows. Use [o roteiro completo](test-plan.md) para registrar resultados sem dados pessoais ou credenciais.
