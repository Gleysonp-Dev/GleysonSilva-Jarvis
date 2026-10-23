# Controle remoto da Fire TV

A versão 0.7.1 acrescenta um painel de controle remoto ao aplicativo Windows. Abra **TV** na barra lateral. O controle usa a mesma Fire TV habilitada e pareada em Ajustes; o endereço e a chave permanecem privados. Não é necessário configurar uma segunda conexão ou informar uma chave de IA para pressionar os botões.

## Botões disponíveis

- Setas e OK para navegar enquanto a pessoa observa a televisão.
- Início e Voltar.
- Aumentar/diminuir volume e mudo.
- Tocar e pausar, conforme o aplicativo e o equipamento suportarem.
- Atalhos Netflix, Prime Video, YouTube, Disney+, Max e Spotify, somente se um pacote conhecido estiver instalado.

Cada clique corresponde a um pedido. Não há repetição ao manter um botão pressionado, sequência de setas automática, posição fixa de perfil ou botão de energia sem integração validada. Aguarde a conclusão de um pedido antes de enviar outro. Se houver erro ou expiração, confira a televisão antes de tentar novamente; o efeito pode ter ocorrido.

**Comando enviado** significa que a solicitação foi entregue, sem comprovação visual da tela, do volume ou da reprodução. O painel não apresenta uma imagem simulada da televisão nem inventa seu estado.

## Voz e seleção de perfil

Na conversa nativa, as ferramentas `tv_control` e `tv_open_app` continuam oferecendo os mesmos comandos. Exemplos: **“Volte ao início da TV”**, **“Abra a Netflix na TV”**, **“Direita na TV”** e **“Confirme na TV”**. O controlador mantém os pedidos serializados e não repete comandos incertos automaticamente.

Uma réplica do controle remoto oferece botões para comandar a TV; a seleção automática de um perfil pelo nome também exige identificar a tela e o alvo. Na Netflix testada, os nomes não ficaram disponíveis pelo método de leitura utilizado. Selecionar o perfil permanece uma ação assistida: observe a televisão, navegue com setas e confirme o perfil desejado com OK. Abrir o aplicativo não comprova entrar em um perfil, autenticar conta ou iniciar um título.

## Cancelamento e privacidade

Interromper um envio pendente evita os próximos passos ainda não executados; não desfaz um comando já entregue. Fechar o painel, mudar de perfil/configuração ou sair do aplicativo impede que respostas antigas sejam apresentadas como novas. Nenhum botão recebe caminho de executável, pacote arbitrário, comando de terminal ou IP enviado pelo modelo.

O painel fica disponível quando a Fire TV está configurada e pareada no aplicativo Windows. Durante outra ação incompatível, aguarde ou interrompa essa ação. Uma conversa por voz conectada e ociosa pode permanecer conectada durante o uso do controle.

## Estado de validação

**Preview 0.7.1 disponível:** [CI 1770cff da 0.7.1](https://github.com/Gleysonp-Dev/GleysonSilva-Jarvis/actions/runs/40011923997) aprovou **662/662 testes, zero falhas/skips**, TypeScript, build, pacote e abertura nativa. ZIP/EXE foram baixados e conferidos por tamanho e SHA-256; [instalação e hashes](../AI_INSTALL.md#pacote-windows-071-conferido). A revisão visual utilizou somente uma ponte simulada, sem acessar a TV.

**Teste físico dos botões continua pendente.** O aceite físico da 0.7.0 — pareamento e sequência Início → Netflix por voz — pertence à base anterior. Não comprova os botões novos, todos os aplicativos e controles, outros dispositivos/firmwares, persistência do pareamento após reinício ou seleção automática de perfil. Não há nova marca aplicada nesta versão. [Evidências e limites](validation.md#revisão-071--ci-e-pacote-conferidos-teste-físico-pendente).

Para configurar ou revogar a conexão, consulte [Fire TV](fire-tv.md).
