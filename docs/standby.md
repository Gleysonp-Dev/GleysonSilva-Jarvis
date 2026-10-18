# Espera local e início no Windows

Recursos introduzidos no código 0.2.0. **Ainda precisam de ensaio real de ativação, pausa/retorno, login e aplicativo empacotado.** Testes automáticos exercitam detecção sintética e contratos com dispositivos/processos substituídos.

A revisão 0.2.3 teve **229 testes, zero falhas/skips, TypeScript, build, pacote e abertura nativa aprovados no [CI 5733b37](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39166025134)**. Ela mantém a apresentação sem transcrições da 0.2.2, corrige X para encerrar e torna os filtros mais conservadores. O relato de repetição não identifica qual gatilho disparou; não há alegação de eliminação de falsos positivos. Fechamento durante áudio e ativação física continuam pendentes.

## Ativação voluntária

`startAtLogin` e `standbyEnabled` começam em `false`. Em Ajustes → Início e espera, a pessoa escolhe iniciar ao entrar no Windows e/ou manter o microfone em espera. Os gatilhos de palmas e palavra podem ser escolhidos separadamente. É necessário configurar voz ElevenLabs, chave e cidade para a recepção.

A espera processa o microfone localmente. Ela não inicia conexão de conversa com a OpenAI. Ao detectar um gatilho elegível, pausa a própria captura e prepara a saudação com clima. O processamento do clima e a síntese continuam sendo serviços externos; “ativação local” não torna a recepção inteira offline.

O reconhecedor Windows usa filtros conservadores de frase, palavra, duração e confiança relativa, além de acomodação ao abrir o microfone e intervalo entre ativações. Esses escores não são probabilidades de intenção. A análise de palmas também é uma heurística: impactos semelhantes e áudio de TV podem confundir detectores, portanto é necessário ensaio no ambiente real. As revisões dos filtros não ativam conversa na nuvem automaticamente.

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

Na revisão 0.2.3, **X encerra o aplicativo**, mesmo com espera habilitada. Voz, música e captura devem parar imediatamente; a finalização dos provedores e workers ocorre em seguida. Para continuar em espera, use **minimizar**. Pausar a espera deve parar a escuta; Sair na bandeja também encerra os recursos e processos. Desativar início no Windows deve remover esse registro. O ensaio físico do fechamento corrigido ainda precisa ser confirmado.

## Música da recepção

Há suporte a uma fonte escolhida pelo usuário, em configuração privada. **O arquivo musical já foi fornecido e importado privadamente, como MP3 de aproximadamente 13 MB. Nenhuma trilha padrão é distribuída.**

O [MP3 público de voz](../assets/voice/jarvis-demo.mp3) é uma amostra fixa autorizada e não contém essa música. A música recebida permanece fora do GitHub e do pacote; ID da voz, credenciais e gravação de referência também ficam privados.

A prévia atual com a saudação gravada foi ouvida e aprovada pelo usuário: 17,8577 s, pico 0,7772, RMS 0,08711 e sem saturação. Mantém ganho de 0,35 na introdução e 0,22 durante a fala, preservando o preset da voz. TypeScript e build aprovados; [CI do ajuste e0d8ddaa aprovado](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917), incluindo o pacote Windows. A aprovação da prévia não comprova login, ativação ou reprodução/fim da música na recepção ao vivo.

A música acompanha apenas a recepção: termina com o fim ou interrupção da saudação. Não deve manter microfone em espera durante a própria reprodução. Falha no arquivo precisa ser apresentada sem alegar sucesso ou substituir por outra trilha. O arquivo, seu caminho e direitos de uso continuam sob controle do usuário; não são publicados automaticamente.

## Aceite pendente

No Windows empacotado, conferir login real, pausar/retomar pela bandeja, palmas e palavra com os dispositivos escolhidos, fala comum/TV/ruído, ausência de autoativação durante a narração, retorno após o fim, cancelamento e saída. Testar também reconhecedor ausente, permissão negada, microfone ocupado e retomada do computador.

O [registro de validação](validation.md) distingue ensaios reais e automatizados: o CI da base 0.2.0 aprovou 214 testes e o pacote Windows; o [CI da revisão de volume e0d8ddaa](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/39160538917) também aprovou testes e empacotamento. Nenhum desses resultados comprova ativação/login reais. O [plano de testes](test-plan.md) fornece os cenários completos.
