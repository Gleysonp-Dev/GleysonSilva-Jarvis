# Tela cheia — 0.5.2

Clique no ícone de expandir no canto superior direito, próximo ao perfil/Ajustes. **F11** alterna entre tela cheia e janela. Para sair, pressione **Esc**, **F11** ou clique no ícone de recolher. O botão informa seu estado para leitores de tela e mostra o atalho ao passar o ponteiro.

O núcleo se adapta à área disponível. A troca não reinicia o Jarvis, repete a saudação nem muda a conversa, o microfone ou as opções salvas. Não adiciona transcrição ou frases ao dashboard. O modo não é salvo como preferência de início: a próxima abertura mantém o comportamento anterior de janela/espera.

## Aplicativo e navegador

No Windows, o preload oferece apenas ler/definir um booleano e acompanhar o estado da janela principal. O processo principal confere a origem e o frame da solicitação. Não aceita ID de janela, comando ou caminho. As mudanças nativas também atualizam o ícone.

Na prévia e no teste local pelo navegador, o botão usa a API de tela cheia do próprio navegador, iniciada por clique/tecla. A saída nativa do navegador sincroniza o botão. Bloqueios ou falta de suporte mostram erro, sem afirmar que entrou em tela cheia. F11 pelo botão/atalho do próprio navegador pode ter comportamento definido por ele; o aplicativo Windows usa o controle nativo.

## Verificação

Os testes de fronteira cobrem origem/validação, entrada/saída, mudanças externas, teclas, repetição de tecla, erro, respostas atrasadas e limpeza de listeners. O ensaio do pacote Windows deve clicar no botão real para entrar e sair, verificando o estado nativo e o estado acessível do botão. CI e pacote desta revisão ainda estão em preparação. Não equivale a teste com todos os monitores, resoluções ou dispositivos de áudio.

Roteiro no computador de destino: confirme **MVP / 05.2**, clique no ícone, pressione Esc, pressione F11 duas vezes e repita durante uma conversa. O áudio deve continuar sem reiniciar. Verifique também Ajustes e o núcleo no tamanho do seu monitor.

Referências oficiais: [BrowserWindow.setFullScreen/isFullScreen e eventos](https://www.electronjs.org/docs/latest/api/browser-window#winsetfullscreenflag).
