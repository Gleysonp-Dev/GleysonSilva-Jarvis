# Espera, palmas e início no Windows — revisão 0.6.2

O fluxo configurável é **login Windows → espera local → duas palmas → música/saudação com clima → conversa por voz opcional**. Não é preciso clicar em **Iniciar Jarvis** quando a espera por palmas já está armada. A espera não deve narrar ao abrir o aplicativo; aguarda o gatilho. A 0.6.2 retira comentário de roupa e câmera automática; renovar a conversa contínua não repete a recepção.

Histórico: [CI fced652 da 0.5.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39526640376) aprovado: **388/388 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa real. O ensaio físico integrado no destino continua pendente. A aprovação de **343 testes e abertura nativa no [CI da 0.4.0](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39523160110)** pertence à versão anterior. Login real, palmas no ambiente de uso, câmera e conversa prolongada precisam de evidência própria em [Validação](validation.md).

Histórico: a 0.5.1 preparava um comentário de roupa durante a saudação, funcionalidade retirada na 0.6.2. Seu [CI b8c6c8f](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39529034939) aprovou **402/402 testes, zero falhas/skips**, TypeScript/build/pacote e abertura nativa daquela revisão. O usuário confirmou palmas na sessão 0.6.0; novo login real e a sequência atual ainda precisam de evidência própria. **CI, pacote e ensaio físico 0.6.2 pendentes.**

## Configurar uma instalação

Salve as chaves OpenAI e ElevenLabs, a voz, a cidade e a trilha privada em Ajustes. No Electron, a configuração persiste na pasta privada do aplicativo; as chaves usam a proteção do sistema. O teste HTTP guarda credenciais só até encerrar seu servidor e não comprova esse armazenamento nativo.

Em **Início e espera**, escolha iniciar ao entrar no Windows, entrar em espera e ativar com duas palmas. Para uma instalação que deve despertar apenas por palmas, desmarque **Ativar ao dizer “Jarvis”**. Os dois detectores têm opções independentes; habilitar espera mantém a saudação ativa.

No Windows empacotado, **Ativar recepção completa** prepara login, espera só por duas palmas, música/saudação e comandos de voz contínuos. Revise e clique em **Salvar configuração** para aplicar; o botão não grava sozinho. O preset não abre câmera nem inclui análise de roupa. A opção de continuidade aparece como **Manter a conversa conectada à OpenAI**. Não é preciso redigitar uma chave que a interface já informa como salva.

Conversa após a recepção e conversa contínua começam desligadas no pacote público: `receptionVoiceEnabled` e `continuousVoiceEnabled` são `false`. `startAtLogin` e `standbyEnabled` também começam em `false`; os gatilhos só atuam quando a espera está habilitada. A preferência legada `receptionOutfitEnabled` é migrada para `false` e não pode reativar a câmera na recepção. Instalar o pacote não concede essas escolhas a outros usuários.

## Duas palmas locais

O detector Web Audio procura dois transientes curtos com energia de altas frequências, pico relativo e adaptação do piso de ruído. O intervalo aceito é **150 a 800 ms**, com proteção de aproximadamente **oito segundos** entre ativações.

O microfone fica ativo enquanto a espera está armada. O processamento das palmas é local: não grava, não envia esse áudio à OpenAI e não usa reconhecimento Web Speech. A espera usa temporizador de análise, sem depender somente dos frames da animação. Ruídos impulsivos podem se parecer com palmas; sinais sintéticos não demonstram ausência de falsos positivos no ambiente real.

O controlador suspende a espera antes da própria fala/música e enquanto teste de microfone ou conversa estiver usando a captura. Ao terminar uma recepção sem conversa, pode retomar a espera se ela continuar desejada. Durante conversa, os novos comandos seguem para a sessão de voz, sem exigir novas palmas.

Abas de navegador podem sofrer limitação de captura/timers em segundo plano. No pacote Electron, ainda é necessário testar minimizar, trocar de janela, bloquear/desbloquear e retomar suspensão no equipamento real. O assistente depende de sessão de usuário, energia, dispositivo disponível e permissões concedidas.

## Palavra “Jarvis”, quando escolhida

O gatilho de palavra no Windows usa um worker local **System.Speech**, com gramática limitada a “Jarvis”. Precisa de reconhecedor de idioma compatível instalado no sistema. Sem esse recurso, informa indisponibilidade e não muda silenciosamente para reconhecimento em nuvem.

O worker não recebe chaves dos provedores. Eventos passam por filtros de frase, duração, acomodação e repetição; seus escores de confiança não são probabilidades de intenção. O teste local no navegador não oferece esse gatilho nativo. Para uso exclusivo de palmas, mantenha esta opção desligada.

## Música e passagem para voz

Depois de duas palmas elegíveis, a espera cede o microfone e o serviço prepara a saudação por horário com clima. A trilha escolhida acompanha somente a recepção inicial e termina com a saudação ou interrupção. A prévia privada aprovada mantém ganho de 0,35 na introdução e 0,22 durante a fala. Não há música padrão incluída no repositório ou no executável.

A recepção não captura imagem, não analisa roupa e não prepara outro comentário entre a saudação e a conversa. O microfone de comandos pode iniciar logo após o fim da saudação quando habilitado. A câmera manual continua em **Presença**, inclusive para o reconhecimento local opcional. Veja [Recepção](startup-greeting.md) e [Voz e câmera](voice-and-camera.md).

Com conversa após a recepção habilitada, o Jarvis abre o microfone e conecta OpenAI Realtime depois do fim da saudação. Daí em diante o áudio do microfone é enviado à OpenAI enquanto a sessão estiver ativa. A saída continua na voz ElevenLabs aprovada, 0,95× com altura preservada e efeito metálico fixo 0,78.

Conversa contínua renova a conexão apenas após encerramento normal por prazo, enquanto a pessoa mantiver essa intenção. A renovação não toca música/saudação, não aciona a câmera e não transfere todo o histórico da sessão encerrada como conversa ilimitada. Autenticação recusada, falha de rede ou erro não provocam tentativas indefinidas. Há uso e cobrança dos provedores durante a conversa; conservar uma chave salva não significa conexão de microfone aberta durante a espera por palmas.

## Iniciar ao entrar na conta Windows

O aplicativo empacotado registra o executável para iniciar **depois do login da pessoa**. Não é serviço antes do login e não liga o computador. Com espera configurada, inicia em espera/bandeja e não deve narrar antes do gatilho.

A versão portátil usa o caminho estável do executável externo. Mover ou apagar esse arquivo pode invalidar o registro; confirme o estado observado e faça logout/login real. `npm start`, prévia estática e teste HTTP não demonstram início do pacote no Windows. Desativar a opção deve remover o registro.

## Pausar, interromper e sair

**Interromper** cancela a recepção e a intenção de reconectar a conversa, para música, fala e microfone e invalida resultados atrasados dos provedores. Uma nova escolha é necessária para iniciar outra conversa. Troca de perfil, reset e saída também invalidam sessões anteriores.

Pausar a espera pela interface ou bandeja encerra a escuta de gatilhos. Use **minimizar** para manter o aplicativo em espera. **X encerra o aplicativo**; Sair na bandeja também deve parar áudio, câmera, captura, workers e processo, sem voz residual ou reabertura por gatilho.

O [plano de testes](test-plan.md) separa login, detecção física, ruído, retomada, cancelamento em cada etapa e renovação de voz dos testes automáticos com dispositivos substituídos. Registre limitações sem atribuir sucesso físico ao empacotamento ou a um sinal simulado.
