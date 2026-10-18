# Espera local e início no Windows

Recursos introduzidos no código 0.2.0. **Ainda precisam de ensaio real de ativação, pausa/retorno, login e aplicativo empacotado.** Testes automáticos exercitam detecção sintética e contratos com dispositivos/processos substituídos.

## Ativação voluntária

`startAtLogin` e `standbyEnabled` começam em `false`. Em Ajustes → Início e espera, a pessoa escolhe iniciar ao entrar no Windows e/ou manter o microfone em espera. Os gatilhos de palmas e palavra podem ser escolhidos separadamente. É necessário configurar voz ElevenLabs, chave e cidade para a recepção.

A espera processa o microfone localmente. Ela não inicia conexão de conversa com a OpenAI. Ao detectar um gatilho elegível, pausa a própria captura e prepara a saudação com clima. O processamento do clima e a síntese continuam sendo serviços externos; “ativação local” não torna a recepção inteira offline.

O controlador deve ceder o microfone ao teste/conversa ativa e suspender a espera durante sua própria fala e música, evitando reativação pelo áudio de saída. Ao terminar, pode retomar se a pessoa manteve a espera habilitada. Cancelar, trocar perfil e sair precisam descartar resultados antigos.

## Duas palmas

O detector Web Audio usa transientes curtas, energia de altas frequências, pico relativo e adaptação do piso de ruído. Aceita duas palmas com intervalo de **150 a 800 ms** e mantém proteção de aproximadamente **oito segundos** entre ativações.

A captura é analisada localmente, sem gravação, upload ou Web Speech. Usa temporizador de análise, não depende somente de frames da animação. Ruído impulsivo também pode se parecer com palmas; os testes de fala/ruído sintéticos não demonstram ausência de falsos positivos em todo ambiente.

Navegadores podem limitar captura/temporizadores em abas de segundo plano. O Electron configura a superfície para a espera, mas minimizar, bloquear a tela e retomar suspensão ainda exigem ensaio no Windows real.

## Palavra “Jarvis”

O aplicativo Windows usa um worker local **System.Speech**, com gramática limitada à palavra “Jarvis”. Requer um reconhecedor de fala de idioma compatível instalado no sistema. Sem ele, a interface informa indisponibilidade; não muda para reconhecimento em nuvem pelo navegador.

O worker não recebe as chaves dos provedores. O principal valida os eventos e limita repetições. Processo iniciado ou mensagem simulada de reconhecimento não comprova que o microfone real reconheceu a palavra; esse aceite permanece pendente.

O ensaio no navegador não oferece esse gatilho nativo.

## Iniciar ao entrar na conta

A opção nativa registra o executável Windows empacotado para iniciar **depois do login da pessoa**. Não é serviço antes do login e não liga o computador. Com espera configurada, a intenção é abrir em espera/bandeja, sem narrar antes do gatilho.

O código usa o caminho estável do executável externo na versão portátil. Mover ou apagar o arquivo pode invalidar o início; confirme o resultado observado, não apenas a opção salva. `npm start` e o navegador não comprovam o registro do pacote.

Com espera habilitada, fechar a janela pode mantê-lo na bandeja. Pausar a espera deve parar a escuta; sair pelo aplicativo deve encerrar os recursos e processos. Desativar início no Windows deve remover esse registro. Esses comportamentos estão implementados, com validação física ainda pendente.

## Música da recepção

Há suporte a uma fonte de áudio escolhida pelo usuário, em configuração privada. **Nenhuma trilha padrão está incluída e nenhum arquivo musical foi fornecido no ensaio atual.**

A música acompanha apenas a recepção: termina com o fim ou interrupção da saudação. Não deve manter microfone em espera durante a própria reprodução. Falha no arquivo precisa ser apresentada sem alegar sucesso ou substituir por outra trilha. O arquivo, seu caminho e direitos de uso continuam sob controle do usuário; não são publicados automaticamente.

## Aceite pendente

No Windows empacotado, conferir login real, pausar/retomar pela bandeja, palmas e palavra com os dispositivos escolhidos, fala comum/TV/ruído, ausência de autoativação durante a narração, retorno após o fim, cancelamento e saída. Testar também reconhecedor ausente, permissão negada, microfone ocupado e retomada do computador.

O [registro de validação](validation.md) distingue a baseline já observada dos novos recursos. O [plano de testes](test-plan.md) fornece os cenários completos.
