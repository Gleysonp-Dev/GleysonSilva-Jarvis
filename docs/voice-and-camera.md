# Projeto GleysonSilva-Jarvis: voz e câmera

O núcleo mantém o ciano aprovado em todos os estados. Ouvindo e respondendo, brilho e expansão acompanham o envelope do áudio capturado e reproduzido; durante uma ferramenta, a pulsação segue a atividade do executor. Aguardar o modelo, aguardar confirmação e executar devem continuar distinguíveis pelo rótulo de estado. Com movimento reduzido, os estados continuam legíveis sem exigir animação.

## Voz do MVP

A sessão 0.2.0 usa o microfone e WebRTC com OpenAI para entrada de voz e resposta em texto. O texto é enfileirado para a ElevenLabs, que produz a voz configurada. VAD e botão solicitam interrupção da resposta, síntese e reprodução. Encerrar deve liberar microfone, áudio, conexão e temporizadores. A nova conversa completa com o clone ainda precisa de ensaio real.

O clone **GleysonSilva-Jarvis** já foi criado e uma frase gerada pelo painel com Eleven Multilingual v2. Clonagem e distribuição dos áudios selecionados foram autorizadas; referência e ID permanecem privados. O caminho atual bloqueia áudio OpenAI e não troca para outra voz quando a ElevenLabs falha. Exige chave OpenAI, chave ElevenLabs e voz configurada; erro deve permanecer visível. A [documentação ElevenLabs](elevenlabs.md) distingue geração real dos testes com transporte substituído.

Em **Ajustes → Saudação**, use **Amostra fixa da voz** para reproduzir o [MP3 incluído](../assets/voice/jarvis-demo.mp3). Esse botão toca uma frase gravada após clique, sem API, microfone ou boletim meteorológico. O analisador do áudio reproduzido conduz a pulsação ciano; **Parar amostra** encerra a reprodução.

**Iniciar Jarvis** prepara a [saudação dinâmica](startup-greeting.md) com cumprimento pelo horário, tempo e previsão para a cidade configurada. **Ouvir saudação** toca o áudio já preparado, sem nova consulta ou síntese. Um áudio gravado mantém o boletim do momento em que foi gerado; reproduzi-lo não atualiza o clima. Para preparar outro boletim, use **Iniciar Jarvis**.

A saudação, amostra e nova saída da conversa usam tom metálico fixo **0,78**, sem ajuste. A narração é reproduzida a **0,95×, preservando a altura da voz**: 5% mais lenta que a origem. A síntese continua com velocidade 1 e os parâmetros aprovados; o clone e os arquivos originais permanecem iguais. O núcleo acompanha o sinal local após o efeito. O aceite auditivo da saudação/amostra não comprova a nova conversa.

A amostra é fixa; respostas novas usam novas gerações ElevenLabs. O código 0.2.0 integra fila, correlação por execução/trecho, reprodução e descarte de resultados cancelados. Não há modelo de voz exportado junto do MP3 e não há alternativa automática com voz OpenAI ou do navegador.

Uma conversa por texto transmite palavras progressivamente, mas não liga o microfone nem reproduz áudio. Na revisão 0.2.2 em preparação, saudação e conversa falada usam áudio, pulsação e estado da conexão, sem acrescentar transcrições ao painel Conversa. Mensagens digitadas e suas respostas continuam visíveis; a fonte meteorológica fica compacta. A compreensão de voz e o histórico necessário aos provedores continuam internos. Ainda não há novo CI confirmado para essa apresentação. No modo sem bridge, uma prévia visual não demonstra os serviços.

## Verificação do microfone e saída

Execute estes passos no computador que usará o assistente. Use a versão funcional local; a prévia estática não basta.

O harness de teste é iniciado com `npm run test:local` e aberto em `http://127.0.0.1:47832`. Ele usa a mesma interface e os mesmos serviços de texto/execução com uma pasta sintética de ensaio, e não oferece os adaptadores que abrem programas do Windows. Credenciais nesse modo ficam apenas em memória. O aplicativo Electron continua sendo a superfície que deve comprovar integração com o sistema e persistência protegida.

1. Confirme o dispositivo de entrada e a saída selecionados no Windows ou navegador. Reduza o volume antes de testar para evitar realimentação.
2. Ative o teste local de áudio, quando oferecido pelo controlador. Permita o microfone na caixa do sistema. Fale uma frase e confirme variação do medidor; silêncio deve reduzir a amplitude. Isso demonstra captura, sem comprovar conexão OpenAI.
3. Reproduza o teste local de saída, quando disponível, e confirme som audível no dispositivo escolhido. Um gráfico variando, sozinho, não comprova que a pessoa ouviu o som.
4. Com ambas as chaves e voz configuradas, inicie conversa, pergunte em português e confirme resposta adequada, voz Jarvis ouvida e pulsação, sem transcrição no painel. Registre modelos/dispositivos sem o ID privado. Pode haver consumo nos dois provedores.
5. Interrompa uma resposta por voz e pelo botão. Confirme que o áudio anterior para, nenhuma fala/transcrição é acrescentada ao painel e nenhum resultado antigo começa uma nova ação. Confira separadamente que uma mensagem digitada continua visível.
6. Encerre a sessão e confirme no indicador do sistema que o microfone foi liberado. Repita com falha de rede, permissão negada e encerramento da janela.

Se a solicitação de dispositivo não aparecer, confira as permissões de câmera/microfone do Windows e da origem local. Navegadores exigem origem considerada segura para `getUserMedia`; `localhost` é o caminho previsto para o harness. O comportamento em uma máquina deve ser registrado, não inferido a partir de testes de parser.

## Câmera local e perfis

Há duas capacidades diferentes: visualizar um quadro confirma captura de câmera; reconhecer uma pessoa exige modelos, vetores e validação de identidade. A ausência de modelos não deve ser anunciada como falha da câmera. Um status “modelos não configurados” não demonstra que a webcam está funcionando.

O worker opcional recebe JPEG/PNG por pipe privado, detecta rostos usando YuNet e extrai vetores SFace depois de alinhar os pontos faciais. Ele não abre a webcam, não possui nomes e não grava quadros. O processo principal guarda as representações necessárias no armazenamento protegido e responde ao renderer somente com dados de apresentação. Consulte a [instalação e o protocolo de visão](../services/vision/README.md).

Os arquivos de modelo ficam na pasta privada `models` dos dados do aplicativo, fora do repositório. Python, OpenCV e pesos são opcionais e não são instalados silenciosamente. No Electron de Windows, a cifragem usa o mecanismo do sistema. O servidor local de teste do navegador não deve ser usado para assumir a mesma proteção ou persistência de cadastro facial.

Um perfil reconhecido personaliza o assistente. A pessoa escolhe usar o perfil; a câmera não concede autorização de arquivos, aplicativos ou informações privadas. Com duas pessoas, rosto desconhecido, similaridade insuficiente ou resultado instável, mantenha uma identificação neutra e não adivinhe o nome.

## Cadastro voluntário

1. Ative a câmera no painel Presença e confirme a prévia. Um rosto deve estar visível por vez.
2. Selecione o perfil em que deseja cadastrar o rosto e informe o nome de apresentação.
3. Use o botão de cadastro e capture os quadros solicitados, com pequenas mudanças de ângulo e sem outras pessoas ao fundo. Confirme que o aplicativo não armazena a imagem original.
4. Faça um novo teste separado do cadastro; repita ao afastar-se e voltar. O nome deve surgir apenas após resultado consistente.
5. Apague o cadastro e confirme que ele desaparece também após reiniciar. O reconhecimento antigo deve deixar de funcionar e nenhuma cópia auxiliar criada pelo aplicativo deve permanecer.

Os vetores continuam sendo informação biométrica sensível mesmo sem fotografias salvas. Não os envie para issues, pull requests, logs ou fixtures públicas. A webcam RGB não oferece prova de vida: uma foto ou um vídeo podem enganar o sistema. Não use esse mecanismo como login seguro.

## Testes de captura e reconhecimento

| Cenário | Resultado esperado |
| --- | --- |
| Câmera desligada | Nenhuma track de vídeo aberta. |
| Permissão negada ou câmera ocupada | Mensagem clara; nenhum ciclo de tentativa oculta. |
| Prévia com modelos ausentes | Captura pode ser diagnosticada separadamente; identificação informa requisito ausente. |
| Pessoa cadastrada em luz habitual | Identificação estável após vários quadros; sem troca automática de autoridade. |
| Desconhecido ou rosto parcialmente oculto | Perfil não identificado. |
| Duas ou mais pessoas | Identificação neutra e sem leitura espontânea de dados privados. |
| Foto ou vídeo do cadastrado | Registrar a limitação; nunca interpretar como autenticação. |
| Fechar o painel, desligar câmera ou encerrar app | Liberação do dispositivo e descarte de respostas atrasadas. |
| Reconhecimento durante conversa de voz | Áudio continua fluido; análise facial limitada a um quadro pendente. |

Registre também mudanças de luz, óculos, ângulos, cabelo, fundo e distância. Similaridade de vetores não é probabilidade de identidade. O limiar e a margem entre candidatos exigem calibração; nenhum número de acerto é publicado sem uma amostra de testes documentada.

## Estado de validação

No ensaio real, microfone produziu nível e foi liberado; câmera exibiu prévia 640×480 e parou. Uma resposta OpenAI Realtime foi ouvida com marin, voz diferente da desejada; motivou a rota ElevenLabs atual. **A nova conversa com o clone ainda não foi confirmada integralmente.**

A captura de tela do usuário confirmou a janela do EXE 0.2.1 aberta. Ela não confirma microfone/áudio no aplicativo nativo, início no login ou persistência protegida das chaves; esses ensaios permanecem separados.

Reconhecimento permanece indisponível por ausência de OpenCV e pesos. Protocolo, limites, alinhamento e normalização possuem testes com backend falso, que não medem a rede neural. Não houve cadastro/identificação real aprovados nem taxa de acerto demonstrada.

A espera por palmas/palavra é opcional e mantém microfone local ativo. Deve pausar antes da própria fala/música e ceder ao teste/conversa; ativação e retorno reais continuam pendentes. Veja [Espera](standby.md), [Validação](validation.md) e [Plano de testes](test-plan.md).
